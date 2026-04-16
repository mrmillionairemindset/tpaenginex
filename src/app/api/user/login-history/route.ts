/**
 * GET /api/user/login-history — returns the current user's recent login/security
 * events (last 30 days, paginated). Used by the security settings page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { loginHistory } from '@/db/schema';
import { and, eq, gte, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;
const WINDOW_DAYS = 30;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get('limit')) || DEFAULT_LIMIT;
  const limit = Math.min(Math.max(1, limitParam), MAX_LIMIT);
  const offset = Math.max(0, Number(searchParams.get('offset')) || 0);

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      id: loginHistory.id,
      event: loginHistory.event,
      ipAddress: loginHistory.ipAddress,
      userAgent: loginHistory.userAgent,
      metadata: loginHistory.metadata,
      createdAt: loginHistory.createdAt,
    })
    .from(loginHistory)
    .where(
      and(
        eq(loginHistory.userId, session.user.id),
        gte(loginHistory.createdAt, since)
      )
    )
    .orderBy(desc(loginHistory.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json({
    events: rows,
    limit,
    offset,
    windowDays: WINDOW_DAYS,
  });
}
