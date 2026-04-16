import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { driverQualifications, persons } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const createQualificationSchema = z.object({
  personId: z.string().uuid(),
  qualificationType: z.string().min(1, 'Qualification type is required').max(50),
  issuedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  documentId: z.string().uuid().optional(),
  status: z.enum(['active', 'expiring_soon', 'expired', 'pending_verification', 'revoked']).optional(),
  issuingAuthority: z.string().max(100).optional(),
  referenceNumber: z.string().max(100).optional(),
  notes: z.string().optional(),
});

// ============================================================================
// GET /api/dqf/qualifications - List qualifications
// ============================================================================

export const GET = withAuth(async (req, user) => {
  const allowedRoles = ['tpa_admin', 'tpa_staff', 'tpa_records', 'platform_admin'];
  if (!allowedRoles.includes(user.role!)) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const personId = searchParams.get('personId');
  const qualificationType = searchParams.get('qualificationType');
  const status = searchParams.get('status');
  const tpaOrgId = user.tpaOrgId;

  let whereClause;
  if (user.role === 'platform_admin') {
    whereClause = undefined;
  } else if (tpaOrgId) {
    whereClause = eq(driverQualifications.tpaOrgId, tpaOrgId);
  } else {
    return NextResponse.json(
      { error: 'TPA organization context required' },
      { status: 400 }
    );
  }

  if (personId) {
    const personFilter = eq(driverQualifications.personId, personId);
    whereClause = whereClause ? and(whereClause, personFilter) : personFilter;
  }

  if (qualificationType) {
    const typeFilter = eq(driverQualifications.qualificationType, qualificationType);
    whereClause = whereClause ? and(whereClause, typeFilter) : typeFilter;
  }

  if (status) {
    const statusFilter = eq(driverQualifications.status, status as any);
    whereClause = whereClause ? and(whereClause, statusFilter) : statusFilter;
  }

  const qualifications = await db.query.driverQualifications.findMany({
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
    },
    orderBy: [desc(driverQualifications.createdAt)],
  });

  return NextResponse.json({ qualifications });
});

// ============================================================================
// POST /api/dqf/qualifications - Create qualification
// ============================================================================

export const POST = withAuth(async (req, user) => {
  const allowedRoles = ['tpa_admin', 'tpa_staff', 'tpa_records', 'platform_admin'];
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
  const validation = createQualificationSchema.safeParse(body);

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

  const [qualification] = await db.insert(driverQualifications).values({
    tpaOrgId,
    personId: data.personId,
    qualificationType: data.qualificationType,
    issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
    expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    documentId: data.documentId || null,
    status: data.status || 'active',
    issuingAuthority: data.issuingAuthority || null,
    referenceNumber: data.referenceNumber || null,
    notes: data.notes || null,
  }).returning();

  const fullQualification = await db.query.driverQualifications.findFirst({
    where: eq(driverQualifications.id, qualification.id),
    with: {
      person: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'driver_qualification',
    entityId: qualification.id,
    action: 'created',
    diffJson: { personId: data.personId, qualificationType: data.qualificationType, status: data.status || 'active' },
  });

  return NextResponse.json(
    { qualification: fullQualification, message: 'Qualification created successfully' },
    { status: 201 }
  );
});
