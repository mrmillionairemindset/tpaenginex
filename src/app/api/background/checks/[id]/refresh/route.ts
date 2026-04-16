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
  if (!existing.externalId) {
    return NextResponse.json({ error: 'Check has no external ID — nothing to refresh' }, { status: 400 });
  }

  const client = getDefaultCheckrClient(loadCheckrCredentials);
  const result = await client.fetchReport(existing.tpaOrgId, existing.externalId);
  if (!result.ok) {
    return NextResponse.json(
      { error: 'Checkr fetchReport failed', errorCode: result.errorCode, errorMessage: result.errorMessage },
      { status: 502 },
    );
  }

  const report = result.data;
  const changed =
    report.status !== existing.status ||
    report.hostedUrl !== existing.hostedReportUrl ||
    Boolean(report.completedAt) !== Boolean(existing.completedAt);

  if (changed) {
    const now = new Date();
    await db
      .update(backgroundChecks)
      .set({
        status: report.status,
        hostedReportUrl: report.hostedUrl ?? existing.hostedReportUrl,
        summaryJson: report.summary ?? existing.summaryJson,
        completedAt: report.completedAt ? new Date(report.completedAt) : existing.completedAt,
        updatedAt: now,
      })
      .where(eq(backgroundChecks.id, id));

    await createAuditLog({
      tpaOrgId: existing.tpaOrgId,
      actorUserId: user.id,
      actorEmail: user.email!,
      entityType: 'background_check',
      entityId: id,
      action: 'refreshed',
      diffJson: { prevStatus: existing.status, nextStatus: report.status },
    });

    await enqueueWebhookEvent({
      tpaOrgId: existing.tpaOrgId,
      event: 'background_check.updated',
      payload: { id, status: report.status, source: 'manual_refresh' },
    }).catch(() => {});
  }

  const updated = await db.query.backgroundChecks.findFirst({
    where: eq(backgroundChecks.id, id),
  });
  return NextResponse.json({ check: updated, changed });
});
