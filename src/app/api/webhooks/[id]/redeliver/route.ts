import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { webhookSubscriptions, webhookDeliveries } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { redeliverWebhook } from '@/lib/webhooks';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  deliveryId: z.string().uuid(),
});

function canManage(role: string | null): boolean {
  return role === 'tpa_admin' || role === 'platform_admin';
}

export const POST = withAuth(async (req, user, ctx: { params: Promise<{ id: string }> }) => {
  if (!canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const { id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 }
    );
  }

  // Verify delivery belongs to this subscription + tpa
  const delivery = await db.query.webhookDeliveries.findFirst({
    where: and(
      eq(webhookDeliveries.id, parsed.data.deliveryId),
      eq(webhookDeliveries.subscriptionId, id),
      eq(webhookDeliveries.tpaOrgId, user.tpaOrgId)
    ),
  });
  if (!delivery) {
    return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
  }

  const ok = await redeliverWebhook(parsed.data.deliveryId);
  if (!ok) {
    return NextResponse.json({ error: 'Failed to requeue' }, { status: 500 });
  }

  await createAuditLog({
    tpaOrgId: user.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email,
    entityType: 'webhook_delivery',
    entityId: parsed.data.deliveryId,
    action: 'redelivered',
    diffJson: { event: delivery.event },
  });

  return NextResponse.json({ success: true, message: 'Delivery re-queued' });
});
