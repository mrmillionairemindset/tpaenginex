import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/dashboard/order-volume — 30-day order volume by day
// ============================================================================

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tpaOrgId = user.tpaOrgId;

    // Only TPA users (tpa_* or platform_admin) can view org-wide volume
    const isTpaUser =
      user.role?.startsWith('tpa_') || user.role === 'platform_admin';
    if (!isTpaUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!tpaOrgId && user.role !== 'platform_admin') {
      return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
    }

    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    start.setHours(0, 0, 0, 0);

    const whereClause = tpaOrgId
      ? and(eq(orders.tpaOrgId, tpaOrgId), gte(orders.createdAt, start))
      : gte(orders.createdAt, start);

    const rows = await db
      .select({
        day: sql<string>`TO_CHAR(DATE_TRUNC('day', ${orders.createdAt}), 'YYYY-MM-DD')`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(orders)
      .where(whereClause)
      .groupBy(sql`DATE_TRUNC('day', ${orders.createdAt})`)
      .orderBy(sql`DATE_TRUNC('day', ${orders.createdAt})`);

    // Build a dense series with zeros for missing days
    const counts = new Map<string, number>();
    for (const r of rows) {
      counts.set(r.day, Number(r.count));
    }

    const series: Array<{ date: string; count: number }> = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      series.push({ date: key, count: counts.get(key) ?? 0 });
    }

    return NextResponse.json({ data: series });
  } catch (error) {
    console.error('Failed to fetch order volume:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order volume' },
      { status: 500 }
    );
  }
}
