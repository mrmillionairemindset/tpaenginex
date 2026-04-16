import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { persons, orders } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and, count } from 'drizzle-orm';
import { z } from 'zod';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const updatePersonSchema = z.object({
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
// GET /api/candidates/[id] - Get single person
// ============================================================================

export const GET = withAuth(async (req, user, context) => {
  const { id } = context.params;

  if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 }
    );
  }

  const person = await db.query.persons.findFirst({
    where: and(
      eq(persons.id, id),
      eq(persons.orgId, user.organization!.id)
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

  if (!person) {
    return NextResponse.json(
      { error: 'Person not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ person });
});

// ============================================================================
// PATCH /api/candidates/[id] - Update person
// ============================================================================

export const PATCH = withAuth(async (req, user, context) => {
  const { id } = context.params;
  const body = await req.json();
  const validation = updatePersonSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  if (user.role !== 'tpa_admin' && user.role !== 'tpa_staff' && user.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Only admins can update persons' },
      { status: 403 }
    );
  }

  const existingPerson = await db.query.persons.findFirst({
    where: and(
      eq(persons.id, id),
      eq(persons.orgId, user.organization!.id)
    ),
  });

  if (!existingPerson) {
    return NextResponse.json(
      { error: 'Person not found' },
      { status: 404 }
    );
  }

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

  const [updatedPerson] = await db
    .update(persons)
    .set(updateData)
    .where(eq(persons.id, id))
    .returning();

  return NextResponse.json(
    { person: updatedPerson, message: 'Person updated successfully' }
  );
});

// ============================================================================
// DELETE /api/candidates/[id] - Delete person (admin only)
// ============================================================================

export const DELETE = withAuth(async (req, user, context) => {
  const { id } = context.params;

  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Only admins can delete persons' },
      { status: 403 }
    );
  }

  const person = await db.query.persons.findFirst({
    where: user.tpaOrgId
      ? and(eq(persons.id, id), eq(persons.tpaOrgId, user.tpaOrgId))
      : eq(persons.id, id),
  });

  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 });
  }

  const [orderCount] = await db
    .select({ count: count() })
    .from(orders)
    .where(eq(orders.personId, id));

  if (orderCount.count > 0) {
    return NextResponse.json(
      { error: `Cannot delete: person has ${orderCount.count} linked order(s). Delete the orders first.` },
      { status: 409 }
    );
  }

  await db.delete(persons).where(eq(persons.id, id));

  return NextResponse.json({ message: 'Person deleted' });
});
