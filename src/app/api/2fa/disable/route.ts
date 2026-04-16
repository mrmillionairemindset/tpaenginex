/**
 * POST /api/2fa/disable — disable 2FA for the current user.
 *
 * Body: { password: string, totpToken?: string, backupCode?: string }
 *
 * Requires the current password AND (a valid TOTP token OR a valid backup code)
 * to prevent session-stealing attacks from disabling 2FA.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, userBackupCodes } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { getCurrentUser } from '@/auth/get-user';
import { verifyTotpToken, verifyBackupCode } from '@/lib/totp';
import { createAuditLog } from '@/lib/audit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const disableSchema = z
  .object({
    password: z.string().min(1, 'Password is required'),
    totpToken: z.string().optional(),
    backupCode: z.string().optional(),
  })
  .refine((d) => d.totpToken || d.backupCode, {
    message: 'Either a TOTP token or a backup code is required',
  });

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validation = disableSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, currentUser.id),
  });

  if (!dbUser || !dbUser.password) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  if (!dbUser.totpEnabled || !dbUser.totpSecret) {
    return NextResponse.json(
      { error: '2FA is not currently enabled for this account' },
      { status: 400 }
    );
  }

  // Verify password
  const passwordMatch = await bcrypt.compare(validation.data.password, dbUser.password);
  if (!passwordMatch) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  // Verify 2FA code
  let twoFactorVerified = false;
  if (validation.data.totpToken) {
    twoFactorVerified = verifyTotpToken(dbUser.totpSecret, validation.data.totpToken);
  }
  if (!twoFactorVerified && validation.data.backupCode) {
    const codes = await db.query.userBackupCodes.findMany({
      where: and(eq(userBackupCodes.userId, dbUser.id), isNull(userBackupCodes.usedAt)),
    });
    const matchIndex = await verifyBackupCode(
      validation.data.backupCode,
      codes.map((c) => c.codeHash)
    );
    if (matchIndex >= 0) {
      twoFactorVerified = true;
    }
  }

  if (!twoFactorVerified) {
    return NextResponse.json(
      { error: 'Invalid 2FA code or backup code' },
      { status: 401 }
    );
  }

  // Disable 2FA — clear secret, disable flag, and delete backup codes
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        totpSecret: null,
        totpEnabled: false,
        totpVerifiedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, dbUser.id));

    await tx.delete(userBackupCodes).where(eq(userBackupCodes.userId, dbUser.id));
  });

  if (currentUser.tpaOrgId) {
    await createAuditLog({
      tpaOrgId: currentUser.tpaOrgId,
      actorUserId: currentUser.id,
      actorEmail: currentUser.email,
      entityType: 'user',
      entityId: currentUser.id,
      action: '2fa_disabled',
      diffJson: { email: currentUser.email },
    });
  }

  return NextResponse.json({
    success: true,
    message: 'Two-factor authentication has been disabled.',
  });
}
