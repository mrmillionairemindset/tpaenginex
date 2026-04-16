import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { orders, events, leads } from '@/db/schema';
import { eq, and, gte, lte, ne } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// GET /api/schedule?start=2026-03-22&end=2026-03-28
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const startStr = searchParams.get('start');
  const endStr = searchParams.get('end');

  // Default to current week (Mon-Sun)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const start = startStr ? new Date(startStr) : new Date(now);
  if (!startStr) {
    start.setDate(now.getDate() + mondayOffset);
  }
  start.setHours(0, 0, 0, 0);

  const end = endStr ? new Date(endStr) : new Date(start);
  if (!endStr) {
    end.setDate(start.getDate() + 6);
  }
  end.setHours(23, 59, 59, 999);

  const [scheduledOrders, scheduledEvents, upcomingFollowUps] = await Promise.all([
    // Orders with scheduledFor in range
    db.query.orders.findMany({
      where: and(
        eq(orders.tpaOrgId, tpaOrgId),
        gte(orders.scheduledFor, start),
        lte(orders.scheduledFor, end),
        ne(orders.status, 'cancelled'),
      ),
      with: {
        person: { columns: { firstName: true, lastName: true } },
        collector: { columns: { id: true, firstName: true, lastName: true } },
        clientOrg: { columns: { id: true, name: true } },
      },
      columns: {
        id: true,
        orderNumber: true,
        status: true,
        serviceType: true,
        testType: true,
        isDOT: true,
        priority: true,
        scheduledFor: true,
        clientLabel: true,
      },
    }),

    // Events with scheduledDate in range
    db.query.events.findMany({
      where: and(
        eq(events.tpaOrgId, tpaOrgId),
        gte(events.scheduledDate, start),
        lte(events.scheduledDate, end),
        ne(events.status, 'cancelled'),
      ),
      with: {
        clientOrg: { columns: { id: true, name: true } },
        collector: { columns: { id: true, firstName: true, lastName: true } },
      },
      columns: {
        id: true,
        eventNumber: true,
        status: true,
        serviceType: true,
        scheduledDate: true,
        totalOrdered: true,
        totalCompleted: true,
        totalPending: true,
        location: true,
      },
    }),

    // Lead follow-ups in range
    db.query.leads.findMany({
      where: and(
        eq(leads.tpaOrgId, tpaOrgId),
        gte(leads.nextFollowUpAt, start),
        lte(leads.nextFollowUpAt, end),
        ne(leads.stage, 'closed_won'),
        ne(leads.stage, 'closed_lost'),
      ),
      columns: {
        id: true,
        companyName: true,
        contactName: true,
        stage: true,
        nextFollowUpAt: true,
      },
      with: {
        owner: { columns: { id: true, name: true } },
      },
    }),
  ]);

  return NextResponse.json({
    orders: scheduledOrders,
    events: scheduledEvents,
    followUps: upcomingFollowUps,
    range: { start: start.toISOString(), end: end.toISOString() },
  });
}
