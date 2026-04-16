/**
 * POST /api/auth/pre-check — check if 2FA is required before the main signin call.
 *
 * This endpoint validates email + password and returns whether the user has 2FA
 * enabled. It does NOT create a session. The client uses the result to decide
 * whether to show a TOTP input before calling signIn("credentials", ...).
 *
 * Security:
 * - Rate-limited per IP (prevents password spraying)
 * - Account lockout enforced (wraps `auth-security` helpers)
 * - Generic "Invalid credentials" error for unknown email OR wrong password
 * - Lockout status only revealed after a correct password submission
 * - Constant-time password comparison via bcrypt
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { checkRateLimitAsync } from '@/lib/rate-limit';
import { z } from 'zod';
import {
  checkLockoutStatus,
  recordFailedLogin,
  logLoginEvent,
  getClientIp,
  getClientUserAgent,
} from '@/lib/auth-security';

export const dynamic = 'force-dynamic';

const preCheckSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Static bcrypt hash used for timing-attack defense when user doesn't exist.
const DUMMY_BCRYPT_HASH =
  '$2a$10$abcdefghijklmnopqrstuv.abcdefghijklmnopqrstuvwxyzABCDEF';

export async function POST(req: NextRequest) {
  const ipAddress = getClientIp(req.headers);
  const userAgent = getClientUserAgent(req.headers);

  // Rate limit by IP to prevent credential stuffing
  const ip = ipAddress || 'unknown';
  const rate = await checkRateLimitAsync(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again in a minute.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) },
      }
    );
  }

  const body = await req.json();
  const validation = preCheckSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const email = validation.data.email;
  const submittedPassword = validation.data.password;

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: {
      id: true,
      email: true,
      password: true,
      totpEnabled: true,
      isActive: true,
    },
  });

  // Unknown/disabled user → perform dummy bcrypt for constant timing, return generic 401
  if (!user || !user.password || !user.isActive) {
    await bcrypt.compare(submittedPassword, DUMMY_BCRYPT_HASH);
    await logLoginEvent({
      email,
      event: 'login_failed_unknown_user',
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Check lockout status. If locked, perform dummy bcrypt & return generic 401
  // UNLESS the password is correct — in which case we can safely reveal lockout.
  const lockoutStatus = await checkLockoutStatus(user.id);

  const passwordMatch = await bcrypt.compare(submittedPassword, user.password);

  if (!passwordMatch) {
    // Wrong password — record the failed attempt (progresses lockout even if already locked)
    const newStatus = await recordFailedLogin(user.id);
    await logLoginEvent({
      userId: user.id,
      email: user.email,
      event: 'login_failed_password',
      ipAddress,
      userAgent,
      metadata: { remainingAttempts: newStatus.remainingAttempts },
    });
    if (newStatus.locked && !lockoutStatus.locked) {
      await logLoginEvent({
        userId: user.id,
        email: user.email,
        event: 'account_locked',
        ipAddress,
        userAgent,
        metadata: { unlockAt: newStatus.unlockAt?.toISOString() },
      });
    }
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Password is correct. If the account is locked, now it's safe to reveal that.
  if (lockoutStatus.locked) {
    await logLoginEvent({
      userId: user.id,
      email: user.email,
      event: 'login_failed_locked',
      ipAddress,
      userAgent,
      metadata: { unlockAt: lockoutStatus.unlockAt?.toISOString() },
    });
    return NextResponse.json(
      {
        locked: true,
        unlockAt: lockoutStatus.unlockAt?.toISOString() ?? null,
        error: 'Account locked due to too many failed login attempts.',
      },
      { status: 403 }
    );
  }

  // NOTE: Do not reset failedLoginCount here — that happens in `authorize()` on
  // actual successful signIn (after 2FA if required). Password-correct at
  // pre-check doesn't mean login succeeds.

  return NextResponse.json({
    requires2fa: user.totpEnabled,
  });
}
