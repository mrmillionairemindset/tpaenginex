import { NextResponse } from 'next/server';
import { db } from '@/db';
import { respiratorFitTests } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  respiratorMake: z.string().max(100).optional(),
  respiratorModel: z.string().max(100).optional(),
  respiratorSize: z.string().max(20).optional(),
  fitFactor: z.number().int().min(0).max(100000).optional(),
  passed: z.boolean().optional(),
  nextTestDueBy: z.string().datetime().optional().nullable(),
  notes: z.string().max(5000).optional(),
});

function scope(tpaOrgId: string | null | undefined, id: string) {
  return tpaOrgId
    ? and(eq(respiratorFitTests.id, id), eq(respiratorFitTests.tpaOrgId, tpaOrgId))
    : eq(respiratorFitTests.id, id);
}

export const GET = withPermission('view_fit_tests', async (_req, user, context) => {
  const { id } = context.params;
  const row = await db.query.respiratorFitTests.findFirst({
    where: scope(user.tpaOrgId, id),
    with: { person: { columns: { id: true, firstName: true, lastName: true, email: true } } },
  });
  if (!row) return NextResponse.json({ error: 'Fit test not found' }, { status: 404 });
  return NextResponse.json({ fitTest: row });
});

export const PATCH = withPermission('manage_fit_tests', async (req, user, context) => {
  const { id } = context.params;
  const existing = await db.query.respiratorFitTests.findFirst({ where: scope(user.tpaOrgId, id) });
  if (!existing) return NextResponse.json({ error: 'Fit test not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.respiratorMake !== undefined) update.respiratorMake = parsed.data.respiratorMake;
  if (parsed.data.respiratorModel !== undefined) update.respiratorModel = parsed.data.respiratorModel;
  if (parsed.data.respiratorSize !== undefined) update.respiratorSize = parsed.data.respiratorSize;
  if (parsed.data.fitFactor !== undefined) update.fitFactor = parsed.data.fitFactor;
  if (parsed.data.passed !== undefined) update.passed = parsed.data.passed;
  if (parsed.data.nextTestDueBy !== undefined)
    update.nextTestDueBy = parsed.data.nextTestDueBy ? new Date(parsed.data.nextTestDueBy) : null;
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;

  await db.update(respiratorFitTests).set(update).where(eq(respiratorFitTests.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'respirator_fit_test',
    entityId: id,
    action: 'updated',
    diffJson: parsed.data as Record<string, unknown>,
  });

  const updated = await db.query.respiratorFitTests.findFirst({ where: eq(respiratorFitTests.id, id) });
  return NextResponse.json({ fitTest: updated });
});

export const DELETE = withPermission('manage_fit_tests', async (_req, user, context) => {
  const { id } = context.params;
  const existing = await db.query.respiratorFitTests.findFirst({ where: scope(user.tpaOrgId, id) });
  if (!existing) return NextResponse.json({ error: 'Fit test not found' }, { status: 404 });

  await db.delete(respiratorFitTests).where(eq(respiratorFitTests.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'respirator_fit_test',
    entityId: id,
    action: 'deleted',
  });

  return NextResponse.json({ ok: true });
});
