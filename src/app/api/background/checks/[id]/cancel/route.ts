import { NextResponse } from 'next/server';
import { db } from '@/db';
import { backgroundChecks } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';
import { getDefaultCheckrClient } from '@/lib/checkr-client';
import { loadCheckrCredentials } from '@/lib/checkr-credentials';
import { enqueueWebhookEvent } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

export const POST = withPermission('manage_background_checks', async (_req, user, context) => {
  const { id } = context.params;
  const tpaOrgId = user.tpaOrgId;

  const existing = await db.query.backgroundChecks.findFirst({
    where: tpaOrgId
      ? and(eq(backgroundChecks.id, id), eq(backgroundChecks.tpaOrgId, tpaOrgId))
      : eq(backgroundChecks.id, id),
  });
  if (!existing) return NextResponse.json({ error: 'Check not found' }, { status: 404 });

  if (existing.status === 'canceled') {
    return NextResponse.json({ error: 'Check is already canceled' }, { status: 400 });
  }
  if (existing.status === 'clear' || existing.status === 'consider' || existing.status === 'suspended') {
    return NextResponse.json(
      { error: 'Cannot cancel a completed report' },
      { status: 400 },
    );
  }

  if (existing.externalId) {
    const client = getDefaultCheckrClient(loadCheckrCredentials);
    const result = await client.cancelReport(existing.tpaOrgId, existing.externalId);
    if (!result.ok) {
      // If Checkr says not-found we still mark local as canceled
      if (result.errorCode !== 'not_found') {
        return NextResponse.json(
          { error: 'Checkr cancelReport failed', errorCode: result.errorCode, errorMessage: result.errorMessage },
          { status: 502 },
        );
      }
    }
  }

  const now = new Date();
  await db
    .update(backgroundChecks)
    .set({ status: 'canceled', canceledAt: now, updatedAt: now })
    .where(eq(backgroundChecks.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'background_check',
    entityId: id,
    action: 'canceled',
    diffJson: { prevStatus: existing.status },
  });

  await enqueueWebhookEvent({
    tpaOrgId: existing.tpaOrgId,
    event: 'background_check.canceled',
    payload: { id, prevStatus: existing.status },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
});
