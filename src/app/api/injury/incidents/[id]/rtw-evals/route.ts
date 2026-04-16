import { NextResponse } from 'next/server';
import { db } from '@/db';
import { injuries, returnToWorkEvals } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const createRtwSchema = z.object({
  evaluationDate: z.string().datetime(),
  evaluatorName: z.string().max(200).optional(),
  status: z.enum(['full_duty', 'restricted_duty', 'unable_to_work']),
  releasedToWorkOn: z.string().datetime().optional(),
  restrictions: z.array(z.string()).optional(),
  followUpRequired: z.boolean().optional(),
  followUpDate: z.string().datetime().optional(),
  notes: z.string().max(5000).optional(),
});

function scopeInjury(tpaOrgId: string | null | undefined, id: string) {
  return tpaOrgId
    ? and(eq(injuries.id, id), eq(injuries.tpaOrgId, tpaOrgId))
    : eq(injuries.id, id);
}

export const GET = withPermission('view_injuries', async (_req, user, context) => {
  const { id } = context.params;
  const injury = await db.query.injuries.findFirst({
    where: scopeInjury(user.tpaOrgId, id),
    columns: { id: true, clientOrgId: true },
  });
  if (!injury) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });

  if (user.role === 'client_admin') {
    if (!user.orgId || injury.clientOrgId !== user.orgId) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }
  }

  const evals = await db.query.returnToWorkEvals.findMany({
    where: eq(returnToWorkEvals.injuryId, id),
    with: {
      evaluator: { columns: { id: true, name: true, email: true } },
      signedOffByUser: { columns: { id: true, name: true, email: true } },
    },
    orderBy: [desc(returnToWorkEvals.evaluationDate)],
  });

  return NextResponse.json({ rtwEvals: evals });
});

export const POST = withPermission('manage_injuries', async (req, user, context) => {
  const { id } = context.params;
  const injury = await db.query.injuries.findFirst({
    where: scopeInjury(user.tpaOrgId, id),
  });
  if (!injury) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createRtwSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const [row] = await db
    .insert(returnToWorkEvals)
    .values({
      injuryId: id,
      tpaOrgId: injury.tpaOrgId,
      evaluationDate: new Date(d.evaluationDate),
      evaluatorId: user.id,
      evaluatorName: d.evaluatorName || null,
      status: d.status,
      releasedToWorkOn: d.releasedToWorkOn ? new Date(d.releasedToWorkOn) : null,
      restrictions: d.restrictions ?? [],
      followUpRequired: d.followUpRequired ?? false,
      followUpDate: d.followUpDate ? new Date(d.followUpDate) : null,
      notes: d.notes || null,
    })
    .returning();

  // Auto-advance injury status based on the latest RTW outcome.
  const nextInjuryStatus =
    d.status === 'full_duty'
      ? 'rtw_full_duty'
      : d.status === 'restricted_duty'
        ? 'rtw_restricted'
        : 'rtw_eval_pending';
  await db
    .update(injuries)
    .set({ status: nextInjuryStatus, updatedAt: new Date() })
    .where(eq(injuries.id, id));

  await createAuditLog({
    tpaOrgId: injury.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'rtw_eval',
    entityId: row.id,
    action: 'created',
    diffJson: { injuryId: id, status: d.status },
  });

  return NextResponse.json({ rtwEval: row, message: 'RTW evaluation recorded' }, { status: 201 });
});
