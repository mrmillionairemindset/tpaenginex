import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db/client';
import { webhookDeliveries, webhookSubscriptions } from '@/db/schema';
import { and, desc, eq, gte, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/analytics/webhooks
// Returns webhook delivery aggregates for the caller's TPA over the last N days.
// Query params:
//   days — integer in [1, 90], default 7
// ============================================================================

const ALLOWED_ROLES = new Set(['tpa_admin', 'tpa_staff', 'platform_admin']);

function parseDays(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 7;
  if (n > 90) return 90;
  return Math.floor(n);
}

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!user.role || !ALLOWED_ROLES.has(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tpaOrgId = user.tpaOrgId;
    if (!tpaOrgId && user.role !== 'platform_admin') {
      return NextResponse.json(
        { error: 'TPA context required' },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const days = parseDays(url.searchParams.get('days'));

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));

    const whereClause = tpaOrgId
      ? and(
          eq(webhookDeliveries.tpaOrgId, tpaOrgId),
          gte(webhookDeliveries.createdAt, start)
        )
      : gte(webhookDeliveries.createdAt, start);

    // --- Summary totals ---
    const [totals] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        successful: sql<number>`COUNT(*) FILTER (WHERE ${webhookDeliveries.status} = 'success')::int`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${webhookDeliveries.status} = 'failed')::int`,
        deadLetter: sql<number>`COUNT(*) FILTER (WHERE ${webhookDeliveries.status} = 'dead_letter')::int`,
      })
      .from(webhookDeliveries)
      .where(whereClause);

    const total = Number(totals?.total ?? 0);
    const successful = Number(totals?.successful ?? 0);
    const failed = Number(totals?.failed ?? 0);
    const deadLetter = Number(totals?.deadLetter ?? 0);
    // Rate is success / (success + failed + dead_letter). `pending` attempts
    // are excluded because they haven't resolved yet.
    const resolved = successful + failed + deadLetter;
    const successRate = resolved > 0 ? successful / resolved : 0;

    // --- Per-day series ---
    const perDayRows = await db
      .select({
        day: sql<string>`TO_CHAR(DATE_TRUNC('day', ${webhookDeliveries.createdAt}), 'YYYY-MM-DD')`,
        success: sql<number>`COUNT(*) FILTER (WHERE ${webhookDeliveries.status} = 'success')::int`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${webhookDeliveries.status} IN ('failed','dead_letter'))::int`,
      })
      .from(webhookDeliveries)
      .where(whereClause)
      .groupBy(sql`DATE_TRUNC('day', ${webhookDeliveries.createdAt})`)
      .orderBy(sql`DATE_TRUNC('day', ${webhookDeliveries.createdAt})`);

    const dayMap = new Map(perDayRows.map((r) => [r.day, r]));
    const perDay: Array<{ date: string; success: number; failed: number }> = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      const row = dayMap.get(key);
      perDay.push({
        date: key,
        success: row ? Number(row.success) : 0,
        failed: row ? Number(row.failed) : 0,
      });
    }

    // --- By event ---
    const byEventRows = await db
      .select({
        event: webhookDeliveries.event,
        count: sql<number>`COUNT(*)::int`,
        successful: sql<number>`COUNT(*) FILTER (WHERE ${webhookDeliveries.status} = 'success')::int`,
        resolved: sql<number>`COUNT(*) FILTER (WHERE ${webhookDeliveries.status} IN ('success','failed','dead_letter'))::int`,
      })
      .from(webhookDeliveries)
      .where(whereClause)
      .groupBy(webhookDeliveries.event)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(20);

    const byEvent = byEventRows.map((r) => {
      const resolvedCount = Number(r.resolved);
      return {
        event: r.event,
        count: Number(r.count),
        successRate: resolvedCount > 0 ? Number(r.successful) / resolvedCount : 0,
      };
    });

    // --- By subscription (joined for URL) ---
    const bySubRows = await db
      .select({
        subscriptionId: webhookDeliveries.subscriptionId,
        url: webhookSubscriptions.url,
        count: sql<number>`COUNT(*)::int`,
        failures: sql<number>`COUNT(*) FILTER (WHERE ${webhookDeliveries.status} IN ('failed','dead_letter'))::int`,
        resolved: sql<number>`COUNT(*) FILTER (WHERE ${webhookDeliveries.status} IN ('success','failed','dead_letter'))::int`,
      })
      .from(webhookDeliveries)
      .innerJoin(
        webhookSubscriptions,
        eq(webhookSubscriptions.id, webhookDeliveries.subscriptionId)
      )
      .where(whereClause)
      .groupBy(webhookDeliveries.subscriptionId, webhookSubscriptions.url)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);

    const bySubscription = bySubRows.map((r) => {
      const resolvedCount = Number(r.resolved);
      return {
        subscriptionId: r.subscriptionId,
        url: r.url,
        count: Number(r.count),
        failureRate: resolvedCount > 0 ? Number(r.failures) / resolvedCount : 0,
      };
    });

    // --- Recent failures ---
    const recentFailuresRows = await db
      .select({
        id: webhookDeliveries.id,
        subscriptionId: webhookDeliveries.subscriptionId,
        event: webhookDeliveries.event,
        url: webhookSubscriptions.url,
        responseStatus: webhookDeliveries.responseStatus,
        errorMessage: webhookDeliveries.errorMessage,
        status: webhookDeliveries.status,
        attempts: webhookDeliveries.attempts,
        createdAt: webhookDeliveries.createdAt,
      })
      .from(webhookDeliveries)
      .innerJoin(
        webhookSubscriptions,
        eq(webhookSubscriptions.id, webhookDeliveries.subscriptionId)
      )
      .where(
        tpaOrgId
          ? and(
              eq(webhookDeliveries.tpaOrgId, tpaOrgId),
              gte(webhookDeliveries.createdAt, start),
              sql`${webhookDeliveries.status} IN ('failed','dead_letter')`
            )
          : and(
              gte(webhookDeliveries.createdAt, start),
              sql`${webhookDeliveries.status} IN ('failed','dead_letter')`
            )
      )
      .orderBy(desc(webhookDeliveries.createdAt))
      .limit(25);

    return NextResponse.json({
      totalDeliveries: total,
      successful,
      failed,
      deadLetter,
      successRate,
      perDay,
      byEvent,
      bySubscription,
      recentFailures: recentFailuresRows.map((r) => ({
        id: r.id,
        subscriptionId: r.subscriptionId,
        event: r.event,
        url: r.url,
        responseStatus: r.responseStatus,
        errorMessage: r.errorMessage,
        status: r.status,
        attempts: r.attempts,
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error('Failed to compute webhook analytics:', error);
    return NextResponse.json(
      { error: 'Failed to compute analytics' },
      { status: 500 }
    );
  }
}
