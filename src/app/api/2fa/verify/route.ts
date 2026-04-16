/**
 * POST /api/2fa/verify — complete 2FA setup by verifying the first token.
 *
 * Body: { secret: string, token: string }
 *
 * If the token is valid for the submitted secret:
 *  - Persist totpSecret and set totpEnabled=true on the user
 *  - Generate 10 backup codes, hash them, store, and return plaintext codes ONCE
 *  - The backup codes are shown to the user and never retrievable again
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, userBackupCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/auth/get-user';
import { verifyTotpToken, generateBackupCodes } from '@/lib/totp';
import { encryptAtRest } from '@/lib/crypto';
import { createAuditLog } from '@/lib/audit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const verifySchema = z.object({
  secret: z.string().min(16),
  token: z.string().regex(/^\d{6}$/, 'Token must be 6 digits'),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validation = verifySchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const { secret, token } = validation.data;

  if (!verifyTotpToken(secret, token)) {
    return NextResponse.json(
      { error: 'Invalid verification code. Try again.' },
      { status: 400 }
    );
  }

  // Generate backup codes
  const { codes, hashes } = await generateBackupCodes();

  // Persist secret, enable 2FA, and store backup codes
  // Encrypt the TOTP secret before persisting — defense in depth against DB compromise
  const encryptedSecret = encryptAtRest(secret);

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        totpSecret: encryptedSecret,
        totpEnabled: true,
        totpVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Clear any old backup codes (re-enabling 2FA after a disable)
    await tx.delete(userBackupCodes).where(eq(userBackupCodes.userId, user.id));

    // Insert new backup code hashes
    await tx.insert(userBackupCodes).values(
      hashes.map((codeHash) => ({
        userId: user.id,
        codeHash,
      }))
    );
  });

  if (user.tpaOrgId) {
    await createAuditLog({
      tpaOrgId: user.tpaOrgId,
      actorUserId: user.id,
      actorEmail: user.email,
      entityType: 'user',
      entityId: user.id,
      action: '2fa_enabled',
      diffJson: { email: user.email, backupCodeCount: codes.length },
    });
  }

  return NextResponse.json({
    success: true,
    backupCodes: codes,
    message: 'Two-factor authentication enabled. Save these backup codes — they will not be shown again.',
  });
}
