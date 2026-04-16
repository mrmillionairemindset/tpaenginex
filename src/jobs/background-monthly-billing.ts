/**
 * Monthly Background Screening billing sweep.
 *
 * On the 1st of each month, sweep all unbilled `background_check_charges`
 * (invoice_id IS NULL) per TPA tenant that has the `background_screening`
 * module enabled. Create ONE platform-billing invoice per TPA per month with
 * all unbilled charges as line items, then mark the charges as billed by
 * setting their invoice_id.
 *
 * Idempotent: if a prior month's sweep already generated an invoice with the
 * same invoice number for this tenant+month, we skip.
 */

import { Job } from 'bullmq';
import { db } from '@/db/client';
import {
  backgroundCheckCharges,
  tenantModules,
  invoices,
  invoiceLineItems,
} from '@/db/schema';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit';

const log = logger.child({ component: 'background-monthly-billing' });

interface MonthlyBillingResult {
  tpasProcessed: number;
  invoicesCreated: number;
  invoicesSkipped: number;
  totalChargesSwept: number;
  totalAmountCents: number;
}

export async function runBackgroundMonthlyBilling(): Promise<MonthlyBillingResult> {
  const result: MonthlyBillingResult = {
    tpasProcessed: 0,
    invoicesCreated: 0,
    invoicesSkipped: 0,
    totalChargesSwept: 0,
    totalAmountCents: 0,
  };

  const now = new Date();
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const enabledTenants = await db.query.tenantModules.findMany({
    where: and(
      eq(tenantModules.moduleId, 'background_screening'),
      eq(tenantModules.isEnabled, true),
    ),
  });

  if (enabledTenants.length === 0) {
    log.info('no tenants have background_screening enabled');
    return result;
  }

  for (const tenant of enabledTenants) {
    result.tpasProcessed++;

    const unbilled = await db.query.backgroundCheckCharges.findMany({
      where: and(
        eq(backgroundCheckCharges.tpaOrgId, tenant.tpaOrgId),
        isNull(backgroundCheckCharges.invoiceId),
      ),
    });

    if (unbilled.length === 0) continue;

    const invoiceNumber = `BG-${firstOfMonth.getUTCFullYear()}${String(firstOfMonth.getUTCMonth() + 1).padStart(2, '0')}-${tenant.tpaOrgId.slice(0, 8)}`;

    // Idempotent: skip if invoice already exists for this month + tenant (by number)
    const existing = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.tpaOrgId, tenant.tpaOrgId),
        eq(invoices.invoiceNumber, invoiceNumber),
      ),
    });
    if (existing) {
      result.invoicesSkipped++;
      continue;
    }

    const totalAmount = unbilled.reduce((sum, c) => sum + c.amountCents, 0);
    const chargeIds = unbilled.map((c) => c.id);

    await db.transaction(async (tx) => {
      const [invoice] = await tx
        .insert(invoices)
        .values({
          tpaOrgId: tenant.tpaOrgId,
          invoiceNumber,
          clientOrgId: tenant.tpaOrgId, // self-billed platform line item
          amount: totalAmount,
          status: 'pending',
          invoicedAt: firstOfMonth,
          notes: `Background Screening monthly billing — ${unbilled.length} check${unbilled.length === 1 ? '' : 's'}`,
        })
        .returning();

      await tx.insert(invoiceLineItems).values(
        unbilled.map((c) => ({
          invoiceId: invoice.id,
          serviceName: c.lineItemDescription,
          serviceCode: 'BACKGROUND_CHECK',
          quantity: 1,
          unitPrice: c.amountCents,
          amount: c.amountCents,
        })),
      );

      await tx
        .update(backgroundCheckCharges)
        .set({ invoiceId: invoice.id })
        .where(inArray(backgroundCheckCharges.id, chargeIds));
    });

    await createAuditLog({
      tpaOrgId: tenant.tpaOrgId,
      actorUserId: 'system',
      actorEmail: 'system@tpaengx',
      entityType: 'invoice',
      entityId: invoiceNumber,
      action: 'background_monthly_billing',
      diffJson: {
        chargeCount: unbilled.length,
        amountCents: totalAmount,
        month: `${firstOfMonth.getUTCFullYear()}-${String(firstOfMonth.getUTCMonth() + 1).padStart(2, '0')}`,
      },
    }).catch(() => {});

    result.invoicesCreated++;
    result.totalChargesSwept += unbilled.length;
    result.totalAmountCents += totalAmount;
  }

  log.info(result, 'Background Screening monthly billing complete');
  return result;
}

export async function handleBackgroundMonthlyBilling(_job: Job) {
  return runBackgroundMonthlyBilling();
}
