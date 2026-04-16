import { NextResponse } from 'next/server';
import { withAuth } from '@/auth/api-middleware';
import { db } from '@/db';
import { complianceScores } from '@/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { toCsv, csvResponse } from '@/lib/csv';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/dqf/compliance/export - CSV export of compliance scores
// ============================================================================

export const GET = withAuth(async (req, user) => {
  const allowedRoles = ['tpa_admin', 'tpa_staff', 'tpa_records', 'platform_admin'];
  if (!allowedRoles.includes(user.role ?? '')) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    );
  }

  if (!user.tpaOrgId) {
    return NextResponse.json(
      { error: 'Tenant context required' },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(req.url);
  const clientOrgId = searchParams.get('clientOrgId');

  const conditions = [eq(complianceScores.tpaOrgId, user.tpaOrgId)];
  if (clientOrgId) conditions.push(eq(complianceScores.clientOrgId, clientOrgId));

  const scores = await db.query.complianceScores.findMany({
    where: and(...conditions),
    with: {
      person: { columns: { id: true, firstName: true, lastName: true } },
      clientOrg: { columns: { id: true, name: true } },
    },
    orderBy: [desc(complianceScores.calculatedAt)],
  });

  const csv = toCsv(scores as any[], [
    {
      header: 'Driver Name',
      accessor: (r: any) =>
        r.person ? `${r.person.firstName} ${r.person.lastName}` : '',
    },
    {
      header: 'Client',
      accessor: (r: any) => r.clientOrg?.name || '',
    },
    {
      header: 'Score',
      accessor: (r: any) => (r.score != null ? `${r.score}%` : ''),
    },
    {
      header: 'Last Calculated',
      accessor: (r: any) =>
        r.calculatedAt ? new Date(r.calculatedAt).toISOString() : '',
    },
  ]);

  const date = new Date().toISOString().slice(0, 10);
  return csvResponse(csv, `compliance-report-${date}.csv`);
});
