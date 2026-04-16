import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { complianceScores } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/dqf/compliance - List compliance scores
// ============================================================================

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowedRoles = ['tpa_admin', 'tpa_staff', 'tpa_records', 'platform_admin'];
  if (!allowedRoles.includes(user.role || '')) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  const tpaOrgId = user.tpaOrgId;
  const { searchParams } = new URL(req.url);
  const personId = searchParams.get('personId');
  const clientOrgId = searchParams.get('clientOrgId');

  const conditions = [];
  if (tpaOrgId) conditions.push(eq(complianceScores.tpaOrgId, tpaOrgId));
  if (personId) conditions.push(eq(complianceScores.personId, personId));
  if (clientOrgId) conditions.push(eq(complianceScores.clientOrgId, clientOrgId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const scores = await db.query.complianceScores.findMany({
    where: whereClause,
    with: {
      person: {
        columns: { id: true, firstName: true, lastName: true, email: true },
      },
      clientOrg: { columns: { id: true, name: true } },
    },
    orderBy: [desc(complianceScores.calculatedAt)],
  });

  return NextResponse.json({ scores });
}
