import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, candidates, organizations, orderChecklists } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { notifyOrderCreated } from '@/lib/notifications';
import { appendOrderToSheet } from '@/integrations/sheets';
import { SERVICE_TYPE_CHECKLISTS } from '@/lib/service-templates';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

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
  serviceType: z.enum(['pre_employment', 'random', 'post_accident', 'reasonable_suspicion', 'physical', 'other', 'drug_screen']).default('drug_screen'),
  isDOT: z.boolean().default(false),
  priority: z.enum(['standard', 'urgent']).default('standard'),
  urgency: z.enum(['standard', 'rush', 'urgent']).default('standard'),
  jobsiteLocation: z.string().min(1, "Jobsite location is required"),
  needsMask: z.boolean().default(false),
  maskSize: z.string().optional(),
  collectorId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
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

  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  const tpaOrgId = user.tpaOrgId;

  let whereClause;
  if (user.role === 'platform_admin') {
    // Platform admin sees all orders
    whereClause = status ? eq(orders.status, status as any) : undefined;
  } else if (isTpaUser && tpaOrgId) {
    // TPA staff sees orders scoped to their TPA
    const baseWhere = eq(orders.tpaOrgId, tpaOrgId);
    if (status) {
      whereClause = and(baseWhere, eq(orders.status, status as any));
    } else {
      whereClause = baseWhere;
    }
  } else {
    // Client users see only their own org's orders
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
      collector: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      requestedByUser: {
        columns: {
          id: true,
          name: true,
          email: true,
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
  // TPA staff and admins can create orders on behalf of clients
  const canCreate = user.role?.startsWith('tpa_') && ['tpa_admin', 'tpa_staff'].includes(user.role!)
    || user.role === 'platform_admin';

  if (!canCreate) {
    return NextResponse.json(
      { error: 'Insufficient permissions to create orders' },
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
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId) {
    return NextResponse.json(
      { error: 'TPA organization context required' },
      { status: 400 }
    );
  }

  // Determine or create candidate
  let candidateId: string;

  if (data.candidateId) {
    // Use existing candidate - verify it belongs to this TPA's scope
    const existingCandidate = await db.query.candidates.findFirst({
      where: and(
        eq(candidates.id, data.candidateId),
        eq(candidates.tpaOrgId, tpaOrgId)
      ),
    });

    if (!existingCandidate) {
      return NextResponse.json(
        { error: 'Candidate not found' },
        { status: 404 }
      );
    }

    candidateId = existingCandidate.id;
  } else if (data.candidate) {
    // Create new candidate scoped to TPA
    const [newCandidate] = await db.insert(candidates).values({
      orgId: user.organization!.id,
      tpaOrgId,
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

  // Create order with TPA scope
  const [newOrder] = await db.insert(orders).values({
    orgId: user.organization!.id,
    tpaOrgId,
    candidateId,
    orderNumber,
    testType: data.testType,
    serviceType: data.serviceType,
    isDOT: data.isDOT,
    priority: data.priority,
    urgency: data.urgency,
    jobsiteLocation: data.jobsiteLocation,
    needsMask: data.needsMask,
    maskSize: data.maskSize,
    collectorId: data.collectorId || null,
    eventId: data.eventId || null,
    requestedBy: user.id,
    notes: data.notes,
    internalNotes: data.internalNotes,
    scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
    status: 'new',
  }).returning();

  // Auto-populate checklist from service type template
  const checklistItems = SERVICE_TYPE_CHECKLISTS[data.serviceType] || [];
  if (checklistItems.length > 0) {
    await db.insert(orderChecklists).values(
      checklistItems.map((item, i) => ({
        orderId: newOrder.id,
        item,
        sortOrder: i,
      }))
    );
  }

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
      collector: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
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

  // Send notification
  await notifyOrderCreated(newOrder.id, orderNumber);

  // Sync to Google Sheets (async, don't block response)
  if (fullOrder?.candidate) {
    appendOrderToSheet({
      orderNumber: fullOrder.orderNumber,
      candidateFirstName: fullOrder.candidate.firstName,
      candidateLastName: fullOrder.candidate.lastName,
      candidateDOB: fullOrder.candidate.dob,
      candidateSSNLast4: fullOrder.candidate.ssnLast4,
      candidateEmail: fullOrder.candidate.email,
      candidatePhone: fullOrder.candidate.phone,
      candidateAddress: fullOrder.candidate.address,
      candidateCity: fullOrder.candidate.city,
      candidateState: fullOrder.candidate.state,
      candidateZip: fullOrder.candidate.zip,
      testType: fullOrder.testType,
      urgency: fullOrder.urgency || 'standard',
      jobsiteLocation: fullOrder.jobsiteLocation,
      needsMask: fullOrder.needsMask,
      maskSize: fullOrder.maskSize,
      status: fullOrder.status,
      createdAt: fullOrder.createdAt.toISOString(),
      notes: fullOrder.notes,
    })
      .then((rowId) => {
        if (rowId) {
          db.update(orders)
            .set({ externalRowId: rowId })
            .where(eq(orders.id, fullOrder.id))
            .catch(console.error);
        }
      })
      .catch((error) => {
        console.error('Failed to sync order to Google Sheets:', error);
      });
  }

  return NextResponse.json(
    { order: fullOrder, message: 'Order created successfully' },
    { status: 201 }
  );
});
