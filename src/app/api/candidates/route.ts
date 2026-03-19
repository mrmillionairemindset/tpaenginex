import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { candidates } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and, or, ilike, desc } from 'drizzle-orm';
import { z } from 'zod';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const createCandidateSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dob: z.string().optional(),
  ssn: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().max(2).optional(),
  zip: z.string().optional(),
  meta: z.record(z.any()).optional(),
});

// ============================================================================
// GET /api/candidates - List candidates
// ============================================================================

export const GET = withAuth(async (req, user) => {
  // Only employers can access candidates (their own)
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');

  let whereClause = eq(candidates.orgId, user.organization!.id);

  // Add search filter if provided
  if (search) {
    const searchPattern = `%${search}%`;
    whereClause = and(
      whereClause,
      or(
        ilike(candidates.firstName, searchPattern),
        ilike(candidates.lastName, searchPattern),
        ilike(candidates.email, searchPattern),
        ilike(candidates.phone, searchPattern)
      )
    ) as any;
  }

  const candidatesList = await db.query.candidates.findMany({
    where: whereClause,
    with: {
      orders: {
        columns: {
          id: true,
          orderNumber: true,
          status: true,
          testType: true,
          createdAt: true,
        },
        orderBy: (orders, { desc }) => [desc(orders.createdAt)],
        limit: 5, // Last 5 orders per candidate
      },
    },
    orderBy: [desc(candidates.createdAt)],
  });

  // Add _count field for compatibility with UI components
  const formattedCandidates = candidatesList.map((candidate) => ({
    ...candidate,
    _count: {
      orders: candidate.orders?.length || 0,
    },
  }));

  return NextResponse.json({ candidates: formattedCandidates });
});

// ============================================================================
// POST /api/candidates - Create candidate
// ============================================================================

export const POST = withAuth(async (req, user) => {
  // Only employers can create candidates
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const validation = createCandidateSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Check for duplicate candidate (same first name, last name, and DOB or email)
  if (data.email || data.dob) {
    let duplicateWhere = and(
      eq(candidates.orgId, user.organization!.id),
      eq(candidates.firstName, data.firstName),
      eq(candidates.lastName, data.lastName)
    );

    if (data.email) {
      duplicateWhere = and(duplicateWhere, eq(candidates.email, data.email)) as any;
    } else if (data.dob) {
      duplicateWhere = and(duplicateWhere, eq(candidates.dob, data.dob)) as any;
    }

    const existingCandidate = await db.query.candidates.findFirst({
      where: duplicateWhere,
    });

    if (existingCandidate) {
      return NextResponse.json(
        {
          error: 'A candidate with this name and email/DOB already exists',
          candidateId: existingCandidate.id,
        },
        { status: 409 }
      );
    }
  }

  // Create candidate
  const [newCandidate] = await db.insert(candidates).values({
    orgId: user.organization!.id,
    firstName: data.firstName,
    lastName: data.lastName,
    dob: data.dob,
    ssnLast4: data.ssn,
    phone: data.phone,
    email: data.email,
    address: data.address,
    city: data.city,
    state: data.state,
    zip: data.zip,
    meta: data.meta,
  }).returning();

  return NextResponse.json(
    { candidate: newCandidate, message: 'Candidate created successfully' },
    { status: 201 }
  );
});
