/**
 * POST /api/auth/log-logout — records a logout event in the login_history table.
 *
 * Called by the client immediately before signOut() so we have an audit trail
 * for HIPAA. Body: { reason: "manual" | "idle_timeout" }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { z } from 'zod';
import { logLoginEvent, getClientIp, getClientUserAgent } from '@/lib/auth-security';
import { revokeSessionByToken } from '@/lib/session-manager';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  reason: z.enum(['manual', 'idle_timeout']).default('manual'),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let reason: 'manual' | 'idle_timeout' = 'manual';
  try {
    const body = await req.json();
    const parsed = bodySchema.safeParse(body);
    if (parsed.success) reason = parsed.data.reason;
  } catch {
    // empty body allowed — default to "manual"
  }

  // Revoke the session record so subsequent requests with a lingering JWT are rejected
  const sessionToken = (session as any)?.sessionId as string | undefined;
  if (sessionToken) {
    await revokeSessionByToken(sessionToken).catch(() => {
      // Swallow — logout should never fail due to DB issues
    });
  }

  await logLoginEvent({
    userId: session.user.id,
    email: session.user.email,
    event: reason === 'idle_timeout' ? 'logout_idle_timeout' : 'logout_manual',
    ipAddress: getClientIp(req.headers),
    userAgent: getClientUserAgent(req.headers),
  });

  return NextResponse.json({ ok: true });
}
