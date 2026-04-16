import { NextResponse } from 'next/server';
import { db } from '@/db';
import { injuries } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  status: z
    .enum([
      'open',
      'in_treatment',
      'rtw_eval_pending',
      'rtw_full_duty',
      'rtw_restricted',
      'closed',
      'litigation',
    ])
    .optional(),
  severity: z
    .enum(['first_aid', 'medical', 'lost_time', 'restricted_duty', 'fatality'])
    .optional(),
  oshaRecordable: z.boolean().optional(),
  oshaCase: z.string().max(50).nullable().optional(),
  lostDaysCount: z.number().int().min(0).optional(),
  restrictedDaysCount: z.number().int().min(0).optional(),
  workersCompClaimNumber: z.string().max(50).nullable().optional(),
  workersCompCarrier: z.string().max(200).nullable().optional(),
  bodyPartsAffected: z.array(z.string()).optional(),
  injuryType: z.string().min(1).max(50).optional(),
  description: z.string().max(5000).optional(),
  location: z.string().max(500).optional(),
  jobAtIncident: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
});

function scopeWhere(tpaOrgId: string | null | undefined, id: string) {
  return tpaOrgId
    ? and(eq(injuries.id, id), eq(injuries.tpaOrgId, tpaOrgId))
    : eq(injuries.id, id);
}

export const GET = withPermission('view_injuries', async (_req, user, context) => {
  const { id } = context.params;

  const injury = await db.query.injuries.findFirst({
    where: scopeWhere(user.tpaOrgId, id),
    with: {
      person: true,
      clientOrg: { columns: { id: true, name: true } },
      reportedByUser: { columns: { id: true, name: true, email: true } },
      treatments: { orderBy: (t, { desc }) => [desc(t.treatmentDate)] },
      documents: { orderBy: (d, { desc }) => [desc(d.createdAt)] },
      rtwEvals: { orderBy: (r, { desc }) => [desc(r.evaluationDate)] },
    },
  });

  if (!injury) {
    return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
  }

  // client_admin scoping: must match clientOrgId; strip internalNotes
  if (user.role === 'client_admin') {
    if (!user.orgId || injury.clientOrgId !== user.orgId) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }
    const { internalNotes: _omit, ...safe } = injury as any;
    return NextResponse.json({ incident: safe });
  }

  return NextResponse.json({ incident: injury });
});

export const PATCH = withPermission('manage_injuries', async (req, user, context) => {
  const { id } = context.params;

  const existing = await db.query.injuries.findFirst({
    where: scopeWhere(user.tpaOrgId, id),
  });
  if (!existing) {
    return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
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
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) update[k] = v;
  }

  await db.update(injuries).set(update).where(eq(injuries.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'injury',
    entityId: id,
    action: 'updated',
    diffJson: parsed.data as Record<string, unknown>,
  });

  const updated = await db.query.injuries.findFirst({
    where: eq(injuries.id, id),
  });
  return NextResponse.json({ incident: updated });
});

export const DELETE = withPermission('manage_injuries', async (_req, user, context) => {
  const { id } = context.params;

  const existing = await db.query.injuries.findFirst({
    where: scopeWhere(user.tpaOrgId, id),
  });
  if (!existing) {
    return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
  }

  // Only allow delete if the case is still open with no treatments — guard
  // against accidental deletion of an audit-critical record. Safer path:
  // mark as closed with a note. We enforce this by requiring status === 'open'.
  if (existing.status !== 'open') {
    return NextResponse.json(
      { error: 'Only incidents in status "open" can be deleted; close the case instead' },
      { status: 400 },
    );
  }

  await db.delete(injuries).where(eq(injuries.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'injury',
    entityId: id,
    action: 'deleted',
    diffJson: { incidentNumber: existing.incidentNumber },
  });

  return NextResponse.json({ ok: true });
});
