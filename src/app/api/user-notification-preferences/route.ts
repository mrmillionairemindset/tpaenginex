import { NextResponse } from 'next/server';
import { withAuth } from '@/auth/api-middleware';
import { db } from '@/db';
import { userNotificationPreferences } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const BOOLEAN_FIELDS = [
  'emailOrderCompletion',
  'emailCollectorAssigned',
  'emailKitReminder',
  'emailResultsPending',
  'emailAnnualReview',
  'emailExpiryAlerts',
  'emailWeeklyDigest',
  'inAppOrderUpdates',
  'inAppDqfEvents',
  'inAppSystem',
] as const;

// GET — returns current user's preferences (creates default row if missing)
export const GET = withAuth(async (_req, user) => {
  let prefs = await db.query.userNotificationPreferences.findFirst({
    where: eq(userNotificationPreferences.userId, user.id),
  });

  if (!prefs) {
    const [created] = await db
      .insert(userNotificationPreferences)
      .values({ userId: user.id })
      .returning();
    prefs = created;
  }

  return NextResponse.json({ preferences: prefs });
});

// PATCH — update preferences for current user
export const PATCH = withAuth(async (req, user) => {
  const body = await req.json().catch(() => ({}));

  const updates: Record<string, boolean> = {};
  for (const field of BOOLEAN_FIELDS) {
    if (typeof body?.[field] === 'boolean') {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No valid preference fields provided' },
      { status: 400 }
    );
  }

  // Ensure row exists
  const existing = await db.query.userNotificationPreferences.findFirst({
    where: eq(userNotificationPreferences.userId, user.id),
  });

  if (!existing) {
    const [created] = await db
      .insert(userNotificationPreferences)
      .values({ userId: user.id, ...updates })
      .returning();
    return NextResponse.json({ preferences: created });
  }

  const [updated] = await db
    .update(userNotificationPreferences)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(userNotificationPreferences.userId, user.id))
    .returning();

  return NextResponse.json({ preferences: updated });
});
