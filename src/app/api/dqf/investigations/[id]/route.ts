import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { employerInvestigations } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const updateInvestigationSchema = z.object({
  employerName: z.string().max(200).optional(),
  contactName: z.string().max(200).nullable().optional(),
  contactPhone: z.string().max(30).nullable().optional(),
  contactEmail: z.string().email().max(320).nullable().optional(),
  contactDate: z.string().datetime().nullable().optional(),
  response: z.string().nullable().optional(),
  datesOfEmployment: z.string().max(100).nullable().optional(),
  positionHeld: z.string().max(100).nullable().optional(),
  reasonForLeaving: z.string().max(255).nullable().optional(),
  safetyViolations: z.boolean().optional(),
  drugAlcoholViolations: z.boolean().optional(),
  notes: z.string().nullable().optional(),
});

// ============================================================================
// PATCH /api/dqf/investigations/[id] - Update employer investigation
// ============================================================================

export const PATCH = withAuth(async (req, user, context) => {
  const allowedRoles = ['tpa_admin', 'tpa_staff', 'platform_admin'];
  if (!allowedRoles.includes(user.role!)) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const { id } = context.params;
  const tpaOrgId = user.tpaOrgId;

  const existing = await db.query.employerInvestigations.findFirst({
    where: tpaOrgId
      ? and(eq(employerInvestigations.id, id), eq(employerInvestigations.tpaOrgId, tpaOrgId))
      : eq(employerInvestigations.id, id),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Investigation not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = updateInvestigationSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;
  const updateData: Record<string, any> = { updatedAt: new Date() };

  if (data.employerName !== undefined) updateData.employerName = data.employerName;
  if (data.contactName !== undefined) updateData.contactName = data.contactName;
  if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone;
  if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail;
  if (data.contactDate !== undefined) updateData.contactDate = data.contactDate ? new Date(data.contactDate) : null;
  if (data.response !== undefined) updateData.response = data.response;
  if (data.datesOfEmployment !== undefined) updateData.datesOfEmployment = data.datesOfEmployment;
  if (data.positionHeld !== undefined) updateData.positionHeld = data.positionHeld;
  if (data.reasonForLeaving !== undefined) updateData.reasonForLeaving = data.reasonForLeaving;
  if (data.safetyViolations !== undefined) updateData.safetyViolations = data.safetyViolations;
  if (data.drugAlcoholViolations !== undefined) updateData.drugAlcoholViolations = data.drugAlcoholViolations;
  if (data.notes !== undefined) updateData.notes = data.notes;

  await db.update(employerInvestigations).set(updateData).where(eq(employerInvestigations.id, id));

  const updated = await db.query.employerInvestigations.findFirst({
    where: eq(employerInvestigations.id, id),
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
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'employer_investigation',
    entityId: id,
    action: 'updated',
    diffJson: { ...data },
  });

  return NextResponse.json({ investigation: updated, message: 'Investigation updated successfully' });
});
