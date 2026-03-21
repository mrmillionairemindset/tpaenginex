import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, collectors } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { notifyCollectorAssigned } from '@/lib/notifications';
import { scheduleReminder } from '@/jobs/queue';
import { getTpaAutomationSettings } from '@/lib/tpa-settings';

export const dynamic = 'force-dynamic';

const assignCollectorSchema = z.object({
  collectorId: z.string().uuid('Valid collector ID is required'),
});

// POST /api/orders/[id]/assign-collector
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canAssign = user.role === 'tpa_admin' || user.role === 'tpa_staff' || user.role === 'platform_admin';
  if (!canAssign) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { id } = params;
  const body = await req.json();
  const validation = assignCollectorSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  // Verify order exists and belongs to this TPA
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, id), eq(orders.tpaOrgId, tpaOrgId)),
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Verify collector exists and belongs to this TPA
  const collector = await db.query.collectors.findFirst({
    where: and(
      eq(collectors.id, validation.data.collectorId),
      eq(collectors.tpaOrgId, tpaOrgId),
    ),
  });

  if (!collector) {
    return NextResponse.json({ error: 'Collector not found' }, { status: 404 });
  }

  // Update order with collector assignment
  await db.update(orders).set({
    collectorId: collector.id,
    updatedAt: new Date(),
  }).where(eq(orders.id, id));

  // Notify client
  const collectorName = `${collector.firstName} ${collector.lastName}`;
  await notifyCollectorAssigned(id, order.orderNumber, collectorName);

  // Schedule 48-hr reminder jobs (if enabled)
  if (order.scheduledFor) {
    const automationSettings = await getTpaAutomationSettings(tpaOrgId);
    const scheduledTime = new Date(order.scheduledFor).getTime();
    const reminderDelay = scheduledTime - Date.now() - 48 * 60 * 60 * 1000;

    if (automationSettings.enableCollectorConfirmReminders) {
      await scheduleReminder('collector_confirm_reminder', {
        orderId: id,
        collectorId: collector.id,
        scheduledFor: order.scheduledFor,
        tpaOrgId,
      }, reminderDelay);
    }

    if (automationSettings.enableKitReminders) {
      await scheduleReminder('kit_mailing_reminder', {
        orderId: id,
        tpaOrgId,
      }, reminderDelay);
    }
  }

  const updatedOrder = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      collector: true,
      candidate: true,
      organization: {
        columns: { id: true, name: true, type: true },
      },
    },
  });

  return NextResponse.json({
    order: updatedOrder,
    message: `Collector ${collectorName} assigned successfully`,
  });
}
