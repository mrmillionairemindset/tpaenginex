import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { webhookSubscriptions, webhookDeliveries } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { encryptAtRest } from '@/lib/crypto';
import { AVAILABLE_WEBHOOK_EVENTS } from '@/lib/webhooks';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const eventEnum = z.enum(AVAILABLE_WEBHOOK_EVENTS as unknown as [string, ...string[]]);

const createSchema = z.object({
  url: z.string().url().max(2000),
  events: z.array(eventEnum).min(1),
  description: z.string().max(500).optional(),
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

export const GET = withAuth(async (_req, user) => {
  if (!canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const subs = await db.query.webhookSubscriptions.findMany({
    where: eq(webhookSubscriptions.tpaOrgId, user.tpaOrgId),
    orderBy: [desc(webhookSubscriptions.createdAt)],
  });

  // Fetch delivery counts + last delivery per subscription
  const counts = subs.length
    ? await db
        .select({
          subscriptionId: webhookDeliveries.subscriptionId,
          total: sql<number>`count(*)::int`,
          succeeded: sql<number>`count(*) filter (where ${webhookDeliveries.status} = 'success')::int`,
          failed: sql<number>`count(*) filter (where ${webhookDeliveries.status} in ('failed','dead_letter'))::int`,
          lastAttemptAt: sql<Date | null>`max(${webhookDeliveries.lastAttemptAt})`,
        })
        .from(webhookDeliveries)
        .where(eq(webhookDeliveries.tpaOrgId, user.tpaOrgId))
        .groupBy(webhookDeliveries.subscriptionId)
    : [];

  const countMap = new Map(counts.map((c) => [c.subscriptionId, c]));

  return NextResponse.json({
    webhooks: subs.map((s) => {
      const c = countMap.get(s.id);
      return {
        ...sanitize(s),
        stats: {
          total: c?.total ?? 0,
          succeeded: c?.succeeded ?? 0,
          failed: c?.failed ?? 0,
          lastAttemptAt: c?.lastAttemptAt ?? null,
        },
      };
    }),
    availableEvents: AVAILABLE_WEBHOOK_EVENTS,
  });
});

export const POST = withAuth(async (req, user) => {
  if (!canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const rawSecret = `whsec_${randomBytes(32).toString('base64url')}`;
  const encryptedSecret = encryptAtRest(rawSecret);

  const [inserted] = await db
    .insert(webhookSubscriptions)
    .values({
      tpaOrgId: user.tpaOrgId,
      createdBy: user.id,
      url: parsed.data.url,
      secret: encryptedSecret,
      events: parsed.data.events,
      description: parsed.data.description ?? null,
      isActive: parsed.data.isActive ?? true,
    })
    .returning();

  await createAuditLog({
    tpaOrgId: user.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email,
    entityType: 'webhook_subscription',
    entityId: inserted.id,
    action: 'created',
    diffJson: { url: parsed.data.url, events: parsed.data.events },
  });

  return NextResponse.json(
    {
      ...sanitize(inserted),
      secret: rawSecret, // shown ONCE so TPA can configure receiver
      message: 'Save this signing secret — you will not see it again.',
    },
    { status: 201 }
  );
});
