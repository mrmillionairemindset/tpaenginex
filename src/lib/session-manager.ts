/**
 * Session device management.
 *
 * We use NextAuth's JWT strategy for the auth token, but track a separate
 * session record in the `user_sessions` table per device for:
 *  - Remote session revocation (sign out on device X from device Y)
 *  - Device management UI (list active sessions)
 *  - Audit trail (who logged in from where)
 *
 * The `sessionToken` is stored in the JWT; getCurrentUser() validates it
 * against the DB row on each request. If the row is revoked or expired,
 * the session is treated as invalid.
 */

import { db } from '@/db/client';
import { userSessions } from '@/db/schema';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { UAParser } from 'ua-parser-js';

// 8-hour session max (matches NextAuth JWT maxAge)
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

// Throttle lastSeenAt updates to avoid DB spam on every request
const LAST_SEEN_THROTTLE_MS = 60 * 1000;

/**
 * Parse a User-Agent string into a human-readable device label.
 * Examples:
 *   "Chrome 120 on macOS"
 *   "Safari on iPhone"
 *   "Firefox 125 on Windows"
 */
export function parseDeviceLabel(userAgent: string | null | undefined): string {
  if (!userAgent) return 'Unknown device';

  const parser = new UAParser(userAgent);
  const browser = parser.getBrowser();
  const os = parser.getOS();
  const device = parser.getDevice();

  const browserName = browser.name || 'Unknown browser';
  const browserVersion = browser.version ? browser.version.split('.')[0] : '';
  const osName = os.name || 'Unknown OS';
  const deviceType = device.type; // 'mobile' | 'tablet' | 'console' | 'smarttv' | 'wearable' | 'xr' | 'embedded' | undefined

  const browserLabel = browserVersion ? `${browserName} ${browserVersion}` : browserName;
  const osLabel = deviceType === 'mobile' && device.model ? `${device.model} (${osName})` : osName;

  return `${browserLabel} on ${osLabel}`;
}

/**
 * Create a new session record for a successful login.
 * Returns the opaque session token to embed in the JWT.
 */
export async function createSession(params: {
  userId: string;
  ipAddress: string | null;
  userAgent: string | null;
}): Promise<string> {
  const sessionToken = randomBytes(32).toString('base64url');
  const deviceLabel = parseDeviceLabel(params.userAgent);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(userSessions).values({
    userId: params.userId,
    sessionToken,
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    deviceLabel,
    expiresAt,
  });

  return sessionToken;
}

/**
 * Validate a session token. Returns the session row if valid, null otherwise.
 * Does NOT update lastSeenAt — callers should do that separately to avoid
 * hot-path DB writes on every API call.
 */
export async function validateSession(sessionToken: string | undefined) {
  if (!sessionToken) return null;

  const session = await db.query.userSessions.findFirst({
    where: eq(userSessions.sessionToken, sessionToken),
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt < new Date()) return null;

  return session;
}

/**
 * Update lastSeenAt timestamp, but throttled — only writes if the last update
 * was more than LAST_SEEN_THROTTLE_MS ago.
 */
export async function touchSession(sessionToken: string, currentLastSeen: Date): Promise<void> {
  const now = Date.now();
  if (now - currentLastSeen.getTime() < LAST_SEEN_THROTTLE_MS) return;

  await db
    .update(userSessions)
    .set({ lastSeenAt: new Date(now) })
    .where(eq(userSessions.sessionToken, sessionToken));
}

/**
 * Revoke a specific session (sign-out on device).
 */
export async function revokeSession(sessionId: string, userId: string): Promise<void> {
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.id, sessionId), eq(userSessions.userId, userId)));
}

/**
 * Revoke a session by its token (used on logout).
 */
export async function revokeSessionByToken(sessionToken: string): Promise<void> {
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(eq(userSessions.sessionToken, sessionToken));
}

/**
 * Revoke all sessions for a user EXCEPT the current one (sign-out everywhere else).
 */
export async function revokeOtherSessions(userId: string, currentSessionToken: string): Promise<number> {
  const sessions = await db.query.userSessions.findMany({
    where: and(
      eq(userSessions.userId, userId),
      isNull(userSessions.revokedAt)
    ),
  });

  const toRevoke = sessions.filter((s) => s.sessionToken !== currentSessionToken);
  if (toRevoke.length === 0) return 0;

  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(userSessions.userId, userId),
        isNull(userSessions.revokedAt),
        // Drizzle doesn't have `ne` for varchar easily; filter in JS is safer here since set is small
      )
    );

  // Re-revoke just the ones we want (simpler than constructing a complex where)
  for (const s of toRevoke) {
    await db
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(eq(userSessions.id, s.id));
  }

  return toRevoke.length;
}

/**
 * List active sessions for a user (unrevoked, unexpired), newest first.
 */
export async function listUserSessions(userId: string) {
  return db.query.userSessions.findMany({
    where: and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)),
    orderBy: (s, { desc }) => [desc(s.lastSeenAt)],
  });
}

/**
 * Cleanup expired sessions (can be called by a cron job).
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const expired = await db
    .delete(userSessions)
    .where(
      and(
        lt(userSessions.expiresAt, new Date()),
        isNull(userSessions.revokedAt)
      )
    )
    .returning({ id: userSessions.id });
  return expired.length;
}
