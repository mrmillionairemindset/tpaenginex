import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { appointments, orders, sites } from '@/db/schema';
import { withTpaAuth } from '@/auth/api-middleware';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
// Legacy: notifySiteAssigned removed — appointments are unused in TPA flow

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const createAppointmentSchema = z.object({
  orderId: z.string().uuid(),
  siteId: z.string().uuid(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// ============================================================================
// POST /api/appointments - Create appointment (assign site to order)
// ============================================================================

export const POST = withTpaAuth(async (req, user) => {
  const body = await req.json();
  const validation = createAppointmentSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Verify order exists
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, data.orderId),
  });

  if (!order) {
    return NextResponse.json(
      { error: 'Order not found' },
      { status: 404 }
    );
  }

  // Verify site exists and is active
  const site = await db.query.sites.findFirst({
    where: eq(sites.id, data.siteId),
  });

  if (!site || !site.isActive) {
    return NextResponse.json(
      { error: 'Site not found or inactive' },
      { status: 404 }
    );
  }

  // Check if site supports the test type
  const testsSupported = site.testsSupported as string[];
  if (!testsSupported.includes(order.testType)) {
    return NextResponse.json(
      {
        error: 'Site does not support this test type',
        testType: order.testType,
        siteSupportedTests: testsSupported,
      },
      { status: 400 }
    );
  }

  // Check if order already has an active appointment
  const existingAppointment = await db.query.appointments.findFirst({
    where: and(
      eq(appointments.orderId, data.orderId),
      eq(appointments.status, 'confirmed')
    ),
  });

  if (existingAppointment) {
    return NextResponse.json(
      { error: 'Order already has an active appointment' },
      { status: 409 }
    );
  }

  // Create appointment
  const [newAppointment] = await db.insert(appointments).values({
    orderId: data.orderId,
    siteId: data.siteId,
    assignedBy: user.id,
    startTime: data.startTime ? new Date(data.startTime) : null,
    endTime: data.endTime ? new Date(data.endTime) : null,
    status: data.startTime ? 'confirmed' : 'proposed',
    notes: data.notes,
  }).returning();

  // Update order status
  await db
    .update(orders)
    .set({
      status: data.startTime ? 'scheduled' : 'needs_site',
      scheduledFor: data.startTime ? new Date(data.startTime) : null,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, data.orderId));

  // Fetch full appointment with relations
  const fullAppointment = await db.query.appointments.findFirst({
    where: eq(appointments.id, newAppointment.id),
    with: {
      order: {
        with: {
          person: true,
        },
      },
      site: true,
      assignedByUser: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Legacy: notification removed — appointments unused in TPA flow

  return NextResponse.json(
    { appointment: fullAppointment, message: 'Appointment created successfully' },
    { status: 201 }
  );
});
