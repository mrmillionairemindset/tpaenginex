import { NextResponse } from 'next/server';
import { withAuth } from '@/auth/api-middleware';
import { db } from '@/db';
import { savedFilters } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// ============================================================================
// DELETE /api/saved-filters/[id] - delete a saved filter (owner only)
// ============================================================================

export const DELETE = withAuth(async (_req, user, context) => {
  const { id } = context.params;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const existing = await db.query.savedFilters.findFirst({
    where: eq(savedFilters.id, id),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (existing.userId !== user.id) {
    return NextResponse.json(
      { error: 'Forbidden: You can only delete your own saved filters' },
      { status: 403 }
    );
  }

  await db.delete(savedFilters).where(eq(savedFilters.id, id));

  return NextResponse.json({ success: true });
});

// ============================================================================
// PATCH /api/saved-filters/[id] - update a saved filter (owner only)
// ============================================================================

export const PATCH = withAuth(async (req, user, context) => {
  const { id } = context.params;
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const existing = await db.query.savedFilters.findFirst({
    where: eq(savedFilters.id, id),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (existing.userId !== user.id) {
    return NextResponse.json(
      { error: 'Forbidden: You can only update your own saved filters' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { name, filters, isShared } = body || {};

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof name === 'string' && name.trim()) {
    updates.name = name.trim().slice(0, 100);
  }
  if (filters && typeof filters === 'object') {
    updates.filters = filters;
  }
  if (typeof isShared === 'boolean') {
    updates.isShared = isShared;
  }

  const [updated] = await db
    .update(savedFilters)
    .set(updates)
    .where(and(eq(savedFilters.id, id), eq(savedFilters.userId, user.id)))
    .returning();

  return NextResponse.json({ filter: { ...updated, isOwner: true } });
});
