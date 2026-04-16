import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { driverQualifications } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const updateQualificationSchema = z.object({
  qualificationType: z.string().max(50).optional(),
  issuedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  documentId: z.string().uuid().nullable().optional(),
  status: z.enum(['active', 'expiring_soon', 'expired', 'pending_verification', 'revoked']).optional(),
  issuingAuthority: z.string().max(100).nullable().optional(),
  referenceNumber: z.string().max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
});

// ============================================================================
// PATCH /api/dqf/qualifications/[id] - Update qualification
// ============================================================================

export const PATCH = withAuth(async (req, user, context) => {
  const allowedRoles = ['tpa_admin', 'tpa_staff', 'tpa_records', 'platform_admin'];
  if (!allowedRoles.includes(user.role!)) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const { id } = context.params;
  const tpaOrgId = user.tpaOrgId;

  const existing = await db.query.driverQualifications.findFirst({
    where: tpaOrgId
      ? and(eq(driverQualifications.id, id), eq(driverQualifications.tpaOrgId, tpaOrgId))
      : eq(driverQualifications.id, id),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Qualification not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = updateQualificationSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;
  const updateData: Record<string, any> = { updatedAt: new Date() };

  if (data.qualificationType !== undefined) updateData.qualificationType = data.qualificationType;
  if (data.issuedAt !== undefined) updateData.issuedAt = data.issuedAt ? new Date(data.issuedAt) : null;
  if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  if (data.documentId !== undefined) updateData.documentId = data.documentId;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.issuingAuthority !== undefined) updateData.issuingAuthority = data.issuingAuthority;
  if (data.referenceNumber !== undefined) updateData.referenceNumber = data.referenceNumber;
  if (data.notes !== undefined) updateData.notes = data.notes;

  await db.update(driverQualifications).set(updateData).where(eq(driverQualifications.id, id));

  const updated = await db.query.driverQualifications.findFirst({
    where: eq(driverQualifications.id, id),
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
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'driver_qualification',
    entityId: id,
    action: 'updated',
    diffJson: { ...data },
  });

  return NextResponse.json({ qualification: updated, message: 'Qualification updated successfully' });
});

// ============================================================================
// DELETE /api/dqf/qualifications/[id] - Remove qualification
// ============================================================================

export const DELETE = withAuth(async (req, user, context) => {
  const allowedRoles = ['tpa_admin', 'tpa_staff', 'tpa_records', 'platform_admin'];
  if (!allowedRoles.includes(user.role!)) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const { id } = context.params;
  const tpaOrgId = user.tpaOrgId;

  const existing = await db.query.driverQualifications.findFirst({
    where: tpaOrgId
      ? and(eq(driverQualifications.id, id), eq(driverQualifications.tpaOrgId, tpaOrgId))
      : eq(driverQualifications.id, id),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Qualification not found' }, { status: 404 });
  }

  await db.delete(driverQualifications).where(eq(driverQualifications.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'driver_qualification',
    entityId: id,
    action: 'deleted',
    diffJson: { qualificationType: existing.qualificationType, personId: existing.personId },
  });

  return NextResponse.json({ message: 'Qualification deleted successfully' });
});
