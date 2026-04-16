import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { webhookSubscriptions } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { AVAILABLE_WEBHOOK_EVENTS } from '@/lib/webhooks';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const eventEnum = z.enum(AVAILABLE_WEBHOOK_EVENTS as unknown as [string, ...string[]]);

const patchSchema = z.object({
  url: z.string().url().max(2000).optional(),
  events: z.array(eventEnum).min(1).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

function canManage(role: string | null): boolean {
  return role === 'tpa_admin' || role === 'platform_admin';
}

function sanitize(row: typeof webhookSubscriptions.$inferSelect) {
  return {
    id: row.id,
    url: row.url,
    events: row.events,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    secretRotatedAt: row.secretRotatedAt,
    previousSecretExpiresAt: row.previousSecretExpiresAt,
  };
}

export const PATCH = withAuth(async (req, user, ctx: { params: Promise<{ id: string }> }) => {
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

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const updateData: Partial<typeof webhookSubscriptions.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parsed.data.url !== undefined) updateData.url = parsed.data.url;
  if (parsed.data.events !== undefined) updateData.events = parsed.data.events;
  if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
  if (parsed.data.isActive !== undefined) updateData.isActive = parsed.data.isActive;

  const [updated] = await db
    .update(webhookSubscriptions)
    .set(updateData)
    .where(eq(webhookSubscriptions.id, id))
    .returning();

  await createAuditLog({
    tpaOrgId: user.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email,
    entityType: 'webhook_subscription',
    entityId: id,
    action: 'updated',
    diffJson: parsed.data,
  });

  return NextResponse.json({ webhook: sanitize(updated) });
});

export const DELETE = withAuth(async (_req, user, ctx: { params: Promise<{ id: string }> }) => {
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

  await db.delete(webhookSubscriptions).where(eq(webhookSubscriptions.id, id));

  await createAuditLog({
    tpaOrgId: user.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email,
    entityType: 'webhook_subscription',
    entityId: id,
    action: 'deleted',
    diffJson: { url: existing.url, events: existing.events },
  });

  return NextResponse.json({ success: true });
});
