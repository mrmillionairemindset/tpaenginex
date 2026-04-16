import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { backgroundChecks, backgroundCheckCharges } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { loadCheckrCredentials } from '@/lib/checkr-credentials';
import { verifyCheckrHmac, type CheckrReportStatus } from '@/lib/checkr-client';
import { enqueueWebhookEvent } from '@/lib/webhooks';
import { createAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const log = logger.child({ component: 'webhook-checkr' });

interface CheckrWebhookPayload {
  type?: string;
  id?: string;
  data?: {
    object?: {
      id?: string;
      status?: string;
      custom_id?: string;
      completed_at?: string | null;
      report_url?: string | null;
      considered_screens?: string[];
      adjudication?: string;
      [k: string]: unknown;
    };
  };
  [k: string]: unknown;
}

function normalizeStatus(s: string | undefined): CheckrReportStatus | null {
  switch (s) {
    case 'pending':
    case 'processing':
    case 'clear':
    case 'consider':
    case 'suspended':
    case 'dispute':
    case 'canceled':
    case 'expired':
      return s;
    default:
      return null;
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  // Read raw body — do NOT use req.json() here, HMAC requires exact bytes.
  const rawBody = await req.text();
  const signature = req.headers.get('x-checkr-signature') || req.headers.get('X-Checkr-Signature') || '';

  let payload: CheckrWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as CheckrWebhookPayload;
  } catch {
    log.warn('webhook payload not valid JSON');
    return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
  }

  const object = payload.data?.object;
  const customId = object?.custom_id;
  if (!customId) {
    // Some Checkr events (account.*) have no custom_id — we ignore them with 200
    // to avoid retries.
    log.info({ type: payload.type }, 'webhook with no custom_id — ignoring');
    return NextResponse.json({ ok: true, ignored: true });
  }

  // Look up the background check by ID (custom_id == background_checks.id)
  const check = await db.query.backgroundChecks.findFirst({
    where: eq(backgroundChecks.id, customId),
  });
  if (!check) {
    log.warn({ customId, type: payload.type }, 'webhook for unknown background_check');
    return NextResponse.json({ error: 'unknown check' }, { status: 404 });
  }

  // Verify signature using the TPA's webhook secret
  const creds = await loadCheckrCredentials(check.tpaOrgId);
  if (!creds || !creds.webhookSecret) {
    log.warn({ tpaOrgId: check.tpaOrgId }, 'no webhook secret configured for this tenant');
    return NextResponse.json({ error: 'webhook secret not configured' }, { status: 401 });
  }

  const verified = verifyCheckrHmac(rawBody, creds.webhookSecret, signature);
  if (!verified) {
    log.warn({ tpaOrgId: check.tpaOrgId, customId, type: payload.type }, 'webhook_signature_mismatch');
    await createAuditLog({
      tpaOrgId: check.tpaOrgId,
      actorUserId: 'system',
      actorEmail: 'system@tpaengx',
      entityType: 'background_check',
      entityId: check.id,
      action: 'webhook_signature_mismatch',
      diffJson: { type: payload.type ?? null },
    }).catch(() => {});
    return NextResponse.json({ error: 'signature mismatch' }, { status: 401 });
  }

  const type = payload.type ?? '';
  const nextStatus = normalizeStatus(object?.status);

  // Build update
  const now = new Date();
  const update: Record<string, unknown> = { updatedAt: now };

  if (nextStatus) update.status = nextStatus;
  if (object?.report_url !== undefined) update.hostedReportUrl = object.report_url;
  if (object?.considered_screens || object?.adjudication) {
    update.summaryJson = {
      consideredScreens: object.considered_screens,
      adjudication: object.adjudication,
    };
  }
  if (type === 'report.completed' || nextStatus === 'clear' || nextStatus === 'consider' || nextStatus === 'suspended') {
    update.completedAt = object?.completed_at ? new Date(object.completed_at) : now;
  }
  if (type === 'report.canceled' || nextStatus === 'canceled') {
    update.canceledAt = now;
  }

  await db.update(backgroundChecks).set(update).where(eq(backgroundChecks.id, check.id));

  // On completion, create a charges row (line item for next invoice). Idempotent.
  if (type === 'report.completed') {
    const existingCharge = await db.query.backgroundCheckCharges.findFirst({
      where: eq(backgroundCheckCharges.checkId, check.id),
    });
    if (!existingCharge) {
      const pkg = await db.query.backgroundCheckPackages.findFirst({
        where: (tbl, { eq: e }) => e(tbl.id, check.packageId),
      });
      if (pkg) {
        await db.insert(backgroundCheckCharges).values({
          checkId: check.id,
          tpaOrgId: check.tpaOrgId,
          lineItemDescription: `Background check — ${pkg.name}`,
          amountCents: pkg.retailPriceCents,
        });
      }
    }
  }

  await createAuditLog({
    tpaOrgId: check.tpaOrgId,
    actorUserId: 'system',
    actorEmail: 'system@tpaengx',
    entityType: 'background_check',
    entityId: check.id,
    action: `webhook:${type || 'unknown'}`,
    diffJson: { status: nextStatus, prevStatus: check.status },
  }).catch(() => {});

  // Emit internal webhook for tenant subscribers
  const internalEvent =
    type === 'report.completed'
      ? 'background_check.completed'
      : type === 'report.canceled'
      ? 'background_check.canceled'
      : 'background_check.updated';

  await enqueueWebhookEvent({
    tpaOrgId: check.tpaOrgId,
    event: internalEvent,
    payload: {
      id: check.id,
      status: nextStatus ?? check.status,
      externalId: object?.id ?? check.externalId,
      completedAt: update.completedAt ?? null,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
