import { Job } from 'bullmq';
import { db } from '@/db/client';
import { invoices, invoiceLineItems, orders, events, serviceCatalog, tpaSettings, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';

export interface BillingQueueEntryData {
  orderId?: string;
  eventId?: string;
  tpaOrgId: string;
}

/**
 * Fires when order or event → complete.
 * Creates an invoice with per-service line items calculated from the service catalog rates.
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
  let testTypeStr: string | null = null;
  let isDOT = false;
  let eventQuantity = 1;

  if (orderId) {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });
    if (!order) return;
    clientOrgId = order.orgId;
    testTypeStr = order.testType;
    isDOT = order.isDOT || false;
  } else if (eventId) {
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    });
    if (!event) return;
    clientOrgId = event.clientOrgId;
    eventQuantity = event.totalOrdered || 1;
  }

  if (!clientOrgId) return;

  // Fetch TPA settings for DOT surcharge
  const settings = await db.query.tpaSettings.findFirst({
    where: eq(tpaSettings.tpaOrgId, tpaOrgId),
  });
  const dotSurcharge = settings?.dotSurchargeRate || 0;

  // Fetch the TPA's service catalog for rate lookup
  const catalog = await db.query.serviceCatalog.findMany({
    where: eq(serviceCatalog.tpaOrgId, tpaOrgId),
  });
  const rateByName = new Map<string, { rate: number; code: string | null }>();
  const rateByCode = new Map<string, { rate: number; name: string }>();
  for (const svc of catalog) {
    if (svc.rate) {
      rateByName.set(svc.name.toLowerCase(), { rate: svc.rate, code: svc.code });
      if (svc.code) rateByCode.set(svc.code, { rate: svc.rate, name: svc.name });
    }
  }

  // Parse selected services from the order's testType (comma-separated names or codes)
  const selectedServices = testTypeStr
    ? testTypeStr.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  // Build line items
  const lineItems: Array<{ serviceName: string; serviceCode: string | null; quantity: number; unitPrice: number; amount: number }> = [];
  let totalAmount = 0;

  for (const svcNameOrCode of selectedServices) {
    // Handle shy bladder with hours encoded in name: "Shy Bladder / Extended Wait (2hr)"
    const shyBladderMatch = svcNameOrCode.match(/^Shy Bladder.*\((\d+\.?\d*)hr\)$/);
    if (shyBladderMatch) {
      const hours = parseFloat(shyBladderMatch[1]);
      const shyRate = rateByCode.get('shy_bladder')?.rate || rateByName.get('shy bladder / extended wait (per hour)')?.rate || 5000;
      const amount = shyRate * hours;
      lineItems.push({
        serviceName: 'Shy Bladder / Extended Wait',
        serviceCode: 'shy_bladder',
        quantity: hours,
        unitPrice: shyRate,
        amount,
      });
      totalAmount += amount;
      continue;
    }

    // Try matching by code first, then by name
    const byCode = rateByCode.get(svcNameOrCode);
    const byName = rateByName.get(svcNameOrCode.toLowerCase());
    const match = byCode || byName;

    const unitPrice = match?.rate || 0;
    const quantity = eventQuantity;
    const amount = unitPrice * quantity;

    lineItems.push({
      serviceName: byCode?.name || svcNameOrCode,
      serviceCode: byCode ? svcNameOrCode : (byName?.code || null),
      quantity,
      unitPrice,
      amount,
    });

    totalAmount += amount;
  }

  // Add DOT surcharge as a line item if applicable
  if (isDOT && dotSurcharge > 0) {
    const surchargeAmount = dotSurcharge * eventQuantity;
    lineItems.push({
      serviceName: 'DOT Compliance Surcharge',
      serviceCode: 'dot_surcharge',
      quantity: eventQuantity,
      unitPrice: dotSurcharge,
      amount: surchargeAmount,
    });
    totalAmount += surchargeAmount;
  }

  // If no services matched any rates, add a placeholder
  if (lineItems.length === 0 && selectedServices.length > 0) {
    for (const svc of selectedServices) {
      lineItems.push({
        serviceName: svc,
        serviceCode: null,
        quantity: eventQuantity,
        unitPrice: 0,
        amount: 0,
      });
    }
  }

  const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const hasUnpricedItems = lineItems.some(li => li.unitPrice === 0);
  const notes = hasUnpricedItems ? 'Some services have no rate configured — manual review required' : null;

  // Create invoice
  const [invoice] = await db.insert(invoices).values({
    tpaOrgId,
    invoiceNumber,
    clientOrgId,
    orderId: orderId || null,
    eventId: eventId || null,
    amount: totalAmount,
    status: 'pending',
    notes,
  }).returning();

  // Create line items
  if (lineItems.length > 0) {
    await db.insert(invoiceLineItems).values(
      lineItems.map(li => ({
        invoiceId: invoice.id,
        serviceName: li.serviceName,
        serviceCode: li.serviceCode,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        amount: li.amount,
      }))
    );
  }

  // Notify TPA billing staff
  const billingUsers = await db.query.users.findMany({
    where: eq(users.role, 'tpa_billing'),
  });

  const formattedTotal = totalAmount > 0 ? ` — $${(totalAmount / 100).toFixed(2)}` : '';

  for (const user of billingUsers) {
    await createNotification({
      userId: user.id,
      type: 'billing_queued',
      title: 'New Invoice Queued',
      message: `Invoice ${invoiceNumber}${formattedTotal} (${lineItems.length} service${lineItems.length !== 1 ? 's' : ''})`,
      tpaOrgId,
    });
  }

  console.log(`[billing-queue-entry] Created invoice ${invoiceNumber} with ${lineItems.length} line items (total: ${totalAmount})`);
}
