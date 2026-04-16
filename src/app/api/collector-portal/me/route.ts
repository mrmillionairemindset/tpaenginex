import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { collectors, orders } from '@/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { startOfDay, startOfWeek } from 'date-fns';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/collector-portal/me — Collector profile + stats
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

    if (!user.collectorId || !user.tpaOrgId) {
      return NextResponse.json(
        { error: 'No collector profile linked to this account' },
        { status: 400 }
      );
    }

    // Fetch collector profile
    const collector = await db.query.collectors.findFirst({
      where: and(
        eq(collectors.id, user.collectorId),
        eq(collectors.tpaOrgId, user.tpaOrgId)
      ),
      columns: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        certifications: true,
        serviceArea: true,
        isAvailable: true,
      },
    });

    if (!collector) {
      return NextResponse.json(
        { error: 'Collector profile not found' },
        { status: 404 }
      );
    }

    // Count stats
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });

    // Total assigned (non-cancelled, non-complete)
    const [totalAssigned] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.collectorId, user.collectorId),
          eq(orders.tpaOrgId, user.tpaOrgId),
          sql`${orders.status} NOT IN ('cancelled', 'complete')`
        )
      );

    // Completed today
    const [completedToday] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.collectorId, user.collectorId),
          eq(orders.tpaOrgId, user.tpaOrgId),
          eq(orders.status, 'complete'),
          gte(orders.completedAt, todayStart)
        )
      );

    // Completed this week
    const [completedThisWeek] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.collectorId, user.collectorId),
          eq(orders.tpaOrgId, user.tpaOrgId),
          eq(orders.status, 'complete'),
          gte(orders.completedAt, weekStart)
        )
      );

    return NextResponse.json({
      profile: collector,
      stats: {
        totalAssigned: totalAssigned?.count ?? 0,
        completedToday: completedToday?.count ?? 0,
        completedThisWeek: completedThisWeek?.count ?? 0,
      },
    });
  } catch (error) {
    console.error('Failed to fetch collector profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch collector profile' },
      { status: 500 }
    );
  }
}
