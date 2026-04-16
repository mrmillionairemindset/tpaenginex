/**
 * GET /api/2fa/backup-codes — return metadata about the user's backup codes.
 *   (NEVER returns the plaintext codes — those are shown only once at generation time.)
 * POST /api/2fa/backup-codes — regenerate backup codes (invalidates all existing ones).
 *   Requires password + TOTP verification for security.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, userBackupCodes } from '@/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { getCurrentUser } from '@/auth/get-user';
import { generateBackupCodes, verifyTotpToken } from '@/lib/totp';
import { createAuditLog } from '@/lib/audit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// GET — return stats only (never the plaintext codes)
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { totpEnabled: true },
  });

  if (!dbUser?.totpEnabled) {
    return NextResponse.json({
      totpEnabled: false,
      unusedCount: 0,
      totalCount: 0,
    });
  }

  const all = await db.query.userBackupCodes.findMany({
    where: eq(userBackupCodes.userId, user.id),
    columns: { id: true, usedAt: true },
  });

  return NextResponse.json({
    totpEnabled: true,
    unusedCount: all.filter((c) => !c.usedAt).length,
    totalCount: all.length,
  });
}

// POST — regenerate backup codes (requires password + TOTP)
const regenerateSchema = z.object({
  password: z.string().min(1),
  totpToken: z.string().regex(/^\d{6}$/),
});

export async function POST(req: NextRequest) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const validation = regenerateSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, currentUser.id),
  });

  if (!dbUser?.password || !dbUser.totpEnabled || !dbUser.totpSecret) {
    return NextResponse.json(
      { error: '2FA not enabled or user invalid' },
      { status: 400 }
    );
  }

  // Verify password
  if (!(await bcrypt.compare(validation.data.password, dbUser.password))) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  // Verify TOTP
  if (!verifyTotpToken(dbUser.totpSecret, validation.data.totpToken)) {
    return NextResponse.json({ error: 'Invalid 2FA code' }, { status: 401 });
  }

  // Generate new codes, replace old ones
  const { codes, hashes } = await generateBackupCodes();

  await db.transaction(async (tx) => {
    await tx.delete(userBackupCodes).where(eq(userBackupCodes.userId, dbUser.id));
    await tx.insert(userBackupCodes).values(
      hashes.map((codeHash) => ({
        userId: dbUser.id,
        codeHash,
      }))
    );
  });

  if (currentUser.tpaOrgId) {
    await createAuditLog({
      tpaOrgId: currentUser.tpaOrgId,
      actorUserId: currentUser.id,
      actorEmail: currentUser.email,
      entityType: 'user',
      entityId: currentUser.id,
      action: '2fa_backup_codes_regenerated',
      diffJson: { email: currentUser.email },
    });
  }

  return NextResponse.json({
    success: true,
    backupCodes: codes,
    message: 'New backup codes generated. Save them — the old codes are no longer valid.',
  });
}
