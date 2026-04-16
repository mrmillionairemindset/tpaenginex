/**
 * POST /api/user/account/request-deletion — initiate 30-day account deletion.
 *
 * Requires password + explicit confirmation phrase.
 * Immediately disables the account but preserves data for 30 days (undo window).
 * Revokes all active sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { users, userSessions, accountDeletionRequests } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { logLoginEvent, getClientIp, getClientUserAgent } from '@/lib/auth-security';

export const dynamic = 'force-dynamic';

const CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';
const DELETION_GRACE_DAYS = 30;

const schema = z.object({
  password: z.string().min(1),
  confirmationPhrase: z.string(),
  reason: z.string().max(1000).optional(),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validation = schema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (validation.data.confirmationPhrase !== CONFIRMATION_PHRASE) {
    return NextResponse.json(
      { error: `Confirmation phrase must be exactly: ${CONFIRMATION_PHRASE}` },
      { status: 400 }
    );
  }

  const dbUser = await db.query.users.findFirst({ where: eq(users.id, user.id) });
  if (!dbUser?.password) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const passwordOk = await bcrypt.compare(validation.data.password, dbUser.password);
  if (!passwordOk) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  // Check if already has a pending request
  const existing = await db.query.accountDeletionRequests.findFirst({
    where: eq(accountDeletionRequests.userId, user.id),
  });
  if (existing && !existing.cancelledAt && !existing.completedAt) {
    return NextResponse.json(
      {
        error: 'Account deletion is already scheduled',
        scheduledFor: existing.scheduledFor,
      },
      { status: 409 }
    );
  }

  const scheduledFor = new Date(Date.now() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const ipAddress = getClientIp(req.headers);

  await db.transaction(async (tx) => {
    // Upsert deletion request
    if (existing) {
      await tx
        .update(accountDeletionRequests)
        .set({
          requestedAt: new Date(),
          scheduledFor,
          cancelledAt: null,
          completedAt: null,
          reason: validation.data.reason,
          ipAddress,
        })
        .where(eq(accountDeletionRequests.id, existing.id));
    } else {
      await tx.insert(accountDeletionRequests).values({
        userId: user.id,
        scheduledFor,
        reason: validation.data.reason,
        ipAddress,
      });
    }

    // Disable account
    await tx
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    // Revoke all active sessions
    await tx
      .update(userSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(userSessions.userId, user.id), isNull(userSessions.revokedAt)));
  });

  await logLoginEvent({
    userId: user.id,
    email: user.email,
    event: 'account_locked',
    ipAddress,
    userAgent: getClientUserAgent(req.headers),
    metadata: { reason: 'deletion_requested', scheduledFor: scheduledFor.toISOString() },
  });

  if (user.tpaOrgId) {
    await createAuditLog({
      tpaOrgId: user.tpaOrgId,
      actorUserId: user.id,
      actorEmail: user.email,
      entityType: 'user',
      entityId: user.id,
      action: 'account_deletion_requested',
      diffJson: {
        scheduledFor: scheduledFor.toISOString(),
        reason: validation.data.reason,
      },
    });
  }

  return NextResponse.json({
    success: true,
    scheduledFor: scheduledFor.toISOString(),
    message: `Account scheduled for deletion on ${scheduledFor.toLocaleDateString()}. You can cancel within this window.`,
  });
}
