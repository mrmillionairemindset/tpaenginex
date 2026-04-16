/**
 * POST /api/webhooks/[id]/rotate-secret
 *
 * Generates a new signing secret for a webhook subscription while keeping
 * the previous secret valid for 24 hours. During the grace window, webhook
 * deliveries are signed with both secrets so subscribers can roll forward
 * without downtime.
 *
 * The plaintext of the new secret is returned ONCE in the response body —
 * the admin must copy it to the subscriber before closing the dialog.
 */

import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { webhookSubscriptions } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { encryptAtRest } from '@/lib/crypto';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const ROTATION_GRACE_MS = 24 * 60 * 60 * 1000; // 24 hours

function canManage(role: string | null): boolean {
  return role === 'tpa_admin' || role === 'platform_admin';
}

export const POST = withAuth(async (_req, user, ctx: { params: Promise<{ id: string }> }) => {
  if (!canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const { id } = await ctx.params;

  const existing = await db.query.webhookSubscriptions.findFirst({
    where: and(
      eq(webhookSubscriptions.id, id),
      eq(webhookSubscriptions.tpaOrgId, user.tpaOrgId)
    ),
  });
  if (!existing) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }

  const newPlaintext = `whsec_${randomBytes(32).toString('base64url')}`;
  const newEncrypted = encryptAtRest(newPlaintext);
  const now = new Date();
  const previousExpiresAt = new Date(now.getTime() + ROTATION_GRACE_MS);

  const [updated] = await db
    .update(webhookSubscriptions)
    .set({
      secret: newEncrypted,
      previousSecret: existing.secret, // already encrypted — store as-is
      previousSecretExpiresAt: previousExpiresAt,
      secretRotatedAt: now,
      updatedAt: now,
    })
    .where(eq(webhookSubscriptions.id, id))
    .returning();

  await createAuditLog({
    tpaOrgId: user.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email,
    entityType: 'webhook_subscription',
    entityId: id,
    action: 'secret_rotated',
    diffJson: {
      previousSecretExpiresAt: previousExpiresAt.toISOString(),
      graceWindowHours: 24,
    },
  });

  return NextResponse.json({
    id: updated.id,
    secret: newPlaintext,
    secretRotatedAt: updated.secretRotatedAt,
    previousSecretExpiresAt: updated.previousSecretExpiresAt,
    message:
      'Save this signing secret — you will not see it again. The previous secret will remain valid for 24 hours.',
  });
});
