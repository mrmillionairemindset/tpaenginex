import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { serviceRequests, candidates, orders, orderChecklists } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { SERVICE_TYPE_CHECKLISTS } from '@/lib/service-templates';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const updateServiceRequestSchema = z.object({
  status: z.enum(['accepted', 'declined', 'converted']),
  declineReason: z.string().optional(),
});

// ============================================================================
// GET /api/service-requests/[id] - Get single service request
// ============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  const request = await db.query.serviceRequests.findFirst({
    where: eq(serviceRequests.id, id),
    with: {
      submitter: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      clientOrg: {
        columns: {
          id: true,
          name: true,
        },
      },
      reviewer: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      convertedOrder: true,
      tpaOrg: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!request) {
    return NextResponse.json({ error: 'Service request not found' }, { status: 404 });
  }

  // Scope check
  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  if (isTpaUser) {
    if (user.tpaOrgId && request.tpaOrgId !== user.tpaOrgId && user.role !== 'platform_admin') {
      return NextResponse.json({ error: 'Not found in your TPA scope' }, { status: 403 });
    }
  } else {
    // Client user — must be their org
    if (request.clientOrgId !== user.organization?.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 403 });
    }
  }

  return NextResponse.json({ serviceRequest: request });
}

// ============================================================================
// PATCH /api/service-requests/[id] - Update status (TPA staff only)
// ============================================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only TPA admin and staff can update
  if (user.role !== 'tpa_admin' && user.role !== 'tpa_staff' && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;
  const body = await req.json();
  const validation = updateServiceRequestSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Fetch existing request
  const existing = await db.query.serviceRequests.findFirst({
    where: eq(serviceRequests.id, id),
    with: {
      clientOrg: true,
    },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Service request not found' }, { status: 404 });
  }

  // TPA scope check
  if (user.tpaOrgId && existing.tpaOrgId !== user.tpaOrgId && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Not found in your TPA scope' }, { status: 403 });
  }

  // Cannot update already converted or declined requests
  if (existing.status === 'converted' || existing.status === 'declined') {
    return NextResponse.json(
      { error: `Cannot update a request that is already ${existing.status}` },
      { status: 400 }
    );
  }

  if (data.status === 'declined') {
    if (!data.declineReason?.trim()) {
      return NextResponse.json(
        { error: 'Decline reason is required' },
        { status: 400 }
      );
    }

    await db.update(serviceRequests).set({
      status: 'declined',
      declineReason: data.declineReason.trim(),
      reviewedBy: user.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(serviceRequests.id, id));

    return NextResponse.json({ message: 'Service request declined' });
  }

  if (data.status === 'accepted') {
    await db.update(serviceRequests).set({
      status: 'accepted',
      reviewedBy: user.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(serviceRequests.id, id));

    return NextResponse.json({ message: 'Service request accepted' });
  }

  if (data.status === 'converted') {
    // 1. Create candidate from donor info
    const [newCandidate] = await db.insert(candidates).values({
      orgId: existing.clientOrgId,
      tpaOrgId: existing.tpaOrgId,
      firstName: existing.donorFirstName,
      lastName: existing.donorLastName,
      dob: '01/01/1900', // placeholder — service request doesn't collect DOB
      ssnLast4: '0000',   // placeholder — service request doesn't collect SSN
      phone: existing.donorPhone || '',
      email: existing.donorEmail || '',
    }).returning();

    // 2. Create order
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Map service type to test type
    const testTypeMap: Record<string, string> = {
      'Pre-Employment': 'drug_screen',
      'Random': 'drug_screen',
      'Post-Accident': 'drug_screen',
      'Reasonable Suspicion': 'drug_screen',
      'Physical': 'physical',
      'Other': 'other',
    };

    // Map service type to order serviceType enum
    const serviceTypeMap: Record<string, string> = {
      'Pre-Employment': 'pre_employment',
      'Random': 'random',
      'Post-Accident': 'post_accident',
      'Reasonable Suspicion': 'reasonable_suspicion',
      'Physical': 'physical',
      'Other': 'other',
    };

    const [newOrder] = await db.insert(orders).values({
      orgId: existing.clientOrgId,
      tpaOrgId: existing.tpaOrgId,
      candidateId: newCandidate.id,
      orderNumber,
      testType: testTypeMap[existing.serviceType] || 'drug_screen',
      serviceType: serviceTypeMap[existing.serviceType] || 'drug_screen',
      isDOT: existing.isDOT,
      priority: existing.priority || 'standard',
      jobsiteLocation: existing.location,
      requestedBy: user.id,
      notes: existing.notes,
      scheduledFor: existing.requestedDate,
      status: 'new',
    }).returning();

    // Auto-populate checklist from service type template
    const mappedServiceType = serviceTypeMap[existing.serviceType] || 'drug_screen';
    const checklistItems = SERVICE_TYPE_CHECKLISTS[mappedServiceType] || [];
    if (checklistItems.length > 0) {
      await db.insert(orderChecklists).values(
        checklistItems.map((item: string, i: number) => ({
          orderId: newOrder.id,
          item,
          sortOrder: i,
        }))
      );
    }

    // 3. Update the service request
    await db.update(serviceRequests).set({
      status: 'converted',
      convertedOrderId: newOrder.id,
      reviewedBy: user.id,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(serviceRequests.id, id));

    return NextResponse.json({
      message: 'Service request converted to order',
      orderId: newOrder.id,
      orderNumber,
    });
  }

  return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
}
