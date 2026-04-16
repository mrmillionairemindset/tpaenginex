/**
 * POST /api/occ/physicals/[id]/fmcsa-submit
 *
 * Manual trigger for FMCSA National Registry submission. Used when:
 *  - A submission failed permanently (status=error) and the operator has fixed
 *    the underlying issue (e.g., added the NRCME number to the user record)
 *  - A submission succeeded but the operator wants to verify by re-running
 *    (this will return 'duplicate_submission' from FMCSA, treated as success)
 *  - An exam was somehow skipped by the cron and needs catch-up
 *
 * Role: `fmcsa_submit` permission. Must belong to the same TPA as the exam.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { physicalExams } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { withPermission } from '@/auth/api-middleware';
import { submitSingleExam } from '@/jobs/fmcsa-submit';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const POST = withPermission(
  'fmcsa_submit',
  async (_req: NextRequest, user, ctx: { params: { id: string } }) => {
    const { id } = ctx.params;

    // Verify the exam belongs to this TPA (platform admin can submit any)
    const exam = await db.query.physicalExams.findFirst({
      where:
        user.tpaOrgId && user.role !== 'platform_admin'
          ? and(eq(physicalExams.id, id), eq(physicalExams.tpaOrgId, user.tpaOrgId))
          : eq(physicalExams.id, id),
    });

    if (!exam) {
      return NextResponse.json({ error: 'Physical exam not found' }, { status: 404 });
    }

    if (exam.status !== 'completed') {
      return NextResponse.json(
        { error: 'Only completed exams can be submitted to FMCSA' },
        { status: 400 },
      );
    }

    if (exam.examType !== 'dot') {
      return NextResponse.json(
        { error: 'Only DOT exams submit to the FMCSA National Registry' },
        { status: 400 },
      );
    }

    // Reset status to 'pending' before invoking, so the job updates it
    // correctly. submitSingleExam uses applySubmitResult which handles all
    // outcomes (success, retryable fail, permanent fail, duplicate).
    if (exam.fmcsaSubmissionStatus === 'error') {
      await db
        .update(physicalExams)
        .set({
          fmcsaSubmissionStatus: 'pending',
          fmcsaErrorMessage: null,
          // Keep attempts counter — we don't reset it. If it's already >= MAX_FMCSA_ATTEMPTS,
          // the next attempt will push it over; we accept that for manual retries.
          updatedAt: new Date(),
        })
        .where(eq(physicalExams.id, id));
    }

    await createAuditLog({
      tpaOrgId: exam.tpaOrgId,
      actorUserId: user.id,
      actorEmail: user.email,
      entityType: 'physical_exam',
      entityId: id,
      action: 'fmcsa_submit_manual',
      diffJson: { priorStatus: exam.fmcsaSubmissionStatus, priorAttempts: exam.fmcsaAttempts },
    });

    const result = await submitSingleExam(id);

    if (result.ok) {
      return NextResponse.json({
        success: true,
        fmcsaSubmissionId: result.fmcsaSubmissionId,
        status: result.status,
      });
    }

    const statusCode = result.errorCode === 'duplicate_submission' ? 200 : 502;
    return NextResponse.json(
      {
        success: false,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      },
      { status: statusCode },
    );
  },
);
