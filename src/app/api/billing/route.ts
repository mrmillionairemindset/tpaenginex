import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, desc, count } from 'drizzle-orm';
import { parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

// GET /api/billing — list invoices for this TPA
export const GET = withPermission('view_billing', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const { page, limit, offset } = parsePagination(searchParams);
  const whereClause = tpaOrgId ? eq(invoices.tpaOrgId, tpaOrgId) : undefined;

  const [invoiceList, [{ count: total }]] = await Promise.all([
    db.query.invoices.findMany({
      where: whereClause,
      with: {
        clientOrg: {
          columns: { id: true, name: true },
        },
        lineItems: true,
      },
      orderBy: [desc(invoices.createdAt)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(invoices).where(whereClause),
  ]);

  return NextResponse.json({
    invoices: invoiceList,
    pagination: {
      page,
      limit,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / limit),
      hasMore: offset + invoiceList.length < Number(total),
    },
  });
});
