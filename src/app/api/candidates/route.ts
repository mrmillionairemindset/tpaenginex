import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { persons } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and, or, ilike, desc, count } from 'drizzle-orm';
import { parsePagination } from '@/lib/pagination';
import { z } from 'zod';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const createPersonSchema = z.object({
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
// GET /api/candidates - List persons
// ============================================================================

export const GET = withAuth(async (req, user) => {
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search');
  const { page, limit, offset } = parsePagination(searchParams);

  let whereClause = eq(persons.orgId, user.organization!.id);

  if (search) {
    const searchPattern = `%${search}%`;
    whereClause = and(
      whereClause,
      or(
        ilike(persons.firstName, searchPattern),
        ilike(persons.lastName, searchPattern),
        ilike(persons.email, searchPattern),
        ilike(persons.phone, searchPattern)
      )
    ) as any;
  }

  const [personsList, [{ count: total }]] = await Promise.all([
    db.query.persons.findMany({
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
          limit: 5,
        },
      },
      orderBy: [desc(persons.createdAt)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(persons).where(whereClause),
  ]);

  const formattedPersons = personsList.map((person) => ({
    ...person,
    _count: {
      orders: person.orders?.length || 0,
    },
  }));

  return NextResponse.json({
    persons: formattedPersons,
    pagination: {
      page,
      limit,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / limit),
      hasMore: offset + formattedPersons.length < Number(total),
    },
  });
});

// ============================================================================
// POST /api/candidates - Create person
// ============================================================================

export const POST = withAuth(async (req, user) => {
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const validation = createPersonSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Check for duplicate person (same first name, last name, and DOB or email)
  if (data.email || data.dob) {
    let duplicateWhere = and(
      eq(persons.orgId, user.organization!.id),
      eq(persons.firstName, data.firstName),
      eq(persons.lastName, data.lastName)
    );

    if (data.email) {
      duplicateWhere = and(duplicateWhere, eq(persons.email, data.email)) as any;
    } else if (data.dob) {
      duplicateWhere = and(duplicateWhere, eq(persons.dob, data.dob)) as any;
    }

    const existingPerson = await db.query.persons.findFirst({
      where: duplicateWhere,
    });

    if (existingPerson) {
      return NextResponse.json(
        {
          error: 'A person with this name and email/DOB already exists',
          personId: existingPerson.id,
        },
        { status: 409 }
      );
    }
  }

  const orgId = user.orgId ?? user.tpaOrgId;
  if (!orgId || !user.tpaOrgId) {
    return NextResponse.json({ error: 'No organization context' }, { status: 400 });
  }

  const [newPerson] = await db.insert(persons).values({
    orgId,
    tpaOrgId: user.tpaOrgId,
    personType: 'candidate',
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
  } as typeof persons.$inferInsert).returning();

  return NextResponse.json(
    { person: newPerson, message: 'Person created successfully' },
    { status: 201 }
  );
});
