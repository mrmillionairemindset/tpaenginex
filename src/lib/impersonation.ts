/**
 * Platform-admin impersonation sessions.
 *
 * A platform_admin may assume another user's identity for a bounded period
 * (default 60 minutes, max 240). Every session is auditable: who, whom,
 * why, from where, for how long.
 *
 * When an active session exists, getCurrentUser() returns the target user's
 * org/role context while flagging `isImpersonating` and exposing the admin's
 * actual ID as `actualUserId`. This preserves RLS via tpaOrgId without
 * requiring any route-level changes.
 */

import { db } from '@/db/client';
import { impersonationSessions, users } from '@/db/schema';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';

const DEFAULT_DURATION_MINUTES = 60;
const MAX_DURATION_MINUTES = 240;

export async function startImpersonation(params: {
  adminUserId: string;
  targetUserId: string;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
  durationMinutes?: number;
}): Promise<{ sessionId: string; expiresAt: Date }> {
  const duration = Math.min(
    Math.max(1, params.durationMinutes ?? DEFAULT_DURATION_MINUTES),
    MAX_DURATION_MINUTES
  );

  // End any existing active session for this admin first (only one at a time)
  await db
    .update(impersonationSessions)
    .set({ endedAt: new Date() })
    .where(
      and(
        eq(impersonationSessions.adminUserId, params.adminUserId),
        isNull(impersonationSessions.endedAt)
      )
    );

  const expiresAt = new Date(Date.now() + duration * 60 * 1000);

  const [inserted] = await db
    .insert(impersonationSessions)
    .values({
      adminUserId: params.adminUserId,
      targetUserId: params.targetUserId,
      reason: params.reason,
      expiresAt,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    })
    .returning();

  return { sessionId: inserted.id, expiresAt };
}

export async function endImpersonation(sessionId: string): Promise<void> {
  await db
    .update(impersonationSessions)
    .set({ endedAt: new Date() })
    .where(eq(impersonationSessions.id, sessionId));
}

/**
 * End the currently-active session for an admin (if any).
 * Returns the session that was ended, or null.
 */
export async function endActiveImpersonation(adminUserId: string) {
  const active = await getActiveImpersonation(adminUserId);
  if (!active) return null;
  await endImpersonation(active.id);
  return active;
}

export async function getActiveImpersonation(adminUserId: string) {
  const now = new Date();
  const row = await db.query.impersonationSessions.findFirst({
    where: and(
      eq(impersonationSessions.adminUserId, adminUserId),
      isNull(impersonationSessions.endedAt),
      gt(impersonationSessions.expiresAt, now)
    ),
    orderBy: [desc(impersonationSessions.startedAt)],
  });
  return row ?? null;
}

export async function getImpersonationHistory(limit = 100) {
  const rows = await db
    .select({
      session: impersonationSessions,
    })
    .from(impersonationSessions)
    .orderBy(desc(impersonationSessions.startedAt))
    .limit(limit);

  const userIds = new Set<string>();
  for (const r of rows) {
    userIds.add(r.session.adminUserId);
    userIds.add(r.session.targetUserId);
  }

  const userRows = userIds.size
    ? await db.query.users.findMany({
        where: (u, { inArray }) => inArray(u.id, Array.from(userIds)),
        columns: { id: true, name: true, email: true },
      })
    : [];

  const userMap = new Map(userRows.map((u) => [u.id, u]));

  return rows.map((r) => ({
    ...r.session,
    admin: userMap.get(r.session.adminUserId) ?? null,
    target: userMap.get(r.session.targetUserId) ?? null,
  }));
}

export { DEFAULT_DURATION_MINUTES, MAX_DURATION_MINUTES };
