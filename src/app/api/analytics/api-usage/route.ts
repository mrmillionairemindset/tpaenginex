import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db/client';
import { apiKeyUsage, apiKeys } from '@/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/analytics/api-usage
// Returns API key usage aggregates for the caller's TPA over the last N days.
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

    // Build WHERE filter: scope to tpaOrgId when present. A platform_admin with
    // no tpaOrgId will see platform-wide aggregates — this matches existing
    // dashboard behavior (see /api/dashboard/order-volume).
    const whereClause = tpaOrgId
      ? and(eq(apiKeyUsage.tpaOrgId, tpaOrgId), gte(apiKeyUsage.createdAt, start))
      : gte(apiKeyUsage.createdAt, start);

    // --- Summary totals ---
    const [totals] = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
        successful: sql<number>`COUNT(*) FILTER (WHERE ${apiKeyUsage.statusCode} < 400)::int`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${apiKeyUsage.statusCode} >= 400)::int`,
        avgDuration: sql<number | null>`AVG(${apiKeyUsage.durationMs})::float`,
      })
      .from(apiKeyUsage)
      .where(whereClause);

    // --- Per-day series ---
    const perDayRows = await db
      .select({
        day: sql<string>`TO_CHAR(DATE_TRUNC('day', ${apiKeyUsage.createdAt}), 'YYYY-MM-DD')`,
        total: sql<number>`COUNT(*)::int`,
        failed: sql<number>`COUNT(*) FILTER (WHERE ${apiKeyUsage.statusCode} >= 400)::int`,
      })
      .from(apiKeyUsage)
      .where(whereClause)
      .groupBy(sql`DATE_TRUNC('day', ${apiKeyUsage.createdAt})`)
      .orderBy(sql`DATE_TRUNC('day', ${apiKeyUsage.createdAt})`);

    const dayMap = new Map(perDayRows.map((r) => [r.day, r]));
    const perDay: Array<{ date: string; total: number; failed: number }> = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      const row = dayMap.get(key);
      perDay.push({
        date: key,
        total: row ? Number(row.total) : 0,
        failed: row ? Number(row.failed) : 0,
      });
    }

    // --- Top endpoints (method + path) ---
    const topEndpoints = await db
      .select({
        path: apiKeyUsage.path,
        method: apiKeyUsage.method,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(apiKeyUsage)
      .where(whereClause)
      .groupBy(apiKeyUsage.path, apiKeyUsage.method)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);

    // --- Top keys (joined on api_keys for label + prefix) ---
    const topKeysRaw = await db
      .select({
        keyId: apiKeyUsage.apiKeyId,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(apiKeyUsage)
      .innerJoin(apiKeys, eq(apiKeys.id, apiKeyUsage.apiKeyId))
      .where(whereClause)
      .groupBy(apiKeyUsage.apiKeyId, apiKeys.name, apiKeys.keyPrefix)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(10);

    // --- Status distribution ---
    const statusDistribution = await db
      .select({
        statusCode: apiKeyUsage.statusCode,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(apiKeyUsage)
      .where(whereClause)
      .groupBy(apiKeyUsage.statusCode)
      .orderBy(sql`COUNT(*) DESC`);

    // --- Slowest endpoints by average duration ---
    // Minimum sample size of 5 to avoid one-off outliers.
    const slowestEndpoints = await db
      .select({
        path: apiKeyUsage.path,
        method: apiKeyUsage.method,
        avgMs: sql<number>`AVG(${apiKeyUsage.durationMs})::float`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(apiKeyUsage)
      .where(whereClause)
      .groupBy(apiKeyUsage.path, apiKeyUsage.method)
      .having(sql`COUNT(*) >= 5 AND AVG(${apiKeyUsage.durationMs}) IS NOT NULL`)
      .orderBy(sql`AVG(${apiKeyUsage.durationMs}) DESC NULLS LAST`)
      .limit(10);

    return NextResponse.json({
      totalRequests: Number(totals?.total ?? 0),
      successfulRequests: Number(totals?.successful ?? 0),
      failedRequests: Number(totals?.failed ?? 0),
      avgDurationMs:
        totals?.avgDuration != null ? Math.round(Number(totals.avgDuration)) : 0,
      perDay,
      topEndpoints: topEndpoints.map((r) => ({
        path: r.path,
        method: r.method,
        count: Number(r.count),
      })),
      topKeys: topKeysRaw.map((r) => ({
        keyId: r.keyId,
        name: r.name,
        keyPrefix: r.keyPrefix,
        count: Number(r.count),
      })),
      statusDistribution: statusDistribution.map((r) => ({
        statusCode: r.statusCode,
        count: Number(r.count),
      })),
      slowestEndpoints: slowestEndpoints.map((r) => ({
        path: r.path,
        method: r.method,
        avgMs: Math.round(Number(r.avgMs ?? 0)),
        count: Number(r.count),
      })),
    });
  } catch (error) {
    console.error('Failed to compute API usage analytics:', error);
    return NextResponse.json(
      { error: 'Failed to compute analytics' },
      { status: 500 }
    );
  }
}
