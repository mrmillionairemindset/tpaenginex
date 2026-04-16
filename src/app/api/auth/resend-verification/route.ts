import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { emailVerificationTokens, tpaSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/auth/get-user';
import {
  generateSecureToken,
  tokenExpiryDates,
  logLoginEvent,
  getClientIp,
  getClientUserAgent,
} from '@/lib/auth-security';
import { checkRateLimitAsync } from '@/lib/rate-limit';
import { sendEmailVerification } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ipAddress = getClientIp(request.headers) || 'unknown';
  const userAgent = getClientUserAgent(request.headers);

  const rl = await checkRateLimitAsync(`resend-verify:${ipAddress}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 }
    );
  }

  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // If already verified, no-op
  const dbUser = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, current.id),
  });
  if (!dbUser) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (dbUser.emailVerified) {
    return NextResponse.json({ success: true, alreadyVerified: true });
  }

  const { token, hash } = await generateSecureToken();
  const { emailVerificationExpiresAt } = tokenExpiryDates();

  await db.insert(emailVerificationTokens).values({
    userId: dbUser.id,
    tokenHash: hash,
    email: dbUser.email,
    expiresAt: emailVerificationExpiresAt,
  });

  // Resolve branding
  let branding: { brandName?: string | null; replyToEmail?: string | null } | undefined;
  if (current.tpaOrgId) {
    const settings = await db.query.tpaSettings.findFirst({
      where: eq(tpaSettings.tpaOrgId, current.tpaOrgId),
    });
    if (settings) {
      branding = { brandName: settings.brandName, replyToEmail: settings.replyToEmail };
    }
  }

  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://tpaenginex.com';
  const verifyUrl = `${appUrl}/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(dbUser.email)}`;

  await sendEmailVerification({
    to: dbUser.email,
    name: dbUser.name,
    verifyUrl,
    branding,
  });

  await logLoginEvent({
    userId: dbUser.id,
    email: dbUser.email,
    event: 'email_verification_sent',
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ success: true });
}
