import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { randomPools, randomPoolMembers } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const excludeSchema = z.object({
  memberId: z.string().uuid(),
  reason: z.string().min(1).max(255),
});

// POST /api/random/pools/[id]/exclude — mark a member as excluded
export const POST = withPermission('manage_random', async (req, user, context) => {
  const { id } = context.params as { id: string };
  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const pool = await db.query.randomPools.findFirst({
    where: and(eq(randomPools.id, id), eq(randomPools.tpaOrgId, tpaOrgId)),
  });

  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
  }

  if (pool.status !== 'open') {
    return NextResponse.json(
      { error: 'Members can only be excluded in open pools' },
      { status: 409 },
    );
  }

  const body = await req.json();
  const parsed = excludeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 },
    );
  }

  const { memberId, reason } = parsed.data;

  const member = await db.query.randomPoolMembers.findFirst({
    where: and(
      eq(randomPoolMembers.id, memberId),
      eq(randomPoolMembers.poolId, id),
    ),
  });

  if (!member) {
    return NextResponse.json({ error: 'Member not found in this pool' }, { status: 404 });
  }

  await db
    .update(randomPoolMembers)
    .set({
      eligibilityStatus: 'excluded',
      excludeReason: reason,
      excludedAt: new Date(),
    })
    .where(eq(randomPoolMembers.id, memberId));

  // Recalc totalEligible (active only)
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(randomPoolMembers)
    .where(
      and(
        eq(randomPoolMembers.poolId, id),
        eq(randomPoolMembers.eligibilityStatus, 'active'),
      ),
    );
  await db
    .update(randomPools)
    .set({ totalEligible: Number(count), updatedAt: new Date() })
    .where(eq(randomPools.id, id));

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'random_pool_member',
    entityId: memberId,
    action: 'excluded',
    diffJson: { reason, poolId: id, personId: member.personId },
  });

  return NextResponse.json({ success: true, totalEligible: Number(count) });
});
