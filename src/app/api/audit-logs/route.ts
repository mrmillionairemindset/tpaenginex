import { NextResponse } from 'next/server';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { and, eq, gte, lte, desc, count, type SQL } from 'drizzle-orm';
import { parsePagination } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

// GET /api/audit-logs - List audit logs (tpa_admin, platform_admin)
export const GET = withAuth(async (req, user) => {
  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const entityType = searchParams.get('entityType');
  const entityId = searchParams.get('entityId');
  const actorUserId = searchParams.get('actorUserId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const { page, limit, offset } = parsePagination(searchParams);

  const conditions: SQL[] = [];

  // Tenant isolation: platform_admin with no tpaOrgId can see all; otherwise filter
  if (user.role === 'platform_admin') {
    if (user.tpaOrgId) {
      conditions.push(eq(auditLogs.tpaOrgId, user.tpaOrgId));
    }
    // else: no filter - platform admin sees all
  } else {
    if (!user.tpaOrgId) {
      return NextResponse.json({ error: 'No TPA context' }, { status: 400 });
    }
    conditions.push(eq(auditLogs.tpaOrgId, user.tpaOrgId));
  }

  if (entityType) conditions.push(eq(auditLogs.entityType, entityType));
  if (entityId) conditions.push(eq(auditLogs.entityId, entityId));
  if (actorUserId) conditions.push(eq(auditLogs.actorUserId, actorUserId));

  if (startDate) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) {
      conditions.push(gte(auditLogs.createdAt, start));
    }
  }
  if (endDate) {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      conditions.push(lte(auditLogs.createdAt, end));
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, [{ count: total }]] = await Promise.all([
    db.query.auditLogs.findMany({
      where: whereClause,
      with: {
        actor: {
          columns: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [desc(auditLogs.createdAt)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(auditLogs).where(whereClause),
  ]);

  return NextResponse.json({
    logs,
    pagination: {
      page,
      limit,
      total: Number(total),
      totalPages: Math.ceil(Number(total) / limit),
      hasMore: offset + logs.length < Number(total),
    },
  });
});
