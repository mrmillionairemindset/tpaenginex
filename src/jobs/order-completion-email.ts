import { Job } from 'bullmq';
import { db } from '@/db/client';
import { orders, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';
import { sendOrderCompletionEmail } from '@/lib/email';
import { getTpaAutomationSettings } from '@/lib/tpa-settings';

export interface OrderCompletionEmailData {
  orderId: string;
  tpaOrgId: string;
}

/**
 * Fires when order status → complete.
 * Sends thank-you + review request email to client_admin contact.
 */
export async function handleOrderCompletionEmail(job: Job<OrderCompletionEmailData>) {
  const { orderId, tpaOrgId } = job.data;

  const settings = await getTpaAutomationSettings(tpaOrgId);
  if (!settings.enableOrderCompletionEmail) {
    console.log(`[order-completion-email] Disabled for TPA ${tpaOrgId} — skipping`);
    return;
  }

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: {
      candidate: true,
      organization: {
        with: {
          users: true,
        },
      },
    },
  });

  if (!order) return;

  // Find client admin
  const clientAdmins = order.organization.users.filter(u => u.role === 'client_admin');

  for (const admin of clientAdmins) {
    // In-app notification
    await createNotification({
      userId: admin.id,
      type: 'order_completed_client',
      title: 'Collection Complete',
      message: `Collection for order ${order.orderNumber} is complete. Results will be delivered shortly.`,
      orderId,
      tpaOrgId,
    });

    // Email
    await sendOrderCompletionEmail({
      to: admin.email,
      orderNumber: order.orderNumber,
      clientName: order.organization.name,
      donorName: `${order.candidate.firstName} ${order.candidate.lastName}`,
      serviceType: order.serviceType || order.testType,
      reviewLink: '',
    }).catch(err => console.error('[order-completion-email] Email failed:', err));
  }

  console.log(`[order-completion-email] Processed for order ${order.orderNumber}`);
}
