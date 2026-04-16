/**
 * GET /api/api-keys/[id]/usage — usage stats + recent request log for one key.
 *
 * Response:
 *   {
 *     summary: { total, successful, failed, last24h, last7d },
 *     byStatus: [{ statusCode, count }, ...],
 *     recent: [{ method, path, statusCode, ipAddress, durationMs, createdAt, errorMessage }, ...]
 *   }
 */

import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { apiKeys, apiKeyUsage } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function canManage(role: string | null): boolean {
  return role === 'tpa_admin' || role === 'platform_admin';
}

export const GET = withAuth(async (_req, user, ctx: { params: Promise<{ id: string }> }) => {
  if (!canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const { id } = await ctx.params;

  // Verify the key belongs to this TPA before exposing its usage
  const key = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.id, id), eq(apiKeys.tpaOrgId, user.tpaOrgId)),
  });
  if (!key) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 });
  }

  const now = new Date();
  const day = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const week = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [totalRow, last24hRow, last7dRow, successRow, failRow, byStatus, recent] = await Promise.all([
    db.select({ c: count() }).from(apiKeyUsage).where(eq(apiKeyUsage.apiKeyId, id)),
    db.select({ c: count() }).from(apiKeyUsage).where(
      and(eq(apiKeyUsage.apiKeyId, id), gte(apiKeyUsage.createdAt, day))
    ),
    db.select({ c: count() }).from(apiKeyUsage).where(
      and(eq(apiKeyUsage.apiKeyId, id), gte(apiKeyUsage.createdAt, week))
    ),
    db.select({ c: count() }).from(apiKeyUsage).where(
      and(eq(apiKeyUsage.apiKeyId, id), sql`${apiKeyUsage.statusCode} < 400`)
    ),
    db.select({ c: count() }).from(apiKeyUsage).where(
      and(eq(apiKeyUsage.apiKeyId, id), sql`${apiKeyUsage.statusCode} >= 400`)
    ),
    db
      .select({
        statusCode: apiKeyUsage.statusCode,
        count: count(),
      })
      .from(apiKeyUsage)
      .where(eq(apiKeyUsage.apiKeyId, id))
      .groupBy(apiKeyUsage.statusCode)
      .orderBy(desc(count())),
    db.query.apiKeyUsage.findMany({
      where: eq(apiKeyUsage.apiKeyId, id),
      orderBy: [desc(apiKeyUsage.createdAt)],
      limit: 100,
    }),
  ]);

  return NextResponse.json({
    summary: {
      total: totalRow[0]?.c ?? 0,
      successful: successRow[0]?.c ?? 0,
      failed: failRow[0]?.c ?? 0,
      last24h: last24hRow[0]?.c ?? 0,
      last7d: last7dRow[0]?.c ?? 0,
    },
    byStatus,
    recent: recent.map((r) => ({
      method: r.method,
      path: r.path,
      statusCode: r.statusCode,
      ipAddress: r.ipAddress,
      durationMs: r.durationMs,
      errorMessage: r.errorMessage,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});
