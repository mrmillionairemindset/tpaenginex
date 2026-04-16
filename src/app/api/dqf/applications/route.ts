import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { driverApplications, persons } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and, desc, count } from 'drizzle-orm';
import { parsePagination } from '@/lib/pagination';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const createApplicationSchema = z.object({
  // Existing person or create inline
  personId: z.string().uuid().optional(),
  person: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    dob: z.string().optional(),
    ssnLast4: z.string().max(4).optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    city: z.string().optional(),
    state: z.string().max(2).optional(),
    zip: z.string().optional(),
  }).optional(),
  clientOrgId: z.string().uuid().optional(),
  applicationDate: z.string().datetime().optional(),
  status: z.enum(['submitted', 'under_review', 'approved', 'rejected', 'withdrawn']).optional(),
  previousEmployerContact: z.any().optional(),
  position: z.string().max(100).optional(),
  cdlNumber: z.string().max(50).optional(),
  cdlState: z.string().max(2).optional(),
  cdlClass: z.string().max(5).optional(),
  endorsements: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

// ============================================================================
// GET /api/dqf/applications - List driver applications
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
  const status = searchParams.get('status');
  const clientOrgId = searchParams.get('clientOrgId');
  const personId = searchParams.get('personId');
  const tpaOrgId = user.tpaOrgId;
  const { page, limit, offset } = parsePagination(searchParams);

  let whereClause;
  if (user.role === 'platform_admin') {
    whereClause = undefined;
  } else if (tpaOrgId) {
    whereClause = eq(driverApplications.tpaOrgId, tpaOrgId);
  } else {
    return NextResponse.json(
      { error: 'TPA organization context required' },
      { status: 400 }
    );
  }

  if (status) {
    const statusFilter = eq(driverApplications.status, status as any);
    whereClause = whereClause ? and(whereClause, statusFilter) : statusFilter;
  }

  if (clientOrgId) {
    const clientFilter = eq(driverApplications.clientOrgId, clientOrgId);
    whereClause = whereClause ? and(whereClause, clientFilter) : clientFilter;
  }

  if (personId) {
    const personFilter = eq(driverApplications.personId, personId);
    whereClause = whereClause ? and(whereClause, personFilter) : personFilter;
  }

  const [applications, [{ count: total }]] = await Promise.all([
    db.query.driverApplications.findMany({
      where: whereClause,
      with: {
        person: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        clientOrg: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [desc(driverApplications.createdAt)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(driverApplications).where(whereClause),
  ]);

  return NextResponse.json({
    applications,
    pagination: {
      page,
      limit,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / limit),
      hasMore: offset + applications.length < Number(total),
    },
  });
});

// ============================================================================
// POST /api/dqf/applications - Create driver application
// ============================================================================

export const POST = withAuth(async (req, user) => {
  const allowedRoles = ['tpa_admin', 'tpa_staff', 'platform_admin'];
  if (!allowedRoles.includes(user.role!)) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json(
      { error: 'TPA organization context required' },
      { status: 400 }
    );
  }

  const body = await req.json();
  const validation = createApplicationSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Determine or create person
  let personId: string;

  if (data.personId) {
    // Verify person belongs to this TPA
    const existingPerson = await db.query.persons.findFirst({
      where: and(
        eq(persons.id, data.personId),
        eq(persons.tpaOrgId, tpaOrgId)
      ),
    });

    if (!existingPerson) {
      return NextResponse.json(
        { error: 'Person not found' },
        { status: 404 }
      );
    }

    personId = existingPerson.id;
  } else if (data.person) {
    // Create new person scoped to TPA
    const [newPerson] = await db.insert(persons).values({
      orgId: user.organization!.id,
      tpaOrgId,
      firstName: data.person.firstName,
      lastName: data.person.lastName,
      dob: data.person.dob || '01/01/1900',
      ssnLast4: data.person.ssnLast4 || '0000',
      phone: data.person.phone || '',
      email: data.person.email || '',
      address: data.person.address,
      city: data.person.city,
      state: data.person.state,
      zip: data.person.zip,
    }).returning();

    personId = newPerson.id;
  } else {
    return NextResponse.json(
      { error: 'Either personId or person data must be provided' },
      { status: 400 }
    );
  }

  const [application] = await db.insert(driverApplications).values({
    tpaOrgId,
    personId,
    clientOrgId: data.clientOrgId || null,
    applicationDate: data.applicationDate ? new Date(data.applicationDate) : new Date(),
    status: data.status || 'submitted',
    previousEmployerContact: data.previousEmployerContact || null,
    position: data.position || null,
    cdlNumber: data.cdlNumber || null,
    cdlState: data.cdlState || null,
    cdlClass: data.cdlClass || null,
    endorsements: data.endorsements || null,
    notes: data.notes || null,
  }).returning();

  // Fetch full application with relations
  const fullApplication = await db.query.driverApplications.findFirst({
    where: eq(driverApplications.id, application.id),
    with: {
      person: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      clientOrg: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'driver_application',
    entityId: application.id,
    action: 'created',
    diffJson: { personId, clientOrgId: data.clientOrgId, status: data.status || 'submitted', position: data.position },
  });

  return NextResponse.json(
    { application: fullApplication, message: 'Application created successfully' },
    { status: 201 }
  );
});
