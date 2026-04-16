import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { users, passwordResetTokens, tpaSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import {
  generateSecureToken,
  tokenExpiryDates,
  logLoginEvent,
  getClientIp,
  getClientUserAgent,
} from '@/lib/auth-security';
import { checkRateLimitAsync } from '@/lib/rate-limit';
import { sendPasswordResetEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

// A dummy bcrypt hash used for timing-attack prevention when the user isn't found.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8e8eZc8wZrCwqKXlO6iZqYyh9M8yYy';

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request.headers) || 'unknown';
  const userAgent = getClientUserAgent(request.headers);

  const rl = await checkRateLimitAsync(ipAddress);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  let email: string;
  try {
    const body = await request.json();
    email = String(body?.email || '').toLowerCase().trim();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    with: { organization: true },
  });

  if (!user || !user.isActive) {
    // Constant-time dummy compare to prevent user-enumeration via timing
    await bcrypt.compare('dummy', DUMMY_HASH);
    return NextResponse.json({ success: true });
  }

  try {
    const { token, hash } = await generateSecureToken();
    const { passwordResetExpiresAt } = tokenExpiryDates();

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: hash,
      expiresAt: passwordResetExpiresAt,
      ipAddress,
      userAgent,
    });

    // Resolve branding (if user is part of a TPA)
    let branding: { brandName?: string | null; replyToEmail?: string | null } | undefined;
    const tpaOrgId =
      user.organization?.type === 'tpa'
        ? user.organization.id
        : user.organization?.type === 'client'
        ? user.organization.tpaOrgId
        : null;
    if (tpaOrgId) {
      const settings = await db.query.tpaSettings.findFirst({
        where: eq(tpaSettings.tpaOrgId, tpaOrgId),
      });
      if (settings) {
        branding = { brandName: settings.brandName, replyToEmail: settings.replyToEmail };
      }
    }

    const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://tpaenginex.com';
    const resetUrl = `${appUrl}/auth/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      branding,
    });

    await logLoginEvent({
      userId: user.id,
      email: user.email,
      event: 'password_reset_requested',
      ipAddress,
      userAgent,
    });
  } catch (err) {
    console.error('forgot-password error:', err);
    // Still return success to avoid leaking details
  }

  return NextResponse.json({ success: true });
}
