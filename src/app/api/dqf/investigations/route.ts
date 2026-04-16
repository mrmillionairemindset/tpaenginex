import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { employerInvestigations, persons } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { notifyInvestigationCreated } from '@/lib/dqf-notifications';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const createInvestigationSchema = z.object({
  personId: z.string().uuid(),
  applicationId: z.string().uuid().optional(),
  employerName: z.string().min(1, 'Employer name is required').max(200),
  contactName: z.string().max(200).optional(),
  contactPhone: z.string().max(30).optional(),
  contactEmail: z.string().email().max(320).optional(),
  contactDate: z.string().datetime().optional(),
  response: z.string().optional(),
  datesOfEmployment: z.string().max(100).optional(),
  positionHeld: z.string().max(100).optional(),
  reasonForLeaving: z.string().max(255).optional(),
  safetyViolations: z.boolean().optional(),
  drugAlcoholViolations: z.boolean().optional(),
  notes: z.string().optional(),
});

// ============================================================================
// GET /api/dqf/investigations - List employer investigations
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
  const personId = searchParams.get('personId');
  const applicationId = searchParams.get('applicationId');
  const tpaOrgId = user.tpaOrgId;

  let whereClause;
  if (user.role === 'platform_admin') {
    whereClause = undefined;
  } else if (tpaOrgId) {
    whereClause = eq(employerInvestigations.tpaOrgId, tpaOrgId);
  } else {
    return NextResponse.json(
      { error: 'TPA organization context required' },
      { status: 400 }
    );
  }

  if (personId) {
    const personFilter = eq(employerInvestigations.personId, personId);
    whereClause = whereClause ? and(whereClause, personFilter) : personFilter;
  }

  if (applicationId) {
    const appFilter = eq(employerInvestigations.applicationId, applicationId);
    whereClause = whereClause ? and(whereClause, appFilter) : appFilter;
  }

  const investigations = await db.query.employerInvestigations.findMany({
    where: whereClause,
    with: {
      person: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      application: {
        columns: {
          id: true,
          status: true,
          position: true,
        },
      },
    },
    orderBy: [desc(employerInvestigations.createdAt)],
  });

  return NextResponse.json({ investigations });
});

// ============================================================================
// POST /api/dqf/investigations - Create employer investigation
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
  const validation = createInvestigationSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

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

  const [investigation] = await db.insert(employerInvestigations).values({
    tpaOrgId,
    personId: data.personId,
    applicationId: data.applicationId || null,
    employerName: data.employerName,
    contactName: data.contactName || null,
    contactPhone: data.contactPhone || null,
    contactEmail: data.contactEmail || null,
    contactDate: data.contactDate ? new Date(data.contactDate) : null,
    response: data.response || null,
    datesOfEmployment: data.datesOfEmployment || null,
    positionHeld: data.positionHeld || null,
    reasonForLeaving: data.reasonForLeaving || null,
    safetyViolations: data.safetyViolations ?? false,
    drugAlcoholViolations: data.drugAlcoholViolations ?? false,
    notes: data.notes || null,
  }).returning();

  const fullInvestigation = await db.query.employerInvestigations.findFirst({
    where: eq(employerInvestigations.id, investigation.id),
    with: {
      person: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      application: {
        columns: {
          id: true,
          status: true,
          position: true,
        },
      },
    },
  });

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'employer_investigation',
    entityId: investigation.id,
    action: 'created',
    diffJson: { personId: data.personId, employerName: data.employerName, applicationId: data.applicationId },
  });

  await notifyInvestigationCreated(investigation.id, data.employerName, tpaOrgId);

  return NextResponse.json(
    { investigation: fullInvestigation, message: 'Investigation created successfully' },
    { status: 201 }
  );
});
