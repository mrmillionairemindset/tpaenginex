import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { webhookSubscriptions, webhookDeliveries } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { and, desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function canManage(role: string | null): boolean {
  return role === 'tpa_admin' || role === 'platform_admin';
}

export const GET = withAuth(async (req, user, ctx: { params: Promise<{ id: string }> }) => {
  if (!canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const { id } = await ctx.params;

  const subscription = await db.query.webhookSubscriptions.findFirst({
    where: and(
      eq(webhookSubscriptions.id, id),
      eq(webhookSubscriptions.tpaOrgId, user.tpaOrgId)
    ),
  });
  if (!subscription) {
    return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 200);

  const deliveries = await db.query.webhookDeliveries.findMany({
    where: and(
      eq(webhookDeliveries.subscriptionId, id),
      eq(webhookDeliveries.tpaOrgId, user.tpaOrgId)
    ),
    orderBy: [desc(webhookDeliveries.createdAt)],
    limit,
  });

  return NextResponse.json({
    deliveries: deliveries.map((d) => ({
      id: d.id,
      event: d.event,
      status: d.status,
      attempts: d.attempts,
      maxAttempts: d.maxAttempts,
      responseStatus: d.responseStatus,
      responseBody: d.responseBody,
      errorMessage: d.errorMessage,
      nextAttemptAt: d.nextAttemptAt,
      lastAttemptAt: d.lastAttemptAt,
      deliveredAt: d.deliveredAt,
      createdAt: d.createdAt,
    })),
  });
});
