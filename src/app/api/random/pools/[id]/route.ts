import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { randomPools, randomPoolMembers, randomSelections, persons } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function scopedWhere(id: string, tpaOrgId?: string | null) {
  return tpaOrgId
    ? and(eq(randomPools.id, id), eq(randomPools.tpaOrgId, tpaOrgId))
    : eq(randomPools.id, id);
}

// GET /api/random/pools/[id] — pool with members + selections
export const GET = withPermission('view_random', async (req, user, context) => {
  const { id } = context.params as { id: string };
  const tpaOrgId = user.tpaOrgId;

  const pool = await db.query.randomPools.findFirst({
    where: scopedWhere(id, tpaOrgId),
    with: {
      program: true,
      selectedByUser: { columns: { id: true, name: true, email: true } },
    },
  });

  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
  }

  const members = await db.query.randomPoolMembers.findMany({
    where: eq(randomPoolMembers.poolId, id),
    with: {
      person: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
    orderBy: [desc(randomPoolMembers.addedAt)],
  });

  const selections = await db.query.randomSelections.findMany({
    where: eq(randomSelections.poolId, id),
    with: {
      person: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
    orderBy: [desc(randomSelections.createdAt)],
  });

  return NextResponse.json({ pool, members, selections });
});
