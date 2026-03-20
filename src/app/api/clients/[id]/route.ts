import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, orders, organizationMembers, events, documents, notifications, serviceRequests, clientDocuments, clientChecklistTemplates } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and, desc, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/clients/[id] — get client org detail with orders, members, events, docs, comms, requests
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  if (!isTpaUser) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  // Fetch the client org
  const clientOrg = await db.query.organizations.findFirst({
    where: tpaOrgId
      ? and(eq(organizations.id, id), eq(organizations.tpaOrgId, tpaOrgId))
      : eq(organizations.id, id),
  });

  if (!clientOrg || clientOrg.type !== 'client') {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // Fetch members
  const members = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.organizationId, id),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
        },
      },
    },
  });

  // Fetch recent orders with documents
  const recentOrders = await db.query.orders.findMany({
    where: eq(orders.orgId, id),
    with: {
      candidate: {
        columns: { firstName: true, lastName: true },
      },
      documents: {
        columns: { id: true, fileName: true, kind: true, createdAt: true },
      },
    },
    orderBy: [desc(orders.createdAt)],
    limit: 20,
  });

  // Fetch events for this client
  const clientEvents = await db.query.events.findMany({
    where: eq(events.clientOrgId, id),
    with: {
      collector: {
        columns: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: [desc(events.scheduledDate)],
    limit: 10,
  });

  // Collect all documents across this client's orders
  const allDocuments = recentOrders.flatMap(order =>
    (order.documents || []).map(doc => ({
      ...doc,
      orderNumber: order.orderNumber,
      orderId: order.id,
    }))
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Fetch notifications/communications for this client's users
  const memberUserIds = members.map(m => m.user.id);
  let communications: any[] = [];
  if (memberUserIds.length > 0) {
    const allNotifications = await db.query.notifications.findMany({
      where: tpaOrgId ? eq(notifications.tpaOrgId, tpaOrgId) : undefined,
      orderBy: [desc(notifications.createdAt)],
      limit: 50,
    });
    // Filter to notifications related to this client's orders
    const clientOrderIds = recentOrders.map(o => o.id);
    communications = allNotifications.filter(
      n => n.orderId && clientOrderIds.includes(n.orderId)
    ).slice(0, 20);
  }

  // Fetch client-level documents (contracts, SOPs, BAAs, etc.)
  let clientDocs: any[] = [];
  try {
    clientDocs = await db.query.clientDocuments.findMany({
      where: and(eq(clientDocuments.clientOrgId, id), eq(clientDocuments.isArchived, false)),
      with: {
        uploadedByUser: { columns: { id: true, name: true, email: true } },
      },
      orderBy: [desc(clientDocuments.createdAt)],
    });
  } catch {
    // Table may not exist yet if migration hasn't run
  }

  // Fetch service requests from this client
  let clientServiceRequests: any[] = [];
  try {
    clientServiceRequests = await db.query.serviceRequests.findMany({
      where: eq(serviceRequests.clientOrgId, id),
      orderBy: [desc(serviceRequests.createdAt)],
      limit: 10,
    });
  } catch {
    // Table may not exist yet if migration hasn't run
  }

  // Fetch client checklist templates
  let checklistTemplates: any[] = [];
  try {
    checklistTemplates = await db.query.clientChecklistTemplates.findMany({
      where: eq(clientChecklistTemplates.clientOrgId, id),
    });
  } catch {
    // Table may not exist yet if migration hasn't run
  }

  // Count stats
  const [totalOrders] = await db.select({ count: count() }).from(orders).where(eq(orders.orgId, id));
  const [openOrders] = await db.select({ count: count() }).from(orders).where(
    and(eq(orders.orgId, id), eq(orders.status, 'new'))
  );
  const [completedOrders] = await db.select({ count: count() }).from(orders).where(
    and(eq(orders.orgId, id), eq(orders.status, 'complete'))
  );

  return NextResponse.json({
    client: clientOrg,
    members: members.map(m => ({
      id: m.id,
      role: m.role,
      isActive: m.isActive,
      user: m.user,
    })),
    recentOrders,
    events: clientEvents,
    documents: allDocuments,
    clientDocuments: clientDocs,
    communications,
    serviceRequests: clientServiceRequests,
    checklistTemplates,
    stats: {
      totalOrders: totalOrders?.count || 0,
      openOrders: openOrders?.count || 0,
      completedOrders: completedOrders?.count || 0,
      totalUsers: members.length,
      totalEvents: clientEvents.length,
      totalDocuments: allDocuments.length,
      totalClientDocuments: clientDocs.length,
    },
  });
}
