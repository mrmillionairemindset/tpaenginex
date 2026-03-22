import { Job } from 'bullmq';
import { db } from '@/db/client';
import { invoices, orders, events, tpaSettings, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';

export interface BillingQueueEntryData {
  orderId?: string;
  eventId?: string;
  tpaOrgId: string;
}

/**
 * Fires when order or event → complete.
 * Creates an invoices table record with calculated amount and status=pending.
 * Guards against duplicate invoices.
 */
export async function handleBillingQueueEntry(job: Job<BillingQueueEntryData>) {
  const { orderId, eventId, tpaOrgId } = job.data;

  // Guard against duplicate invoices
  if (orderId) {
    const existing = await db.query.invoices.findFirst({
      where: and(eq(invoices.orderId, orderId), eq(invoices.tpaOrgId, tpaOrgId)),
    });
    if (existing) {
      console.log(`[billing-queue-entry] Invoice already exists for order ${orderId} — skipping`);
      return;
    }
  }
  if (eventId) {
    const existing = await db.query.invoices.findFirst({
      where: and(eq(invoices.eventId, eventId), eq(invoices.tpaOrgId, tpaOrgId)),
    });
    if (existing) {
      console.log(`[billing-queue-entry] Invoice already exists for event ${eventId} — skipping`);
      return;
    }
  }

  let clientOrgId: string | null = null;
  let amount: number | null = null;
  let serviceType: string | null = null;
  let isDOT = false;
  let eventQuantity = 1;

  // Fetch TPA pricing settings
  const settings = await db.query.tpaSettings.findFirst({
    where: eq(tpaSettings.tpaOrgId, tpaOrgId),
  });
  const rates = settings?.defaultServiceRates || {};
  const dotSurcharge = settings?.dotSurchargeRate || 0;

  if (orderId) {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });
    if (!order) return;
    clientOrgId = order.orgId;
    serviceType = order.serviceType || order.testType;
    isDOT = order.isDOT || false;
  } else if (eventId) {
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });
    if (!event) return;
    clientOrgId = event.clientOrgId;
    serviceType = event.serviceType;
    eventQuantity = event.totalOrdered || 1;
  }

  if (!clientOrgId) return;

  // Calculate amount from rates
  if (serviceType && rates[serviceType]) {
    amount = rates[serviceType] * eventQuantity;
    if (isDOT && dotSurcharge > 0) {
      amount += dotSurcharge * eventQuantity;
    }
  }

  const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const notes = amount === null ? 'Rate not configured — manual entry required' : undefined;

  const [invoice] = await db.insert(invoices).values({
    tpaOrgId,
    invoiceNumber,
    clientOrgId,
    orderId: orderId || null,
    eventId: eventId || null,
    amount: amount || 0,
    status: 'pending',
    notes: notes || null,
  }).returning();

  // Notify TPA billing staff
  const billingUsers = await db.query.users.findMany({
    where: eq(users.role, 'tpa_billing'),
  });

  for (const user of billingUsers) {
    await createNotification({
      userId: user.id,
      type: 'billing_queued',
      title: 'New Invoice Queued',
      message: `Invoice ${invoiceNumber}${amount ? ` — ${(amount / 100).toFixed(2)}` : ''} has been added to the billing queue`,
      tpaOrgId,
    });
  }

  console.log(`[billing-queue-entry] Created invoice ${invoiceNumber} (amount: ${amount ?? 'unset'})`);
}
