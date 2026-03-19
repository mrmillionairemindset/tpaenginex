import { Job } from 'bullmq';
import { db } from '@/db/client';
import { invoices, orders, events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';

export interface BillingQueueEntryData {
  orderId?: string;
  eventId?: string;
  tpaOrgId: string;
}

/**
 * Fires when order or event → complete.
 * Creates an invoices table record with status=pending.
 */
export async function handleBillingQueueEntry(job: Job<BillingQueueEntryData>) {
  const { orderId, eventId, tpaOrgId } = job.data;

  let clientOrgId: string | null = null;

  if (orderId) {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });
    if (!order) return;
    clientOrgId = order.orgId;
  } else if (eventId) {
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });
    if (!event) return;
    clientOrgId = event.clientOrgId;
  }

  if (!clientOrgId) return;

  const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const [invoice] = await db.insert(invoices).values({
    tpaOrgId,
    invoiceNumber,
    clientOrgId,
    orderId: orderId || null,
    eventId: eventId || null,
    status: 'pending',
  }).returning();

  // Notify TPA billing staff
  const { users } = await import('@/db/schema');
  const billingUsers = await db.query.users.findMany({
    where: eq(users.role, 'tpa_billing'),
  });

  for (const user of billingUsers) {
    await createNotification({
      userId: user.id,
      type: 'billing_queued',
      title: 'New Invoice Queued',
      message: `Invoice ${invoiceNumber} has been added to the billing queue`,
      tpaOrgId,
    });
  }

  console.log(`[billing-queue-entry] Created invoice ${invoiceNumber}`);
}
