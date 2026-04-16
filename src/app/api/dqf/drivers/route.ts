import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { persons, driverQualifications, complianceScores, driverApplications } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and, desc, or, ilike, count } from 'drizzle-orm';
import { parsePagination } from '@/lib/pagination';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/dqf/drivers - List persons with DQF context
// ============================================================================

export const GET = withAuth(async (req, user) => {
  const allowedRoles = ['tpa_admin', 'tpa_staff', 'platform_admin'];
  if (!allowedRoles.includes(user.role!)) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');
  const clientOrgId = searchParams.get('clientOrgId');
  const tpaOrgId = user.tpaOrgId;
  const { page, limit, offset } = parsePagination(searchParams);

  // Build where clause for persons scoped to TPA
  let whereClause;
  if (user.role === 'platform_admin') {
    whereClause = undefined;
  } else if (tpaOrgId) {
    whereClause = eq(persons.tpaOrgId, tpaOrgId);
  } else {
    return NextResponse.json(
      { error: 'TPA organization context required' },
      { status: 400 }
    );
  }

  if (search) {
    const searchPattern = `%${search}%`;
    const searchFilter = or(
      ilike(persons.firstName, searchPattern),
      ilike(persons.lastName, searchPattern),
      ilike(persons.email, searchPattern),
      ilike(persons.phone, searchPattern)
    );
    whereClause = whereClause ? and(whereClause, searchFilter) : searchFilter;
  }

  if (clientOrgId) {
    const clientFilter = eq(persons.orgId, clientOrgId);
    whereClause = whereClause ? and(whereClause, clientFilter) : clientFilter;
  }

  const [personsList, [{ count: total }]] = await Promise.all([
    db.query.persons.findMany({
      where: whereClause,
      with: {
        driverQualifications: {
          orderBy: [desc(driverQualifications.createdAt)],
        },
        driverApplications: {
          orderBy: [desc(driverApplications.createdAt)],
          limit: 1,
        },
        complianceScores: {
          orderBy: [desc(complianceScores.calculatedAt)],
          limit: 1,
        },
      },
      orderBy: [desc(persons.createdAt)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(persons).where(whereClause),
  ]);

  const drivers = personsList.map((person: any) => ({
    ...person,
    latestApplication: person.driverApplications?.[0] || null,
    latestComplianceScore: person.complianceScores?.[0] || null,
    qualificationCount: person.driverQualifications?.length || 0,
  }));

  return NextResponse.json({
    drivers,
    pagination: {
      page,
      limit,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / limit),
      hasMore: offset + drivers.length < Number(total),
    },
  });
});
