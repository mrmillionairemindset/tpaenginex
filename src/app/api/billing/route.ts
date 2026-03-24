import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/billing — list invoices for this TPA
export const GET = withPermission('view_billing', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const invoiceList = await db.query.invoices.findMany({
    where: tpaOrgId ? eq(invoices.tpaOrgId, tpaOrgId) : undefined,
    with: {
      clientOrg: {
        columns: { id: true, name: true },
      },
      lineItems: true,
    },
    orderBy: [desc(invoices.createdAt)],
  });

  return NextResponse.json({ invoices: invoiceList });
});
