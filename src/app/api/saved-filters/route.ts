import { NextResponse } from 'next/server';
import { withAuth } from '@/auth/api-middleware';
import { db } from '@/db';
import { savedFilters } from '@/db/schema';
import { and, eq, or, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/saved-filters?pageKey=... - list user's + shared filters for a page
// ============================================================================

export const GET = withAuth(async (req, user) => {
  if (!user.tpaOrgId) {
    return NextResponse.json({ filters: [] });
  }

  const { searchParams } = new URL(req.url);
  const pageKey = searchParams.get('pageKey');
  if (!pageKey) {
    return NextResponse.json(
      { error: 'pageKey query parameter is required' },
      { status: 400 }
    );
  }

  const filters = await db.query.savedFilters.findMany({
    where: and(
      eq(savedFilters.tpaOrgId, user.tpaOrgId),
      eq(savedFilters.pageKey, pageKey),
      or(
        eq(savedFilters.userId, user.id),
        eq(savedFilters.isShared, true)
      )
    ),
    orderBy: [desc(savedFilters.updatedAt)],
  });

  return NextResponse.json({
    filters: filters.map((f) => ({
      ...f,
      isOwner: f.userId === user.id,
    })),
  });
});

// ============================================================================
// POST /api/saved-filters - create new saved filter
// ============================================================================

export const POST = withAuth(async (req, user) => {
  if (!user.tpaOrgId) {
    return NextResponse.json(
      { error: 'Tenant context required' },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { pageKey, name, filters, isShared } = body || {};

  if (typeof pageKey !== 'string' || !pageKey) {
    return NextResponse.json({ error: 'pageKey is required' }, { status: 400 });
  }
  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!filters || typeof filters !== 'object') {
    return NextResponse.json({ error: 'filters object is required' }, { status: 400 });
  }

  const [created] = await db
    .insert(savedFilters)
    .values({
      userId: user.id,
      tpaOrgId: user.tpaOrgId,
      pageKey,
      name: name.trim().slice(0, 100),
      filters,
      isShared: Boolean(isShared),
    })
    .returning();

  return NextResponse.json({ filter: { ...created, isOwner: true } }, { status: 201 });
});
