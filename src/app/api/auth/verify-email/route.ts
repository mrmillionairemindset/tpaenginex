import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { users, emailVerificationTokens } from '@/db/schema';
import { and, eq, gt, isNull } from 'drizzle-orm';
import {
  verifyTokenHash,
  logLoginEvent,
  getClientIp,
  getClientUserAgent,
} from '@/lib/auth-security';

export const dynamic = 'force-dynamic';

const GENERIC_ERROR = 'Invalid or expired verification link';

async function handle(email: string, token: string, request: NextRequest) {
  const ipAddress = getClientIp(request.headers);
  const userAgent = getClientUserAgent(request.headers);

  if (!email || !token) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });

  if (!user) {
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  // Already verified — treat as success
  if (user.emailVerified) {
    return NextResponse.json({ success: true, alreadyVerified: true });
  }

  const now = new Date();
  const candidates = await db.query.emailVerificationTokens.findMany({
    where: and(
      eq(emailVerificationTokens.userId, user.id),
      isNull(emailVerificationTokens.usedAt),
      gt(emailVerificationTokens.expiresAt, now)
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
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 400 });
  }

  await db.update(users).set({ emailVerified: now }).where(eq(users.id, user.id));
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: now })
    .where(eq(emailVerificationTokens.id, matched.id));

  await logLoginEvent({
    userId: user.id,
    email: user.email,
    event: 'email_verified',
    ipAddress,
    userAgent,
  });

  return NextResponse.json({ success: true });
}

export async function POST(request: NextRequest) {
  let email = '';
  let token = '';
  try {
    const body = await request.json();
    email = String(body?.email || '');
    token = String(body?.token || '');
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
  return handle(email, token, request);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email') || '';
  const token = searchParams.get('token') || '';
  return handle(email, token, request);
}
