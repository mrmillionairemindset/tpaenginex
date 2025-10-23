import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, candidates, organizations } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { notifyOrderCreated } from '@/lib/notifications';

// ============================================================================
// Validation Schemas
// ============================================================================

const createOrderSchema = z.object({
  candidateId: z.string().uuid().optional(), // Existing candidate
  // OR create new candidate inline
  candidate: z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    dob: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/, "Date of birth must be in MM/DD/YYYY format"),
    ssnLast4: z.string().regex(/^\d{4}$/, "SSN Last 4 must be exactly 4 digits"),
    phone: z.string().regex(/^[\d\s\-\(\)]+$/, "Phone number format is invalid").min(10, "Phone number is required"),
    email: z.string().email("Valid email is required"),
    address: z.string().min(1, "Address is required"),
    city: z.string().min(1, "City is required"),
    state: z.string().length(2, "State must be 2 characters"),
    zip: z.string().min(5, "ZIP code is required"),
  }).optional(),
  testType: z.string().min(1, "Test type is required"),
  urgency: z.enum(['standard', 'rush', 'urgent']).default('standard'),
  jobsiteLocation: z.string().min(1, "Jobsite location is required"),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
});

// ============================================================================
// GET /api/orders - List orders
// ============================================================================

export const GET = withAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const candidateId = searchParams.get('candidateId');

  // Build where clause based on user role
  const isProvider = user.role?.startsWith('provider');

  let whereClause;
  if (isProvider) {
    // Providers see ALL orders (they coordinate for multiple employers)
    whereClause = status
      ? eq(orders.status, status as any)
      : undefined;
  } else {
    // Employers only see their own orders
    const baseWhere = eq(orders.orgId, user.organization!.id);
    if (status) {
      whereClause = and(baseWhere, eq(orders.status, status as any));
    } else if (candidateId) {
      whereClause = and(baseWhere, eq(orders.candidateId, candidateId));
    } else {
      whereClause = baseWhere;
    }
  }

  const ordersList = await db.query.orders.findMany({
    where: whereClause,
    with: {
      candidate: true,
      organization: {
        columns: {
          id: true,
          name: true,
          type: true,
        },
      },
      requestedByUser: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      appointments: {
        with: {
          site: true,
        },
      },
      documents: true,
    },
    orderBy: [desc(orders.createdAt)],
  });

  return NextResponse.json({ orders: ordersList });
});

// ============================================================================
// POST /api/orders - Create order
// ============================================================================

export const POST = withAuth(async (req, user) => {
  // Only employers can create orders
  if (!user.role?.startsWith('employer')) {
    return NextResponse.json(
      { error: 'Only employers can create orders' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const validation = createOrderSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Determine or create candidate
  let candidateId: string;

  if (data.candidateId) {
    // Use existing candidate - verify it belongs to this org
    const existingCandidate = await db.query.candidates.findFirst({
      where: and(
        eq(candidates.id, data.candidateId),
        eq(candidates.orgId, user.organization!.id)
      ),
    });

    if (!existingCandidate) {
      return NextResponse.json(
        { error: 'Candidate not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    candidateId = existingCandidate.id;
  } else if (data.candidate) {
    // Create new candidate
    const [newCandidate] = await db.insert(candidates).values({
      orgId: user.organization!.id,
      firstName: data.candidate.firstName,
      lastName: data.candidate.lastName,
      dob: data.candidate.dob,
      ssnLast4: data.candidate.ssnLast4,
      phone: data.candidate.phone,
      email: data.candidate.email,
      address: data.candidate.address,
      city: data.candidate.city,
      state: data.candidate.state,
      zip: data.candidate.zip,
    }).returning();

    candidateId = newCandidate.id;
  } else {
    return NextResponse.json(
      { error: 'Either candidateId or candidate data must be provided' },
      { status: 400 }
    );
  }

  // Generate order number
  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  // Create order
  const [newOrder] = await db.insert(orders).values({
    orgId: user.organization!.id,
    candidateId,
    orderNumber,
    testType: data.testType,
    urgency: data.urgency,
    jobsiteLocation: data.jobsiteLocation,
    requestedBy: user.id,
    notes: data.notes,
    internalNotes: data.internalNotes,
    scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
    status: 'new',
  }).returning();

  // Fetch full order with relations
  const fullOrder = await db.query.orders.findFirst({
    where: eq(orders.id, newOrder.id),
    with: {
      candidate: true,
      organization: {
        columns: {
          id: true,
          name: true,
          type: true,
        },
      },
      requestedByUser: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Send notification to providers
  await notifyOrderCreated(newOrder.id, orderNumber);

  return NextResponse.json(
    { order: fullOrder, message: 'Order created successfully' },
    { status: 201 }
  );
});
