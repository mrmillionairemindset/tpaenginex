import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { orders, events } from '@/db/schema';
import { eq, and, ne, gte, lte, desc } from 'drizzle-orm';
import { startOfWeek, endOfWeek } from 'date-fns';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/collector-portal/schedule
// Get this collector's schedule for the current week (orders + events)
// ============================================================================

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'collector') {
      return NextResponse.json(
        { error: 'Forbidden: Collector access only' },
        { status: 403 }
      );
    }

    if (!user.collectorId) {
      return NextResponse.json(
        { error: 'No collector profile linked to this account' },
        { status: 400 }
      );
    }

    if (!user.tpaOrgId) {
      return NextResponse.json(
        { error: 'No TPA organization context' },
        { status: 400 }
      );
    }

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 }); // Sunday

    // Fetch orders scheduled this week for this collector
    const scheduledOrders = await db.query.orders.findMany({
      where: and(
        eq(orders.collectorId, user.collectorId),
        eq(orders.tpaOrgId, user.tpaOrgId),
        ne(orders.status, 'cancelled'),
        gte(orders.scheduledFor, weekStart),
        lte(orders.scheduledFor, weekEnd)
      ),
      with: {
        candidate: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        clientOrg: {
          columns: {
            id: true,
            name: true,
          },
        },
        event: {
          columns: {
            id: true,
            eventNumber: true,
            serviceType: true,
          },
        },
      },
      orderBy: [desc(orders.scheduledFor)],
    });

    // Fetch events scheduled this week for this collector
    const scheduledEvents = await db.query.events.findMany({
      where: and(
        eq(events.collectorId, user.collectorId),
        eq(events.tpaOrgId, user.tpaOrgId),
        ne(events.status, 'cancelled'),
        gte(events.scheduledDate, weekStart),
        lte(events.scheduledDate, weekEnd)
      ),
      with: {
        clientOrg: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Strip internalNotes from orders and events
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const sanitizedOrders = scheduledOrders.map(
      ({ internalNotes, ...order }: any) => order
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const sanitizedEvents = scheduledEvents.map(
      ({ internalNotes, ...event }: any) => event
    );

    return NextResponse.json({
      orders: sanitizedOrders,
      events: sanitizedEvents,
    });
  } catch (error) {
    console.error('Failed to fetch collector schedule:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule' },
      { status: 500 }
    );
  }
}
