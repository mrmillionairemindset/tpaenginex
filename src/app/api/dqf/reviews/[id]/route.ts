import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { annualReviews } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { notifyReviewCompleted } from '@/lib/dqf-notifications';

export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const updateReviewSchema = z.object({
  scheduledDate: z.string().datetime().optional(),
  reviewDate: z.string().datetime().optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'overdue', 'cancelled']).optional(),
  findings: z.string().optional(),
  notes: z.string().optional(),
  signOff: z.boolean().optional(), // if true, sets signedOffBy and signedOffAt
});

// ============================================================================
// GET /api/dqf/reviews/[id] - Single review
// ============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowedRoles = ['tpa_admin', 'tpa_staff', 'tpa_records', 'platform_admin'];
  if (!allowedRoles.includes(user.role || '')) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  const review = await db.query.annualReviews.findFirst({
    where: tpaOrgId
      ? and(eq(annualReviews.id, id), eq(annualReviews.tpaOrgId, tpaOrgId))
      : eq(annualReviews.id, id),
    with: {
      person: {
        columns: { id: true, firstName: true, lastName: true, email: true },
      },
      clientOrg: { columns: { id: true, name: true } },
      signedOffByUser: { columns: { id: true, name: true, email: true } },
    },
  });

  if (!review) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  }

  return NextResponse.json({ review });
}

// ============================================================================
// PATCH /api/dqf/reviews/[id] - Update review (sign-off, status change)
// ============================================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowedRoles = ['tpa_admin', 'tpa_staff', 'tpa_records', 'platform_admin'];
  if (!allowedRoles.includes(user.role || '')) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  const existing = await db.query.annualReviews.findFirst({
    where: tpaOrgId
      ? and(eq(annualReviews.id, id), eq(annualReviews.tpaOrgId, tpaOrgId))
      : eq(annualReviews.id, id),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Review not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = updateReviewSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;
  const updateData: any = { updatedAt: new Date() };

  if (data.scheduledDate) updateData.scheduledDate = new Date(data.scheduledDate);
  if (data.reviewDate) updateData.reviewDate = new Date(data.reviewDate);
  if (data.status) updateData.status = data.status;
  if (data.findings !== undefined) updateData.findings = data.findings;
  if (data.notes !== undefined) updateData.notes = data.notes;

  // Handle sign-off
  if (data.signOff) {
    updateData.signedOffBy = user.id;
    updateData.signedOffAt = new Date();
    if (!data.status) {
      updateData.status = 'completed';
    }
  }

  await db.update(annualReviews).set(updateData).where(eq(annualReviews.id, id));

  const updated = await db.query.annualReviews.findFirst({
    where: eq(annualReviews.id, id),
    with: {
      person: {
        columns: { id: true, firstName: true, lastName: true, email: true },
      },
      clientOrg: { columns: { id: true, name: true } },
      signedOffByUser: { columns: { id: true, name: true, email: true } },
    },
  });

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'annual_review',
    entityId: id,
    action: 'updated',
    diffJson: { ...data },
  });

  // Notify on completion (sign-off or status changed to completed)
  const isCompletion = data.signOff || (data.status === 'completed' && existing.status !== 'completed');
  if (isCompletion && updated) {
    const personName = `${updated.person.firstName} ${updated.person.lastName}`;
    await notifyReviewCompleted(id, personName, existing.tpaOrgId);
  }

  return NextResponse.json({ review: updated, message: 'Review updated successfully' });
}
