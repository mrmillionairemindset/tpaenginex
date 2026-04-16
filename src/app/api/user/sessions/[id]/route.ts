/**
 * DELETE /api/user/sessions/[id] — revoke a specific session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/db/client';
import { userSessions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/auth/get-user';
import { revokeSession } from '@/lib/session-manager';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the session belongs to the current user
  const session = await db.query.userSessions.findFirst({
    where: and(
      eq(userSessions.id, params.id),
      eq(userSessions.userId, user.id)
    ),
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Prevent revoking the current session via this endpoint — use signOut instead
  const currentAuth = await auth();
  const currentSessionToken = (currentAuth as any)?.sessionId as string | undefined;
  if (currentSessionToken && session.sessionToken === currentSessionToken) {
    return NextResponse.json(
      { error: 'Cannot revoke current session — use sign out instead' },
      { status: 400 }
    );
  }

  await revokeSession(params.id, user.id);

  if (user.tpaOrgId) {
    await createAuditLog({
      tpaOrgId: user.tpaOrgId,
      actorUserId: user.id,
      actorEmail: user.email,
      entityType: 'user_session',
      entityId: params.id,
      action: 'revoke_session',
      diffJson: { deviceLabel: session.deviceLabel },
    });
  }

  return NextResponse.json({ success: true });
}
