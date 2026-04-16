import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { randomPools, randomPoolMembers, persons } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const addMembersSchema = z.object({
  personIds: z.array(z.string().uuid()).min(1),
});

const removeMembersSchema = z.object({
  memberIds: z.array(z.string().uuid()).min(1),
});

async function loadPool(id: string, tpaOrgId?: string | null) {
  return db.query.randomPools.findFirst({
    where: tpaOrgId
      ? and(eq(randomPools.id, id), eq(randomPools.tpaOrgId, tpaOrgId))
      : eq(randomPools.id, id),
  });
}

async function recalcTotalEligible(poolId: string) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(randomPoolMembers)
    .where(
      and(
        eq(randomPoolMembers.poolId, poolId),
        eq(randomPoolMembers.eligibilityStatus, 'active'),
      ),
    );
  await db
    .update(randomPools)
    .set({ totalEligible: Number(count), updatedAt: new Date() })
    .where(eq(randomPools.id, poolId));
  return Number(count);
}

// POST /api/random/pools/[id]/members — add members in bulk
export const POST = withPermission('manage_random', async (req, user, context) => {
  const { id } = context.params as { id: string };
  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const pool = await loadPool(id, tpaOrgId);
  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
  }

  if (pool.status !== 'open') {
    return NextResponse.json(
      { error: 'Members can only be added to open pools' },
      { status: 409 },
    );
  }

  const body = await req.json();
  const parsed = addMembersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 },
    );
  }

  const { personIds } = parsed.data;

  // Verify all persons belong to this TPA
  const validPersons = await db.query.persons.findMany({
    where: and(
      inArray(persons.id, personIds),
      eq(persons.tpaOrgId, tpaOrgId),
    ),
    columns: { id: true },
  });
  const validSet = new Set(validPersons.map((p) => p.id));
  const toInsert = personIds.filter((pid) => validSet.has(pid));

  if (toInsert.length === 0) {
    return NextResponse.json(
      { error: 'No valid persons for this TPA' },
      { status: 400 },
    );
  }

  // Find existing members in this pool to skip duplicates
  const existing = await db.query.randomPoolMembers.findMany({
    where: and(
      eq(randomPoolMembers.poolId, id),
      inArray(randomPoolMembers.personId, toInsert),
    ),
    columns: { personId: true },
  });
  const existingSet = new Set(existing.map((m) => m.personId));
  const newPersonIds = toInsert.filter((pid) => !existingSet.has(pid));

  if (newPersonIds.length > 0) {
    await db.insert(randomPoolMembers).values(
      newPersonIds.map((personId) => ({
        poolId: id,
        personId,
      })),
    );
  }

  const totalEligible = await recalcTotalEligible(id);

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'random_pool',
    entityId: id,
    action: 'members_added',
    diffJson: {
      requestedCount: personIds.length,
      addedCount: newPersonIds.length,
      skippedCount: personIds.length - newPersonIds.length,
    },
  });

  return NextResponse.json({
    added: newPersonIds.length,
    skipped: personIds.length - newPersonIds.length,
    totalEligible,
  });
});

// DELETE /api/random/pools/[id]/members — remove members (open pools only)
export const DELETE = withPermission('manage_random', async (req, user, context) => {
  const { id } = context.params as { id: string };
  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const pool = await loadPool(id, tpaOrgId);
  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
  }

  if (pool.status !== 'open') {
    return NextResponse.json(
      { error: 'Members can only be removed from open pools' },
      { status: 409 },
    );
  }

  const body = await req.json();
  const parsed = removeMembersSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 },
    );
  }

  const { memberIds } = parsed.data;

  const result = await db
    .delete(randomPoolMembers)
    .where(
      and(
        eq(randomPoolMembers.poolId, id),
        inArray(randomPoolMembers.id, memberIds),
      ),
    )
    .returning({ id: randomPoolMembers.id });

  const totalEligible = await recalcTotalEligible(id);

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'random_pool',
    entityId: id,
    action: 'members_removed',
    diffJson: { removedCount: result.length },
  });

  return NextResponse.json({ removed: result.length, totalEligible });
});
