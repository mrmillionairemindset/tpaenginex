import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, orders, organizationMembers, users } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and, desc, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/clients/[id] — get client org detail with orders, members, stats
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  if (!isTpaUser) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  // Fetch the client org
  const clientOrg = await db.query.organizations.findFirst({
    where: tpaOrgId
      ? and(eq(organizations.id, id), eq(organizations.tpaOrgId, tpaOrgId))
      : eq(organizations.id, id),
  });

  if (!clientOrg || clientOrg.type !== 'client') {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // Fetch members
  const members = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.organizationId, id),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
        },
      },
    },
  });

  // Fetch recent orders
  const recentOrders = await db.query.orders.findMany({
    where: eq(orders.orgId, id),
    with: {
      candidate: {
        columns: { firstName: true, lastName: true },
      },
    },
    orderBy: [desc(orders.createdAt)],
    limit: 20,
  });

  // Count stats
  const [totalOrders] = await db.select({ count: count() }).from(orders).where(eq(orders.orgId, id));
  const [openOrders] = await db.select({ count: count() }).from(orders).where(
    and(eq(orders.orgId, id), eq(orders.status, 'new'))
  );
  const [completedOrders] = await db.select({ count: count() }).from(orders).where(
    and(eq(orders.orgId, id), eq(orders.status, 'complete'))
  );

  return NextResponse.json({
    client: clientOrg,
    members: members.map(m => ({
      id: m.id,
      role: m.role,
      isActive: m.isActive,
      user: m.user,
    })),
    recentOrders,
    stats: {
      totalOrders: totalOrders?.count || 0,
      openOrders: openOrders?.count || 0,
      completedOrders: completedOrders?.count || 0,
      totalUsers: members.length,
    },
  });
}
