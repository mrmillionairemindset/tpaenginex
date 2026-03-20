import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { serviceRequests, users, organizations } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and, desc, or } from 'drizzle-orm';
import { z } from 'zod';
import { createNotification } from '@/lib/notifications';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const createServiceRequestSchema = z.object({
  donorFirstName: z.string().min(1, "Donor first name is required"),
  donorLastName: z.string().min(1, "Donor last name is required"),
  donorEmail: z.string().email("Valid email required").optional().or(z.literal('')),
  donorPhone: z.string().optional().or(z.literal('')),
  serviceType: z.string().min(1, "Service type is required"),
  isDOT: z.boolean().default(false),
  priority: z.enum(['standard', 'urgent']).default('standard'),
  location: z.string().min(1, "Location is required"),
  requestedDate: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

// ============================================================================
// GET /api/service-requests - List service requests
// ============================================================================

export const GET = withAuth(async (req, user) => {
  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';

  let whereClause;
  if (user.role === 'client_admin') {
    // Client sees their own org's requests
    whereClause = eq(serviceRequests.clientOrgId, user.organization!.id);
  } else if (isTpaUser && user.tpaOrgId) {
    // TPA staff sees requests for their TPA
    whereClause = eq(serviceRequests.tpaOrgId, user.tpaOrgId);
  } else if (user.role === 'platform_admin') {
    // Platform admin sees all
    whereClause = undefined;
  } else {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const requests = await db.query.serviceRequests.findMany({
    where: whereClause,
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
    },
    orderBy: [desc(serviceRequests.createdAt)],
  });

  return NextResponse.json({ serviceRequests: requests });
});

// ============================================================================
// POST /api/service-requests - Submit a new service request
// ============================================================================

export const POST = withAuth(async (req, user) => {
  if (user.role !== 'client_admin') {
    return NextResponse.json(
      { error: 'Only client admins can submit service requests' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const validation = createServiceRequestSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Client org must have a TPA parent
  const tpaOrgId = user.organization?.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json(
      { error: 'Your organization is not associated with a TPA' },
      { status: 400 }
    );
  }

  const [newRequest] = await db.insert(serviceRequests).values({
    tpaOrgId,
    clientOrgId: user.organization!.id,
    submittedBy: user.id,
    donorFirstName: data.donorFirstName,
    donorLastName: data.donorLastName,
    donorEmail: data.donorEmail || null,
    donorPhone: data.donorPhone || null,
    serviceType: data.serviceType,
    isDOT: data.isDOT,
    priority: data.priority,
    location: data.location,
    requestedDate: data.requestedDate ? new Date(data.requestedDate) : null,
    notes: data.notes || null,
    status: 'submitted',
  }).returning();

  // Notify TPA staff (tpa_admin, tpa_staff) about the new service request
  try {
    const tpaStaff = await db.query.users.findMany({
      where: and(
        eq(users.orgId, tpaOrgId),
        or(
          eq(users.role, 'tpa_admin'),
          eq(users.role, 'tpa_staff'),
        ),
      ),
    });

    const clientOrgName = user.organization?.name || 'A client';
    const donorName = `${data.donorFirstName} ${data.donorLastName}`;

    for (const staffUser of tpaStaff) {
      await createNotification({
        userId: staffUser.id,
        type: 'order_created',
        title: 'New Service Request',
        message: `${clientOrgName} submitted a service request for ${donorName} — ${data.serviceType}`,
        tpaOrgId,
      });
    }
  } catch (error) {
    console.error('Error notifying TPA staff of new service request:', error);
  }

  return NextResponse.json(
    { serviceRequest: newRequest, message: 'Service request submitted successfully' },
    { status: 201 }
  );
});
