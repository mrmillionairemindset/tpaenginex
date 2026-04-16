/**
 * POST /api/2fa/setup — initiate 2FA setup for the current user.
 *
 * Flow:
 * 1. Generate a new TOTP secret (NOT yet saved to user — they must verify first).
 * 2. Return the secret + QR code data URL to the client.
 * 3. Client displays QR, user scans with authenticator app.
 * 4. User submits a 6-digit code to POST /api/2fa/verify with the secret.
 * 5. /verify validates the code, persists the secret, generates backup codes.
 *
 * This two-step design prevents storing an unverified secret.
 */

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { generateTotpSecret, generateTotpQrCode } from '@/lib/totp';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secret = generateTotpSecret();
  const qrCodeDataUrl = await generateTotpQrCode(secret, user.email);

  if (user.tpaOrgId) {
    await createAuditLog({
      tpaOrgId: user.tpaOrgId,
      actorUserId: user.id,
      actorEmail: user.email,
      entityType: 'user',
      entityId: user.id,
      action: '2fa_setup_initiated',
      diffJson: { email: user.email },
    });
  }

  return NextResponse.json({
    secret,
    qrCodeDataUrl,
    manualEntryKey: secret, // Users can type this into their authenticator if they can't scan the QR
  });
}
