import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { collectors, orders, events } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and, ne, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/collectors/[id]/schedule — get collector detail with all assignments
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

  // Fetch collector
  const collector = await db.query.collectors.findFirst({
    where: tpaOrgId
      ? and(eq(collectors.id, id), eq(collectors.tpaOrgId, tpaOrgId))
      : eq(collectors.id, id),
  });

  if (!collector) {
    return NextResponse.json({ error: 'Collector not found' }, { status: 404 });
  }

  // Fetch all orders assigned to this collector
  const assignedOrders = await db.query.orders.findMany({
    where: eq(orders.collectorId, id),
    with: {
      person: {
        columns: { firstName: true, lastName: true },
      },
      organization: {
        columns: { id: true, name: true },
      },
    },
    orderBy: [desc(orders.scheduledFor)],
  });

  // Fetch all events assigned to this collector
  const assignedEvents = await db.query.events.findMany({
    where: eq(events.collectorId, id),
    with: {
      clientOrg: {
        columns: { id: true, name: true },
      },
    },
    orderBy: [desc(events.scheduledDate)],
  });

  // Build schedule — combine orders and events into a unified timeline
  const now = new Date();

  const orderItems = assignedOrders.map(order => ({
    id: order.id,
    type: 'order' as const,
    title: order.orderNumber,
    subtitle: order.person
      ? `${order.person.firstName} ${order.person.lastName}`
      : '',
    client: order.organization?.name || '',
    serviceType: order.serviceType || order.testType,
    date: order.scheduledFor,
    status: order.status,
    priority: order.priority,
    isDOT: order.isDOT,
    href: `/orders/${order.id}`,
  }));

  const eventItems = assignedEvents.map(event => ({
    id: event.id,
    type: 'event' as const,
    title: event.eventNumber,
    subtitle: `${event.totalOrdered} donors (${event.totalCompleted} done, ${event.totalPending} pending)`,
    client: event.clientOrg?.name || '',
    serviceType: event.serviceType,
    date: event.scheduledDate,
    status: event.status,
    priority: null,
    isDOT: false,
    href: `/events/${event.id}`,
  }));

  const allItems = [...orderItems, ...eventItems].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  // Split into upcoming vs past
  const upcoming = allItems.filter(item =>
    item.date && new Date(item.date) >= now && item.status !== 'complete' && item.status !== 'cancelled'
  ).reverse(); // chronological for upcoming

  const active = allItems.filter(item =>
    item.status !== 'complete' && item.status !== 'cancelled' && (!item.date || new Date(item.date) < now)
  );

  const completed = allItems.filter(item =>
    item.status === 'complete'
  ).slice(0, 10);

  // Stats
  const stats = {
    totalAssignments: allItems.length,
    upcoming: upcoming.length,
    active: active.length,
    completed: allItems.filter(i => i.status === 'complete').length,
    cancelled: allItems.filter(i => i.status === 'cancelled').length,
  };

  return NextResponse.json({
    collector,
    schedule: { upcoming, active, completed },
    stats,
  });
}
