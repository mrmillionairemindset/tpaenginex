import { db } from '@/db';
import { orders } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and, desc } from 'drizzle-orm';
import { toCsv, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

// GET /api/orders/export — CSV export of orders (full filtered set, no pagination)
export const GET = withAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  const tpaOrgId = user.tpaOrgId;

  let whereClause;
  if (user.role === 'platform_admin') {
    whereClause = status ? eq(orders.status, status as any) : undefined;
  } else if (isTpaUser && tpaOrgId) {
    const baseWhere = eq(orders.tpaOrgId, tpaOrgId);
    whereClause = status ? and(baseWhere, eq(orders.status, status as any)) : baseWhere;
  } else {
    const baseWhere = eq(orders.orgId, user.organization!.id);
    whereClause = status ? and(baseWhere, eq(orders.status, status as any)) : baseWhere;
  }

  const rows = await db.query.orders.findMany({
    where: whereClause,
    with: {
      person: true,
      organization: { columns: { id: true, name: true, type: true } },
      clientOrg: { columns: { id: true, name: true } },
    },
    orderBy: [desc(orders.createdAt)],
  });

  const csv = toCsv(rows as any[], [
    { header: 'Order #', accessor: (r: any) => r.orderNumber },
    { header: 'Person', accessor: (r: any) => r.person ? `${r.person.firstName} ${r.person.lastName}` : '' },
    { header: 'Client', accessor: (r: any) => r.clientOrg?.name || r.clientLabel || r.organization?.name || '' },
    { header: 'Test Type', accessor: (r: any) => r.testType || '' },
    { header: 'Status', accessor: (r: any) => r.status || '' },
    { header: 'Scheduled For', accessor: (r: any) => r.scheduledFor ? new Date(r.scheduledFor).toISOString() : '' },
    { header: 'Completed At', accessor: (r: any) => r.completedAt ? new Date(r.completedAt).toISOString() : '' },
    { header: 'Created At', accessor: (r: any) => r.createdAt ? new Date(r.createdAt).toISOString() : '' },
  ]);

  return csvResponse(csv, `orders-${Date.now()}.csv`);
});
