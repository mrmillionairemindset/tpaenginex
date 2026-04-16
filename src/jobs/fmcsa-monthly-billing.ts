/**
 * Monthly FMCSA Registry billing line-item generator.
 *
 * At the 1st of each month, count how many users on each TPA tenant have an
 * active NRCME credential (nrcmeNumber != null AND (nrcmeExpiresAt is null OR
 * nrcmeExpiresAt > now)). Charge $99/month per Certified Medical Examiner.
 *
 * The tenant must have the `occupational_health` module enabled AND have
 * `tenant_modules.config.fmcsaRegistryBilling = true` (TPA opts in when they
 * sign up for the FMCSA registry service).
 *
 * Implementation: creates a platform-billing invoice (clientOrgId = tpaOrgId)
 * dated to the 1st of the month with one line item: "FMCSA Registry — N CMEs".
 */

import { Job } from 'bullmq';
import { db } from '@/db/client';
import { users, tenantModules, organizations, invoices, invoiceLineItems } from '@/db/schema';
import { and, eq, isNotNull, isNull, or, gt, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit';

const log = logger.child({ component: 'fmcsa-monthly-billing' });

export const FMCSA_PRICE_PER_CME_CENTS = 9900; // $99.00

interface TenantConfig {
  fmcsaRegistryBilling?: boolean;
  [k: string]: unknown;
}

interface FmcsaBillingResult {
  tpasProcessed: number;
  invoicesCreated: number;
  invoicesSkipped: number;
  totalCmes: number;
  totalAmountCents: number;
}

export async function runFmcsaMonthlyBilling(): Promise<FmcsaBillingResult> {
  const result: FmcsaBillingResult = {
    tpasProcessed: 0,
    invoicesCreated: 0,
    invoicesSkipped: 0,
    totalCmes: 0,
    totalAmountCents: 0,
  };

  const now = new Date();
  const firstOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  // Find all TPAs with the occupational_health module enabled AND opted into billing
  const enabledTenants = await db.query.tenantModules.findMany({
    where: and(
      eq(tenantModules.moduleId, 'occupational_health'),
      eq(tenantModules.isEnabled, true),
    ),
  });

  const optedIn = enabledTenants.filter((t) => {
    const config = (t.config as TenantConfig | null) ?? null;
    return config?.fmcsaRegistryBilling === true;
  });

  if (optedIn.length === 0) {
    log.info('no tenants opted into FMCSA registry billing');
    return result;
  }

  for (const tenant of optedIn) {
    result.tpasProcessed++;

    // Check whether we've already generated this month's invoice
    const existing = await db.query.invoices.findFirst({
      where: and(
        eq(invoices.tpaOrgId, tenant.tpaOrgId),
        eq(invoices.clientOrgId, tenant.tpaOrgId),
        sql`${invoices.invoicedAt} >= ${firstOfMonth}`,
        sql`${invoices.invoicedAt} < ${nextMonth}`,
        sql`${invoices.notes} ILIKE '%FMCSA Registry%'`,
      ),
    });
    if (existing) {
      result.invoicesSkipped++;
      continue;
    }

    // Count active CMEs for this tenant
    const cmes = await db.query.users.findMany({
      where: and(
        eq(users.orgId, tenant.tpaOrgId),
        eq(users.isActive, true),
        isNotNull(users.nrcmeNumber),
        or(
          isNull(users.nrcmeExpiresAt),
          gt(users.nrcmeExpiresAt, now),
        ),
      ),
      columns: { id: true, email: true, nrcmeNumber: true },
    });

    if (cmes.length === 0) {
      log.info({ tpaOrgId: tenant.tpaOrgId }, 'opted in but no active CMEs — skipping');
      continue;
    }

    const amountCents = cmes.length * FMCSA_PRICE_PER_CME_CENTS;
    const invoiceNumber = `FMCSA-${firstOfMonth.getUTCFullYear()}${String(firstOfMonth.getUTCMonth() + 1).padStart(2, '0')}-${tenant.tpaOrgId.slice(0, 8)}`;

    await db.transaction(async (tx) => {
      const [invoice] = await tx
        .insert(invoices)
        .values({
          tpaOrgId: tenant.tpaOrgId,
          invoiceNumber,
          clientOrgId: tenant.tpaOrgId, // self-billed (platform-level service)
          amount: amountCents,
          status: 'pending',
          invoicedAt: firstOfMonth,
          notes: `FMCSA Registry monthly service — ${cmes.length} Certified Medical Examiner${cmes.length === 1 ? '' : 's'}`,
        })
        .returning();

      await tx.insert(invoiceLineItems).values({
        invoiceId: invoice.id,
        serviceName: `FMCSA Registry service — ${cmes.length} CME${cmes.length === 1 ? '' : 's'} @ $${(FMCSA_PRICE_PER_CME_CENTS / 100).toFixed(2)}/mo`,
        serviceCode: 'FMCSA_REGISTRY_MONTHLY',
        quantity: cmes.length,
        unitPrice: FMCSA_PRICE_PER_CME_CENTS,
        amount: amountCents,
      });
    });

    await createAuditLog({
      tpaOrgId: tenant.tpaOrgId,
      actorUserId: 'system',
      actorEmail: 'system@tpaengx',
      entityType: 'invoice',
      entityId: invoiceNumber,
      action: 'fmcsa_monthly_billing',
      diffJson: {
        cmeCount: cmes.length,
        amountCents,
        month: `${firstOfMonth.getUTCFullYear()}-${String(firstOfMonth.getUTCMonth() + 1).padStart(2, '0')}`,
      },
    }).catch(() => {});

    result.invoicesCreated++;
    result.totalCmes += cmes.length;
    result.totalAmountCents += amountCents;
  }

  log.info(result, 'FMCSA monthly billing complete');
  return result;
}

export async function handleFmcsaMonthlyBilling(_job: Job) {
  return runFmcsaMonthlyBilling();
}
