import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { candidates, orders } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and, count } from 'drizzle-orm';
import { z } from 'zod';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const updateCandidateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
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
// GET /api/candidates/[id] - Get single candidate
// ============================================================================

export const GET = withAuth(async (req, user, context) => {
  const { id } = context.params;

  // Only employers can access candidates
  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const candidate = await db.query.candidates.findFirst({
    where: and(
      eq(candidates.id, id),
      eq(candidates.orgId, user.organization!.id)
    ),
    with: {
      orders: {
        with: {
          appointments: {
            with: {
              site: true,
            },
          },
        },
        orderBy: (orders, { desc }) => [desc(orders.createdAt)],
      },
    },
  });

  if (!candidate) {
    return NextResponse.json(
      { error: 'Candidate not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ candidate });
});

// ============================================================================
// PATCH /api/candidates/[id] - Update candidate
// ============================================================================

export const PATCH = withAuth(async (req, user, context) => {
  const { id } = context.params;
  const body = await req.json();
  const validation = updateCandidateSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Only employer admins can update candidates
  if (user.role !== 'tpa_admin' && user.role !== 'tpa_staff' && user.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Only employer admins can update candidates' },
      { status: 403 }
    );
  }

  // Verify candidate belongs to user's org
  const existingCandidate = await db.query.candidates.findFirst({
    where: and(
      eq(candidates.id, id),
      eq(candidates.orgId, user.organization!.id)
    ),
  });

  if (!existingCandidate) {
    return NextResponse.json(
      { error: 'Candidate not found' },
      { status: 404 }
    );
  }

  // Build update object
  const updateData: any = { updatedAt: new Date() };

  if (data.firstName) updateData.firstName = data.firstName;
  if (data.lastName) updateData.lastName = data.lastName;
  if (data.dob !== undefined) updateData.dob = data.dob;
  if (data.ssn !== undefined) updateData.ssn = data.ssn;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.address !== undefined) updateData.address = data.address;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.state !== undefined) updateData.state = data.state;
  if (data.zip !== undefined) updateData.zip = data.zip;
  if (data.meta !== undefined) updateData.meta = data.meta;

  // Update candidate
  const [updatedCandidate] = await db
    .update(candidates)
    .set(updateData)
    .where(eq(candidates.id, id))
    .returning();

  return NextResponse.json(
    { candidate: updatedCandidate, message: 'Candidate updated successfully' }
  );
});

// ============================================================================
// DELETE /api/candidates/[id] - Delete candidate (admin only)
// ============================================================================

export const DELETE = withAuth(async (req, user, context) => {
  const { id } = context.params;

  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Only admins can delete candidates' },
      { status: 403 }
    );
  }

  // Verify candidate exists and belongs to TPA scope
  const candidate = await db.query.candidates.findFirst({
    where: user.tpaOrgId
      ? and(eq(candidates.id, id), eq(candidates.tpaOrgId, user.tpaOrgId))
      : eq(candidates.id, id),
  });

  if (!candidate) {
    return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
  }

  // Check for linked orders
  const [orderCount] = await db
    .select({ count: count() })
    .from(orders)
    .where(eq(orders.candidateId, id));

  if (orderCount.count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: candidate has ${orderCount.count} linked order(s). Delete the orders first.` },
      { status: 409 }
    );
  }

  await db.delete(candidates).where(eq(candidates.id, id));

  return NextResponse.json({ message: 'Candidate deleted' });
});
