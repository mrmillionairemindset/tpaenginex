/**
 * POST /api/user/account/cancel-deletion — cancel a pending account deletion.
 *
 * Requires the user to be authenticated. Since request-deletion disables the
 * account (isActive=false), cancellation must happen from within the grace
 * window — which requires a support-side unlock OR a mechanism to let the
 * user re-activate. For simplicity we allow cancellation when authenticated
 * OR when the user provides email+password via POST body.
 *
 * This route lets an authenticated user cancel. A separate public cancel-via-email
 * link would complement this for users already signed out.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { users, accountDeletionRequests } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const existing = await db.query.accountDeletionRequests.findFirst({
    where: eq(accountDeletionRequests.userId, user.id),
  });

  if (!existing || existing.cancelledAt || existing.completedAt) {
    return NextResponse.json(
      { error: 'No pending deletion request to cancel' },
      { status: 400 }
    );
  }

  if (existing.scheduledFor <= new Date()) {
    return NextResponse.json(
      { error: 'Grace period has expired. Contact support.' },
      { status: 410 }
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(accountDeletionRequests)
      .set({ cancelledAt: new Date() })
      .where(eq(accountDeletionRequests.id, existing.id));

    await tx
      .update(users)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  });

  if (user.tpaOrgId) {
    await createAuditLog({
      tpaOrgId: user.tpaOrgId,
      actorUserId: user.id,
      actorEmail: user.email,
      entityType: 'user',
      entityId: user.id,
      action: 'account_deletion_cancelled',
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Account deletion cancelled. Your account is active again.',
  });
}
