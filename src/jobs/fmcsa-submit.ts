/**
 * FMCSA Registry submission job.
 *
 * Runs every 15 minutes. Finds certified DOT physical exams with
 * `fmcsaSubmissionStatus = 'pending'` and attempts to submit each to the
 * FMCSA National Registry.
 *
 * Retry policy (see `nextRetryDelayMs` in fmcsa-registry.ts):
 *   attempt 1 fail → retry in 5min
 *   attempt 2 fail → retry in 30min
 *   attempt 3 fail → retry in 3h
 *   attempt 4 fail → retry in 12h
 *   attempt 5 fail → status=error, requires manual retry
 *
 * Validation + authentication errors are marked 'error' immediately (no retry).
 * Duplicate-submission errors are treated as success for idempotency.
 *
 * Regulatory context: 49 CFR 390.105(b) — CMEs must submit exam results to
 * the National Registry by the close of the calendar day following the exam.
 * Our cron runs often enough to meet this when FMCSA's endpoint is up.
 */

import { db } from '@/db/client';
import { physicalExams, persons, tenantModules } from '@/db/schema';
import { and, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';
import { enqueueWebhookEvent } from '@/lib/webhooks';
import { logger } from '@/lib/logger';
import {
  getDefaultFmcsaClient,
  isRetryableError,
  nextRetryDelayMs,
  MAX_FMCSA_ATTEMPTS,
  type FmcsaExamPayload,
  type FmcsaRegistryClient,
  type FmcsaSubmissionResult,
} from '@/lib/fmcsa-registry';

const log = logger.child({ component: 'fmcsa-submit-job' });

const BATCH_SIZE = 50;

export interface FmcsaSubmitJobResult {
  attempted: number;
  succeeded: number;
  failed: number;
  permanentlyFailed: number;
  skippedNoNrcme: number;
}

/**
 * Process the backlog of pending FMCSA submissions.
 * Returns counters for observability.
 */
export async function runFmcsaSubmitJob(
  clientOverride?: FmcsaRegistryClient,
): Promise<FmcsaSubmitJobResult> {
  const client = clientOverride ?? getDefaultFmcsaClient();
  const now = new Date();
  const result: FmcsaSubmitJobResult = {
    attempted: 0,
    succeeded: 0,
    failed: 0,
    permanentlyFailed: 0,
    skippedNoNrcme: 0,
  };

  // Only process exams for TPAs that have the occupational_health module enabled
  const enabledTenants = await db.query.tenantModules.findMany({
    where: and(
      eq(tenantModules.moduleId, 'occupational_health'),
      eq(tenantModules.isEnabled, true),
    ),
    columns: { tpaOrgId: true },
  });
  if (enabledTenants.length === 0) {
    log.info({ reason: 'no_tenants_enabled' }, 'skipping FMCSA submit sweep');
    return result;
  }
  const enabledTpaOrgIds = enabledTenants.map((t) => t.tpaOrgId);

  // Find pending submissions ready to retry (no nextAttemptAt concept yet, so
  // we look at the `updatedAt` field — if it's past the backoff interval for
  // the current attempt count, retry).
  const pending = await db.query.physicalExams.findMany({
    where: and(
      inArray(physicalExams.tpaOrgId, enabledTpaOrgIds),
      eq(physicalExams.fmcsaSubmissionStatus, 'pending'),
      eq(physicalExams.examType, 'dot'),
      or(
        eq(physicalExams.fmcsaAttempts, 0),
        lte(physicalExams.updatedAt, new Date(now.getTime() - 60 * 1000)),
      ),
    ),
    with: {
      person: true,
    },
    limit: BATCH_SIZE,
  });

  if (pending.length === 0) {
    return result;
  }

  log.info({ count: pending.length }, 'processing FMCSA submissions');

  for (const exam of pending) {
    // Respect per-exam backoff: compute how long since last attempt
    if (exam.fmcsaAttempts > 0 && exam.updatedAt) {
      const backoffMs = nextRetryDelayMs(exam.fmcsaAttempts);
      if (backoffMs < 0) {
        // Already past max attempts — shouldn't be in 'pending' anymore but
        // guard defensively.
        continue;
      }
      const readyAt = exam.updatedAt.getTime() + backoffMs;
      if (readyAt > now.getTime()) {
        // Not yet time to retry this one
        continue;
      }
    }

    if (!exam.examinerNRCMENumber) {
      // Can't submit without an NRCME number. Mark as error so operator can fix.
      result.skippedNoNrcme++;
      result.permanentlyFailed++;
      await db
        .update(physicalExams)
        .set({
          fmcsaSubmissionStatus: 'error',
          fmcsaErrorMessage: 'Examiner NRCME number missing on exam record',
          updatedAt: new Date(),
        })
        .where(eq(physicalExams.id, exam.id));
      continue;
    }

    if (!exam.examDate || !exam.certificateNumber || !exam.certificationStatus) {
      result.permanentlyFailed++;
      await db
        .update(physicalExams)
        .set({
          fmcsaSubmissionStatus: 'error',
          fmcsaErrorMessage: 'Exam is missing examDate, certificateNumber, or certificationStatus',
          updatedAt: new Date(),
        })
        .where(eq(physicalExams.id, exam.id));
      continue;
    }

    result.attempted++;

    const payload: FmcsaExamPayload = {
      examId: exam.id,
      examinerNRCMENumber: exam.examinerNRCMENumber,
      driver: {
        firstName: exam.person.firstName,
        lastName: exam.person.lastName,
        dob: normalizeDob(exam.person.dob),
        cdlNumber: null,
        cdlState: null,
      },
      examDate: toIsoDate(exam.examDate),
      examType: 'dot',
      certificationStatus: exam.certificationStatus,
      mecExpiresOn: exam.mecExpiresOn ? toIsoDate(exam.mecExpiresOn) : null,
      certificateNumber: exam.certificateNumber,
      restrictions: (exam.restrictions ?? []) as string[],
    };

    let submitResult: FmcsaSubmissionResult;
    try {
      submitResult = await client.submit(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      submitResult = {
        ok: false,
        errorCode: 'unknown',
        errorMessage: msg,
      };
    }

    await applySubmitResult(exam.id, exam.tpaOrgId, exam.fmcsaAttempts, submitResult);

    if (submitResult.ok || submitResult.errorCode === 'duplicate_submission') {
      result.succeeded++;
    } else if (isRetryableError(submitResult.errorCode) && exam.fmcsaAttempts + 1 < MAX_FMCSA_ATTEMPTS) {
      result.failed++;
    } else {
      result.permanentlyFailed++;
    }
  }

  log.info(result, 'FMCSA submit sweep complete');
  return result;
}

/**
 * Submit a single exam on demand (used by the manual retry API route).
 */
export async function submitSingleExam(
  examId: string,
  clientOverride?: FmcsaRegistryClient,
): Promise<FmcsaSubmissionResult> {
  const client = clientOverride ?? getDefaultFmcsaClient();
  const exam = await db.query.physicalExams.findFirst({
    where: eq(physicalExams.id, examId),
    with: { person: true },
  });
  if (!exam) {
    return { ok: false, errorCode: 'validation_error', errorMessage: 'Exam not found' };
  }
  if (exam.examType !== 'dot') {
    return { ok: false, errorCode: 'validation_error', errorMessage: 'Only DOT exams submit to FMCSA' };
  }
  if (!exam.examinerNRCMENumber || !exam.examDate || !exam.certificateNumber || !exam.certificationStatus) {
    return {
      ok: false,
      errorCode: 'validation_error',
      errorMessage: 'Exam missing required fields (NRCME, exam date, certificate number, or certification status)',
    };
  }

  const payload: FmcsaExamPayload = {
    examId: exam.id,
    examinerNRCMENumber: exam.examinerNRCMENumber,
    driver: {
      firstName: exam.person.firstName,
      lastName: exam.person.lastName,
      dob: normalizeDob(exam.person.dob),
      cdlNumber: null,
      cdlState: null,
    },
    examDate: toIsoDate(exam.examDate),
    examType: 'dot',
    certificationStatus: exam.certificationStatus,
    mecExpiresOn: exam.mecExpiresOn ? toIsoDate(exam.mecExpiresOn) : null,
    certificateNumber: exam.certificateNumber,
    restrictions: (exam.restrictions ?? []) as string[],
  };

  const submitResult = await client.submit(payload);
  await applySubmitResult(exam.id, exam.tpaOrgId, exam.fmcsaAttempts, submitResult);
  return submitResult;
}

async function applySubmitResult(
  examId: string,
  tpaOrgId: string,
  priorAttempts: number,
  result: FmcsaSubmissionResult,
): Promise<void> {
  const now = new Date();
  if (result.ok) {
    await db
      .update(physicalExams)
      .set({
        fmcsaSubmissionStatus: 'submitted',
        fmcsaSubmittedAt: now,
        fmcsaSubmissionId: result.fmcsaSubmissionId,
        fmcsaErrorMessage: null,
        fmcsaAttempts: priorAttempts + 1,
        updatedAt: now,
      })
      .where(eq(physicalExams.id, examId));

    await createAuditLog({
      tpaOrgId,
      actorUserId: 'system',
      actorEmail: 'system@tpaengx',
      entityType: 'physical_exam',
      entityId: examId,
      action: 'fmcsa_submitted',
      diffJson: { fmcsaSubmissionId: result.fmcsaSubmissionId, attempts: priorAttempts + 1 },
    }).catch(() => {});

    await enqueueWebhookEvent({
      tpaOrgId,
      event: 'physical.fmcsa_submitted',
      payload: { examId, fmcsaSubmissionId: result.fmcsaSubmissionId },
    }).catch(() => {});

    return;
  }

  // Duplicate is treated as success (FMCSA already has the record)
  if (result.errorCode === 'duplicate_submission') {
    await db
      .update(physicalExams)
      .set({
        fmcsaSubmissionStatus: 'submitted',
        fmcsaSubmittedAt: now,
        fmcsaErrorMessage: `Already submitted: ${result.errorMessage}`,
        fmcsaAttempts: priorAttempts + 1,
        updatedAt: now,
      })
      .where(eq(physicalExams.id, examId));
    return;
  }

  const attempts = priorAttempts + 1;
  const isRetryable = isRetryableError(result.errorCode);
  const exhausted = attempts >= MAX_FMCSA_ATTEMPTS;

  const newStatus = isRetryable && !exhausted ? 'pending' : 'error';

  await db
    .update(physicalExams)
    .set({
      fmcsaSubmissionStatus: newStatus,
      fmcsaErrorMessage: `[${result.errorCode}] ${result.errorMessage}`,
      fmcsaAttempts: attempts,
      updatedAt: now,
    })
    .where(eq(physicalExams.id, examId));

  if (newStatus === 'error') {
    await createAuditLog({
      tpaOrgId,
      actorUserId: 'system',
      actorEmail: 'system@tpaengx',
      entityType: 'physical_exam',
      entityId: examId,
      action: 'fmcsa_submission_failed',
      diffJson: {
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        attempts,
        permanent: exhausted || !isRetryable,
      },
    }).catch(() => {});
  }
}

// ============================================================================
// Date helpers
// ============================================================================

function toIsoDate(d: Date): string {
  // Use UTC to avoid timezone drift on cert dates. A Cert issued on Apr 15
  // should read "2025-04-15" regardless of server TZ.
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Normalize stored DOB (which we store as MM/DD/YYYY) to FMCSA's YYYY-MM-DD format.
 * Returns the original string if it doesn't match expected patterns.
 */
function normalizeDob(dob: string): string {
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(dob)) return dob;
  // MM/DD/YYYY
  const m = dob.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1]}-${m[2]}`;
  return dob;
}
