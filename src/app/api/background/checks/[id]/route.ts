import { NextResponse } from 'next/server';
import { db } from '@/db';
import { backgroundChecks } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { enqueueWebhookEvent } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  notes: z.string().max(5000).optional(),
  internalNotes: z.string().max(5000).optional(),
});

function scopeWhere(tpaOrgId: string | null | undefined, id: string) {
  return tpaOrgId
    ? and(eq(backgroundChecks.id, id), eq(backgroundChecks.tpaOrgId, tpaOrgId))
    : eq(backgroundChecks.id, id);
}

export const GET = withPermission('view_background_checks', async (_req, user, context) => {
  const { id } = context.params;

  const check = await db.query.backgroundChecks.findFirst({
    where: scopeWhere(user.tpaOrgId, id),
    with: {
      person: true,
      clientOrg: { columns: { id: true, name: true } },
      package: true,
      charges: true,
    },
  });
  if (!check) return NextResponse.json({ error: 'Check not found' }, { status: 404 });

  // client_admin: must match clientOrgId; strip internalNotes
  if (user.role === 'client_admin') {
    if (!user.orgId || check.clientOrgId !== user.orgId) {
      return NextResponse.json({ error: 'Check not found' }, { status: 404 });
    }
    const { internalNotes: _omit, ...safe } = check as any;
    return NextResponse.json({ check: safe });
  }

  return NextResponse.json({ check });
});

export const PATCH = withPermission('view_background_checks', async (req, user, context) => {
  const { id } = context.params;

  const existing = await db.query.backgroundChecks.findFirst({
    where: scopeWhere(user.tpaOrgId, id),
  });
  if (!existing) return NextResponse.json({ error: 'Check not found' }, { status: 404 });

  if (user.role === 'client_admin') {
    if (!user.orgId || existing.clientOrgId !== user.orgId) {
      return NextResponse.json({ error: 'Check not found' }, { status: 404 });
    }
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;
  if (parsed.data.internalNotes !== undefined) {
    if (user.role === 'client_admin') {
      return NextResponse.json({ error: 'Forbidden: cannot edit internal notes' }, { status: 403 });
    }
    update.internalNotes = parsed.data.internalNotes;
  }

  await db.update(backgroundChecks).set(update).where(eq(backgroundChecks.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'background_check',
    entityId: id,
    action: 'updated',
    diffJson: parsed.data as Record<string, unknown>,
  });

  await enqueueWebhookEvent({
    tpaOrgId: existing.tpaOrgId,
    event: 'background_check.updated',
    payload: { id, fieldsChanged: Object.keys(parsed.data) },
  }).catch(() => {});

  const updated = await db.query.backgroundChecks.findFirst({
    where: eq(backgroundChecks.id, id),
  });
  return NextResponse.json({ check: updated });
});
