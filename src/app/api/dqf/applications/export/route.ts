import { NextResponse } from 'next/server';
import { db } from '@/db';
import { driverApplications } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, desc } from 'drizzle-orm';
import { toCsv, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

// GET /api/dqf/applications/export — CSV export of driver applications
export const GET = withAuth(async (req, user) => {
  const allowedRoles = ['tpa_admin', 'tpa_staff', 'platform_admin'];
  if (!allowedRoles.includes(user.role!)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const tpaOrgId = user.tpaOrgId;
  let whereClause;
  if (user.role === 'platform_admin') {
    whereClause = undefined;
  } else if (tpaOrgId) {
    whereClause = eq(driverApplications.tpaOrgId, tpaOrgId);
  } else {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  const rows = await db.query.driverApplications.findMany({
    where: whereClause,
    with: {
      person: { columns: { firstName: true, lastName: true } },
      clientOrg: { columns: { id: true, name: true } },
    },
    orderBy: [desc(driverApplications.createdAt)],
  });

  const csv = toCsv(rows as any[], [
    { header: 'Applicant', accessor: (r: any) => r.person ? `${r.person.firstName} ${r.person.lastName}` : '' },
    { header: 'Client', accessor: (r: any) => r.clientOrg?.name || '' },
    { header: 'Position', accessor: (r: any) => r.position || '' },
    { header: 'CDL Class', accessor: (r: any) => r.cdlClass || '' },
    { header: 'CDL State', accessor: (r: any) => r.cdlState || '' },
    { header: 'Status', accessor: (r: any) => r.status || '' },
    { header: 'Application Date', accessor: (r: any) => r.applicationDate ? new Date(r.applicationDate).toISOString() : '' },
  ]);

  return csvResponse(csv, `applications-${Date.now()}.csv`);
});
