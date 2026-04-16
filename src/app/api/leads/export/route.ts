import { NextResponse } from 'next/server';
import { db } from '@/db';
import { leads } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, desc } from 'drizzle-orm';
import { toCsv, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

// GET /api/leads/export — CSV export of leads for this TPA
export const GET = withPermission('view_leads', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const whereClause = tpaOrgId ? eq(leads.tpaOrgId, tpaOrgId) : undefined;

  const rows = await db.query.leads.findMany({
    where: whereClause,
    orderBy: [desc(leads.createdAt)],
  });

  const csv = toCsv(rows as any[], [
    { header: 'Company Name', accessor: (r: any) => r.companyName || '' },
    { header: 'Contact Name', accessor: (r: any) => r.contactName || '' },
    { header: 'Contact Email', accessor: (r: any) => r.contactEmail || '' },
    { header: 'Contact Phone', accessor: (r: any) => r.contactPhone || '' },
    { header: 'Stage', accessor: (r: any) => r.stage || '' },
    { header: 'Source', accessor: (r: any) => r.source || '' },
    { header: 'Estimated Value', accessor: (r: any) => r.estimatedValue != null ? (r.estimatedValue / 100).toFixed(2) : '' },
    { header: 'Created At', accessor: (r: any) => r.createdAt ? new Date(r.createdAt).toISOString() : '' },
  ]);

  return csvResponse(csv, `leads-${Date.now()}.csv`);
});
