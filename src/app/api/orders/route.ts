import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, persons, organizations, orderChecklists, clientChecklistTemplates } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and, desc, count, ilike, or, inArray, gte, lte, sql } from 'drizzle-orm';
import { parsePagination } from '@/lib/pagination';
import { z } from 'zod';
import { notifyOrderCreated } from '@/lib/notifications';
import { appendOrderToSheet } from '@/integrations/sheets';
import { SERVICE_TYPE_CHECKLISTS } from '@/lib/service-templates';
import { getTpaAutomationSettings } from '@/lib/tpa-settings';
import { enqueueWebhookEvent } from '@/lib/webhooks';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const createOrderSchema = z.object({
  personId: z.string().uuid().optional(), // Existing person
  // OR create new person inline
  person: z.object({
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
  clientOrgId: z.string().uuid().optional(),
  clientLabel: z.string().max(255).optional(),
  testType: z.string().min(1, "Test type is required"),
  serviceType: z.enum(['pre_employment', 'random', 'post_accident', 'reasonable_suspicion', 'physical', 'other', 'drug_screen']).default('drug_screen'),
  isDOT: z.boolean().default(false),
  reasonForService: z.string().max(100).optional(),
  testingAuthority: z.enum(['FMCSA', 'FTA']).optional(),
  panelCode: z.string().max(50).optional(),
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
  const personId = searchParams.get('personId');
  const search = searchParams.get('search')?.trim();
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const { page, limit, offset } = parsePagination(searchParams);

  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  const tpaOrgId = user.tpaOrgId;

  // Build tenant/scope base clause
  const conditions: any[] = [];
  if (user.role === 'platform_admin') {
    // no scope restriction
  } else if (isTpaUser && tpaOrgId) {
    conditions.push(eq(orders.tpaOrgId, tpaOrgId));
  } else {
    conditions.push(eq(orders.orgId, user.organization!.id));
    if (personId) conditions.push(eq(orders.personId, personId));
  }

  if (status) conditions.push(eq(orders.status, status as any));

  if (startDate) {
    const d = new Date(startDate);
    if (!isNaN(d.getTime())) conditions.push(gte(orders.createdAt, d));
  }
  if (endDate) {
    const d = new Date(endDate);
    if (!isNaN(d.getTime())) {
      // Include the entire end day
      d.setHours(23, 59, 59, 999);
      conditions.push(lte(orders.createdAt, d));
    }
  }

  if (search) {
    const searchPattern = `%${search}%`;
    // Find person IDs matching the search in name fields, scoped by tpa if applicable
    const personWhere = tpaOrgId && user.role !== 'platform_admin'
      ? and(
          eq(persons.tpaOrgId, tpaOrgId),
          or(ilike(persons.firstName, searchPattern), ilike(persons.lastName, searchPattern)),
        )
      : or(ilike(persons.firstName, searchPattern), ilike(persons.lastName, searchPattern));

    const matchingPersons = await db
      .select({ id: persons.id })
      .from(persons)
      .where(personWhere);
    const personIds = matchingPersons.map(p => p.id);

    conditions.push(
      or(
        ilike(orders.orderNumber, searchPattern),
        ilike(orders.jobsiteLocation, searchPattern),
        personIds.length > 0 ? inArray(orders.personId, personIds) : sql`false`,
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [ordersList, [{ count: total }]] = await Promise.all([
    db.query.orders.findMany({
      where: whereClause,
      with: {
        person: true,
        organization: {
          columns: {
            id: true,
            name: true,
            type: true,
          },
        },
        clientOrg: {
          columns: {
            id: true,
            name: true,
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
      limit,
      offset,
    }),
    db.select({ count: count() }).from(orders).where(whereClause),
  ]);

  return NextResponse.json({
    orders: ordersList,
    pagination: {
      page,
      limit,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / limit),
      hasMore: offset + ordersList.length < Number(total),
    },
  });
});

// ============================================================================
// POST /api/orders - Create order
// ============================================================================

export const POST = withAuth(async (req, user) => {
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

  // Determine or create person
  let personId: string;

  if (data.personId) {
    // Use existing person - verify it belongs to this TPA's scope
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

    personId = existingPerson.id;
  } else if (data.person) {
    // Create new person scoped to TPA
    const [newPerson] = await db.insert(persons).values({
      orgId: user.organization!.id,
      tpaOrgId,
      firstName: data.person.firstName,
      lastName: data.person.lastName,
      dob: data.person.dob,
      ssnLast4: data.person.ssnLast4,
      phone: data.person.phone,
      email: data.person.email,
      address: data.person.address,
      city: data.person.city,
      state: data.person.state,
      zip: data.person.zip,
    }).returning();

    personId = newPerson.id;
  } else {
    return NextResponse.json(
      { error: 'Either personId or person data must be provided' },
      { status: 400 }
    );
  }

  // Generate order number
  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  // Create order with TPA scope
  const [newOrder] = await db.insert(orders).values({
    orgId: data.clientOrgId || user.organization!.id,
    tpaOrgId,
    clientOrgId: data.clientOrgId || null,
    clientLabel: data.clientLabel || null,
    personId,
    orderNumber,
    testType: data.testType,
    serviceType: data.serviceType,
    isDOT: data.isDOT,
    reasonForService: data.reasonForService || null,
    testingAuthority: data.testingAuthority || null,
    panelCode: data.panelCode || null,
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
  let checklistItems = SERVICE_TYPE_CHECKLISTS[data.serviceType] || [];

  try {
    const clientTemplate = await db.query.clientChecklistTemplates.findFirst({
      where: and(
        eq(clientChecklistTemplates.clientOrgId, newOrder.orgId),
        eq(clientChecklistTemplates.serviceType, data.serviceType),
        eq(clientChecklistTemplates.isActive, true),
      ),
    });

    if (clientTemplate) {
      checklistItems = clientTemplate.items;
    }
  } catch {
    // Table may not exist yet if migration hasn't run — use defaults
  }

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
      person: true,
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

  // Emit webhook event for external integrations
  await enqueueWebhookEvent({
    tpaOrgId,
    event: 'order.created',
    payload: {
      id: newOrder.id,
      orderNumber: newOrder.orderNumber,
      status: newOrder.status,
      serviceType: newOrder.serviceType,
      isDOT: newOrder.isDOT,
      priority: newOrder.priority,
      personId: newOrder.personId,
      clientOrgId: newOrder.clientOrgId,
      createdAt: newOrder.createdAt,
    },
  });

  // Sync to Google Sheets (async, don't block response)
  const automationSettings = await getTpaAutomationSettings(tpaOrgId);
  if (automationSettings.enableSheetsSync && fullOrder?.person) {
    appendOrderToSheet({
      orderNumber: fullOrder.orderNumber,
      personFirstName: fullOrder.person.firstName,
      personLastName: fullOrder.person.lastName,
      personDOB: fullOrder.person.dob,
      personSSNLast4: fullOrder.person.ssnLast4,
      personEmail: fullOrder.person.email,
      personPhone: fullOrder.person.phone,
      personAddress: fullOrder.person.address || '',
      personCity: fullOrder.person.city || '',
      personState: fullOrder.person.state || '',
      personZip: fullOrder.person.zip || '',
      testType: fullOrder.testType,
      urgency: fullOrder.urgency || 'standard',
      jobsiteLocation: fullOrder.jobsiteLocation,
      needsMask: fullOrder.needsMask,
      maskSize: fullOrder.maskSize ?? undefined,
      status: fullOrder.status,
      createdAt: fullOrder.createdAt.toISOString(),
      notes: fullOrder.notes ?? undefined,
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
