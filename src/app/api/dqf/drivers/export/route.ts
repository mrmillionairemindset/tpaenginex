import { NextResponse } from 'next/server';
import { db } from '@/db';
import { persons, driverQualifications, complianceScores } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, desc } from 'drizzle-orm';
import { toCsv, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

// GET /api/dqf/drivers/export — CSV export of drivers
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
    whereClause = eq(persons.tpaOrgId, tpaOrgId);
  } else {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  const rows = await db.query.persons.findMany({
    where: whereClause,
    with: {
      driverQualifications: {
        orderBy: [desc(driverQualifications.createdAt)],
      },
      complianceScores: {
        orderBy: [desc(complianceScores.calculatedAt)],
        limit: 1,
      },
    },
    orderBy: [desc(persons.createdAt)],
  });

  const findLatestQual = (quals: any[] | undefined, type: string) => {
    if (!quals) return null;
    return quals.find((q) => q.qualificationType === type) || null;
  };

  const csv = toCsv(rows as any[], [
    { header: 'Name', accessor: (r: any) => `${r.firstName} ${r.lastName}` },
    { header: 'Email', accessor: (r: any) => r.email || '' },
    { header: 'Phone', accessor: (r: any) => r.phone || '' },
    { header: 'DOB', accessor: (r: any) => r.dob || '' },
    {
      header: 'Latest CDL Status',
      accessor: (r: any) => {
        const q = findLatestQual(r.driverQualifications, 'cdl');
        if (!q) return 'Missing';
        return q.expiresAt ? `${q.status} (expires ${new Date(q.expiresAt).toLocaleDateString()})` : q.status;
      },
    },
    {
      header: 'Latest Med Card Status',
      accessor: (r: any) => {
        const q = findLatestQual(r.driverQualifications, 'medical_card');
        if (!q) return 'Missing';
        return q.expiresAt ? `${q.status} (expires ${new Date(q.expiresAt).toLocaleDateString()})` : q.status;
      },
    },
    {
      header: 'Compliance Score',
      accessor: (r: any) => r.complianceScores?.[0]?.score != null ? r.complianceScores[0].score : '',
    },
  ]);

  return csvResponse(csv, `drivers-${Date.now()}.csv`);
});
