import { NextResponse } from 'next/server';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, desc } from 'drizzle-orm';
import { toCsv, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

// GET /api/billing/export — CSV export of invoices for this TPA
export const GET = withPermission('view_billing', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const whereClause = tpaOrgId ? eq(invoices.tpaOrgId, tpaOrgId) : undefined;

  const rows = await db.query.invoices.findMany({
    where: whereClause,
    with: {
      clientOrg: { columns: { id: true, name: true } },
    },
    orderBy: [desc(invoices.createdAt)],
  });

  const csv = toCsv(rows as any[], [
    { header: 'Invoice #', accessor: (r: any) => r.invoiceNumber || '' },
    { header: 'Client', accessor: (r: any) => r.clientOrg?.name || '' },
    { header: 'Amount', accessor: (r: any) => r.amount != null ? (Number(r.amount) / 100).toFixed(2) : '' },
    { header: 'Status', accessor: (r: any) => r.status || '' },
    { header: 'Due Date', accessor: (r: any) => r.dueDate ? new Date(r.dueDate).toISOString() : '' },
    { header: 'Invoiced At', accessor: (r: any) => r.invoicedAt ? new Date(r.invoicedAt).toISOString() : '' },
    { header: 'Paid At', accessor: (r: any) => r.paidAt ? new Date(r.paidAt).toISOString() : '' },
  ]);

  return csvResponse(csv, `invoices-${Date.now()}.csv`);
});
