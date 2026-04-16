/**
 * Auth security utilities: account lockout, login history, token generation.
 *
 * Centralizes security-sensitive auth operations so they're consistent and
 * easy to audit. All functions log to `login_history` where appropriate.
 */

import { db } from '@/db/client';
import { users, loginHistory } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';
import bcrypt from 'bcryptjs';

// Lockout policy
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

// Token policies
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a cryptographically secure URL-safe token.
 * Returns the raw token (for the email link) and its bcrypt hash (for DB storage).
 */
export async function generateSecureToken(): Promise<{ token: string; hash: string }> {
  const token = randomBytes(32).toString('base64url');
  const hash = await bcrypt.hash(token, 10);
  return { token, hash };
}

/**
 * Verify a submitted token against a stored hash.
 */
export async function verifyTokenHash(submittedToken: string, storedHash: string): Promise<boolean> {
  return bcrypt.compare(submittedToken, storedHash);
}

/**
 * Lookup key for finding a token in the DB quickly.
 * Since bcrypt hashes vary per-call, we can't lookup by hash directly.
 * Pattern: iterate recent unused tokens and compare each. Acceptable because
 * tokens are short-lived and the set is small.
 *
 * Alternative for scale: prefix the token with a lookup key, store both.
 * For this app's scale (low volume password resets), direct comparison is fine.
 */

export function tokenExpiryDates() {
  return {
    passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
    emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TOKEN_TTL_MS),
  };
}

// ============================================================================
// Account Lockout
// ============================================================================

export interface LockoutStatus {
  locked: boolean;
  remainingAttempts: number;
  unlockAt: Date | null;
}

/**
 * Check if an account is currently locked.
 */
export async function checkLockoutStatus(userId: string): Promise<LockoutStatus> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { failedLoginCount: true, lockedUntil: true },
  });

  if (!user) {
    return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS, unlockAt: null };
  }

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    return { locked: true, remainingAttempts: 0, unlockAt: user.lockedUntil };
  }

  return {
    locked: false,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - user.failedLoginCount),
    unlockAt: null,
  };
}

/**
 * Record a failed login attempt. Locks the account if threshold reached.
 */
export async function recordFailedLogin(userId: string): Promise<LockoutStatus> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { failedLoginCount: true },
  });

  if (!user) {
    return { locked: false, remainingAttempts: MAX_FAILED_ATTEMPTS, unlockAt: null };
  }

  const newCount = user.failedLoginCount + 1;
  const shouldLock = newCount >= MAX_FAILED_ATTEMPTS;
  const lockUntil = shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null;

  await db
    .update(users)
    .set({
      failedLoginCount: newCount,
      lastFailedLoginAt: new Date(),
      lockedUntil: lockUntil,
    })
    .where(eq(users.id, userId));

  return {
    locked: shouldLock,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - newCount),
    unlockAt: lockUntil,
  };
}

/**
 * Reset failed login counter on successful login.
 */
export async function resetFailedLoginCount(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastFailedLoginAt: null })
    .where(eq(users.id, userId));
}

// ============================================================================
// Login history logging
// ============================================================================

export type LoginEvent =
  | 'login_success'
  | 'login_failed_password'
  | 'login_failed_unknown_user'
  | 'login_failed_locked'
  | 'login_failed_inactive'
  | '2fa_challenge_sent'
  | '2fa_success'
  | '2fa_failed'
  | 'backup_code_used'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'password_reset_failed'
  | 'email_verification_sent'
  | 'email_verified'
  | 'account_locked'
  | 'account_unlocked'
  | 'logout_manual'
  | 'logout_idle_timeout'
  | 'sso_login_success'
  | 'sso_login_failed';

/**
 * Record a login/security event. Always succeeds (errors are swallowed so
 * auth flow is never blocked by logging failure).
 */
export async function logLoginEvent(params: {
  userId?: string | null;
  email: string;
  event: LoginEvent;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(loginHistory).values({
      userId: params.userId ?? null,
      email: params.email.toLowerCase(),
      event: params.event,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
      metadata: params.metadata,
    });
  } catch (err) {
    // Never let logging failure break auth flow
    console.error('Failed to write login history:', err);
  }
}

// ============================================================================
// IP / User-Agent extraction helpers
// ============================================================================

export function getClientIp(headers: Headers): string | null {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    null
  );
}

export function getClientUserAgent(headers: Headers): string | null {
  return headers.get('user-agent') || null;
}

// ============================================================================
// Hash a token with SHA-256 for lookup indexing
// (Alternative to bcrypt for tokens where we need fast lookup.)
// ============================================================================

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
