import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { users, passwordResetTokens } from '@/db/schema';
import { and, eq, gt, isNull, ne } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import {
  verifyTokenHash,
  logLoginEvent,
  getClientIp,
  getClientUserAgent,
} from '@/lib/auth-security';

export const dynamic = 'force-dynamic';

function validatePassword(pw: string): string | null {
  if (pw.length < 10) return 'Password must be at least 10 characters';
  if (!/[A-Z]/.test(pw)) return 'Password must include at least one uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must include at least one lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must include at least one digit';
  return null;
}

const GENERIC_ERROR = 'Invalid or expired reset link';

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request.headers);
  const userAgent = getClientUserAgent(request.headers);

  let email: string;
  let token: string;
  let newPassword: string;
  try {
    const body = await request.json();
    email = String(body?.email || '').toLowerCase().trim();
    token = String(body?.token || '');
    newPassword = String(body?.newPassword || '');
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!email || !token || !newPassword) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const pwErr = validatePassword(newPassword);
  if (pwErr) {
    return NextResponse.json({ error: pwErr }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  });

  if (!user) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const now = new Date();
  const candidates = await db.query.passwordResetTokens.findMany({
    where: and(
      eq(passwordResetTokens.userId, user.id),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, now)
    ),
  });

  let matched: (typeof candidates)[number] | null = null;
  for (const row of candidates) {
    if (await verifyTokenHash(token, row.tokenHash)) {
      matched = row;
      break;
    }
  }

  if (!matched) {
    await logLoginEvent({
      userId: user.id,
      email: user.email,
      event: 'password_reset_failed',
      ipAddress,
      userAgent,
    });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  const hashed = await bcrypt.hash(newPassword, 12);

  await db
    .update(users)
    .set({
      password: hashed,
      passwordChangedAt: now,
      mustChangePassword: false,
      failedLoginCount: 0,
      lockedUntil: null,
    })
    .where(eq(users.id, user.id));

  // Mark this token used
  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(passwordResetTokens.id, matched.id));

  // Invalidate all other unused tokens for this user
  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        isNull(passwordResetTokens.usedAt),
        ne(passwordResetTokens.id, matched.id)
      )
    );

  await logLoginEvent({
    userId: user.id,
    email: user.email,
    event: 'password_reset_completed',
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ success: true });
}
