import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { driverApplications } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { notifyApplicationStatusChange } from '@/lib/dqf-notifications';
import { enqueueWebhookEvent } from '@/lib/webhooks';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const updateApplicationSchema = z.object({
  status: z.enum(['submitted', 'under_review', 'approved', 'rejected', 'withdrawn']).optional(),
  clientOrgId: z.string().uuid().optional(),
  previousEmployerContact: z.any().optional(),
  position: z.string().max(100).optional(),
  cdlNumber: z.string().max(50).optional(),
  cdlState: z.string().max(2).optional(),
  cdlClass: z.string().max(5).optional(),
  endorsements: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

// ============================================================================
// GET /api/dqf/applications/[id] - Get single application with investigations
// ============================================================================

export const GET = withAuth(async (req, user, context) => {
  const allowedRoles = ['tpa_admin', 'tpa_staff', 'tpa_records', 'platform_admin'];
  if (!allowedRoles.includes(user.role!)) {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const { id } = context.params;
  const tpaOrgId = user.tpaOrgId;

  const application = await db.query.driverApplications.findFirst({
    where: tpaOrgId
      ? and(eq(driverApplications.id, id), eq(driverApplications.tpaOrgId, tpaOrgId))
      : eq(driverApplications.id, id),
    with: {
      person: true,
      clientOrg: {
        columns: {
          id: true,
          name: true,
        },
      },
      investigations: true,
    },
  });

  if (!application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  return NextResponse.json({ application });
});

// ============================================================================
// PATCH /api/dqf/applications/[id] - Update application
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

  const existing = await db.query.driverApplications.findFirst({
    where: tpaOrgId
      ? and(eq(driverApplications.id, id), eq(driverApplications.tpaOrgId, tpaOrgId))
      : eq(driverApplications.id, id),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = updateApplicationSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;
  const updateData: Record<string, any> = { updatedAt: new Date() };

  if (data.status) updateData.status = data.status;
  if (data.clientOrgId) updateData.clientOrgId = data.clientOrgId;
  if (data.previousEmployerContact !== undefined) updateData.previousEmployerContact = data.previousEmployerContact;
  if (data.position !== undefined) updateData.position = data.position;
  if (data.cdlNumber !== undefined) updateData.cdlNumber = data.cdlNumber;
  if (data.cdlState !== undefined) updateData.cdlState = data.cdlState;
  if (data.cdlClass !== undefined) updateData.cdlClass = data.cdlClass;
  if (data.endorsements !== undefined) updateData.endorsements = data.endorsements;
  if (data.notes !== undefined) updateData.notes = data.notes;

  await db.update(driverApplications).set(updateData).where(eq(driverApplications.id, id));

  const updated = await db.query.driverApplications.findFirst({
    where: eq(driverApplications.id, id),
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
      investigations: true,
    },
  });

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'driver_application',
    entityId: id,
    action: 'updated',
    diffJson: { ...data },
  });

  // Notify on status change
  if (data.status && data.status !== existing.status) {
    await notifyApplicationStatusChange(id, data.status, existing.tpaOrgId);

    await enqueueWebhookEvent({
      tpaOrgId: existing.tpaOrgId,
      event: 'dqf.application.status_changed',
      payload: {
        id,
        personId: existing.personId,
        clientOrgId: existing.clientOrgId,
        previousStatus: existing.status,
        status: data.status,
        changedAt: new Date(),
      },
    });
  }

  return NextResponse.json({ application: updated, message: 'Application updated successfully' });
});
