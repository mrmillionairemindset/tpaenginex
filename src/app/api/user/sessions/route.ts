/**
 * GET /api/user/sessions — list active sessions for the current user.
 * DELETE /api/user/sessions — revoke all sessions except the current one ("sign out everywhere else").
 */

import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCurrentUser } from '@/auth/get-user';
import { listUserSessions, revokeOtherSessions } from '@/lib/session-manager';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await auth();
  const currentSessionId = (session as any)?.sessionId as string | undefined;

  const sessions = await listUserSessions(user.id);

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel,
      ipAddress: s.ipAddress,
      lastSeenAt: s.lastSeenAt.toISOString(),
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      isCurrent: currentSessionId ? s.sessionToken === currentSessionId : false,
    })),
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const session = await auth();
  const currentSessionId = (session as any)?.sessionId as string | undefined;
  if (!currentSessionId) {
    return NextResponse.json({ error: 'No active session token' }, { status: 400 });
  }

  const revokedCount = await revokeOtherSessions(user.id, currentSessionId);

  if (user.tpaOrgId) {
    await createAuditLog({
      tpaOrgId: user.tpaOrgId,
      actorUserId: user.id,
      actorEmail: user.email,
      entityType: 'user_session',
      entityId: user.id,
      action: 'revoke_all_other_sessions',
      diffJson: { revokedCount },
    });
  }

  return NextResponse.json({ revokedCount });
}
