import { NextResponse } from 'next/server';
import { db } from '@/db';
import { returnToWorkEvals } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  evaluationDate: z.string().datetime().optional(),
  evaluatorName: z.string().max(200).nullable().optional(),
  status: z.enum(['full_duty', 'restricted_duty', 'unable_to_work']).optional(),
  releasedToWorkOn: z.string().datetime().nullable().optional(),
  restrictions: z.array(z.string()).optional(),
  followUpRequired: z.boolean().optional(),
  followUpDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

function scope(tpaOrgId: string | null | undefined, id: string) {
  return tpaOrgId
    ? and(eq(returnToWorkEvals.id, id), eq(returnToWorkEvals.tpaOrgId, tpaOrgId))
    : eq(returnToWorkEvals.id, id);
}

export const PATCH = withPermission('manage_injuries', async (req, user, context) => {
  const { id } = context.params;

  const existing = await db.query.returnToWorkEvals.findFirst({
    where: scope(user.tpaOrgId, id),
  });
  if (!existing) {
    return NextResponse.json({ error: 'RTW evaluation not found' }, { status: 404 });
  }

  // Once signed off, RTW eval is immutable — file a new one instead.
  if (existing.signedOffAt) {
    return NextResponse.json(
      { error: 'Signed-off RTW evaluations are immutable; create a new evaluation instead' },
      { status: 400 },
    );
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
    if (v === undefined) continue;
    if (
      (k === 'evaluationDate' || k === 'releasedToWorkOn' || k === 'followUpDate') &&
      typeof v === 'string'
    ) {
      update[k] = new Date(v);
    } else {
      update[k] = v;
    }
  }

  await db.update(returnToWorkEvals).set(update).where(eq(returnToWorkEvals.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'rtw_eval',
    entityId: id,
    action: 'updated',
    diffJson: parsed.data as Record<string, unknown>,
  });

  const updated = await db.query.returnToWorkEvals.findFirst({
    where: eq(returnToWorkEvals.id, id),
  });
  return NextResponse.json({ rtwEval: updated });
});

export const DELETE = withPermission('manage_injuries', async (_req, user, context) => {
  const { id } = context.params;

  const existing = await db.query.returnToWorkEvals.findFirst({
    where: scope(user.tpaOrgId, id),
  });
  if (!existing) {
    return NextResponse.json({ error: 'RTW evaluation not found' }, { status: 404 });
  }
  if (existing.signedOffAt) {
    return NextResponse.json(
      { error: 'Signed-off RTW evaluations cannot be deleted' },
      { status: 400 },
    );
  }

  await db.delete(returnToWorkEvals).where(eq(returnToWorkEvals.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'rtw_eval',
    entityId: id,
    action: 'deleted',
    diffJson: { injuryId: existing.injuryId },
  });

  return NextResponse.json({ ok: true });
});
