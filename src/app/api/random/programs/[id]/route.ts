import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { randomPrograms, randomPools } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const updateProgramSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  clientOrgId: z.string().uuid().nullable().optional(),
  drugTestRateBp: z.number().int().min(0).max(20000).optional(),
  alcoholTestRateBp: z.number().int().min(0).max(20000).optional(),
  periodType: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

function scopedWhere(id: string, tpaOrgId?: string | null) {
  return tpaOrgId
    ? and(eq(randomPrograms.id, id), eq(randomPrograms.tpaOrgId, tpaOrgId))
    : eq(randomPrograms.id, id);
}

// GET /api/random/programs/[id]
export const GET = withPermission('view_random', async (req, user, context) => {
  const { id } = context.params as { id: string };
  const tpaOrgId = user.tpaOrgId;

  const program = await db.query.randomPrograms.findFirst({
    where: scopedWhere(id, tpaOrgId),
    with: {
      clientOrg: { columns: { id: true, name: true } },
    },
  });

  if (!program) {
    return NextResponse.json({ error: 'Program not found' }, { status: 404 });
  }

  const pools = await db.query.randomPools.findMany({
    where: eq(randomPools.programId, id),
    orderBy: [desc(randomPools.periodStartsAt)],
  });

  return NextResponse.json({ program, pools });
});

// PATCH /api/random/programs/[id]
export const PATCH = withPermission('manage_random', async (req, user, context) => {
  const { id } = context.params as { id: string };
  const tpaOrgId = user.tpaOrgId;

  const existing = await db.query.randomPrograms.findFirst({
    where: scopedWhere(id, tpaOrgId),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Program not found' }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateProgramSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const update: Record<string, any> = { updatedAt: new Date() };

  if (data.name !== undefined) update.name = data.name;
  if (data.clientOrgId !== undefined) update.clientOrgId = data.clientOrgId;
  if (data.drugTestRateBp !== undefined) update.drugTestRate = data.drugTestRateBp;
  if (data.alcoholTestRateBp !== undefined) update.alcoholTestRate = data.alcoholTestRateBp;
  if (data.periodType !== undefined) update.periodType = data.periodType;
  if (data.isActive !== undefined) update.isActive = data.isActive;
  if (data.notes !== undefined) update.notes = data.notes;

  await db.update(randomPrograms).set(update).where(eq(randomPrograms.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'random_program',
    entityId: id,
    action: 'updated',
    diffJson: { ...data },
  });

  const updated = await db.query.randomPrograms.findFirst({
    where: eq(randomPrograms.id, id),
  });

  return NextResponse.json({ program: updated });
});

// DELETE /api/random/programs/[id] — soft delete (set isActive=false)
export const DELETE = withPermission('manage_random', async (req, user, context) => {
  const { id } = context.params as { id: string };
  const tpaOrgId = user.tpaOrgId;

  const existing = await db.query.randomPrograms.findFirst({
    where: scopedWhere(id, tpaOrgId),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Program not found' }, { status: 404 });
  }

  await db
    .update(randomPrograms)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(randomPrograms.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'random_program',
    entityId: id,
    action: 'soft_deleted',
    diffJson: { isActive: false },
  });

  return NextResponse.json({ success: true });
});
