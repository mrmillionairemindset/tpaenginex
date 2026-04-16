/**
 * Drug Testing Fetch Results Job
 *
 * Periodic job that polls lab adapters for result updates on orders
 * that have been submitted but not yet completed.
 *
 * Runs every 15 minutes. Groups orders by TPA + adapter type to
 * minimize credential lookups and respect vendor API rate limits.
 *
 * Rate limiting: max 10 requests per adapter per run to avoid
 * hammering vendor APIs. Orders are processed oldest-first.
 */

import type { Job } from 'bullmq';
import { db } from '@/db/client';
import { orders, specimens, results } from '@/db/schema';
import { eq, and, inArray, isNotNull, sql } from 'drizzle-orm';
import {
  getAdapterByTypeForTenant,
  isValidAdapterType,
  type DrugTestingAdapterType,
} from '@/modules/drug-testing/adapters';
import { enqueueWebhookEvent } from '@/lib/webhooks';
import { createAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'drug-testing-fetch-results' });

/** Max orders to poll per adapter per run (rate limiting) */
const MAX_PER_ADAPTER = 10;

/** Statuses that indicate we should still poll for results */
const POLLABLE_STATUSES = ['in_progress', 'results_uploaded'] as const;

export async function handleDrugTestingFetchResults(job: Job): Promise<void> {
  log.info('Starting drug testing result fetch sweep');

  // 1. Find all orders that have an external ID and are in a pollable status
  const pendingOrders = await db.query.orders.findMany({
    where: and(
      isNotNull(orders.externalRowId),
      inArray(orders.status, [...POLLABLE_STATUSES]),
    ),
    columns: {
      id: true,
      tpaOrgId: true,
      externalRowId: true,
      status: true,
      meta: true,
    },
    orderBy: orders.updatedAt, // oldest first
    limit: 200, // hard cap to prevent runaway
  });

  if (pendingOrders.length === 0) {
    log.info('No pending orders to poll');
    return;
  }

  log.info({ count: pendingOrders.length }, 'Found orders to poll for results');

  // 2. Group by TPA + adapter type
  const groups = new Map<string, typeof pendingOrders>();
  for (const order of pendingOrders) {
    const meta = order.meta as Record<string, unknown> | null;
    const adapterType = (meta?.adapterId as string) || '';
    const key = `${order.tpaOrgId}:${adapterType}`;
    const group = groups.get(key) || [];
    group.push(order);
    groups.set(key, group);
  }

  // 3. Process each group
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const [key, groupOrders] of groups) {
    const [tpaOrgId, adapterType] = key.split(':');

    if (!adapterType || !isValidAdapterType(adapterType)) {
      log.warn({ tpaOrgId, adapterType }, 'Skipping orders with unknown adapter type');
      continue;
    }

    // Rate limit: only poll up to MAX_PER_ADAPTER orders per adapter per run
    const batch = groupOrders.slice(0, MAX_PER_ADAPTER);

    let adapter;
    try {
      adapter = await getAdapterByTypeForTenant(tpaOrgId, adapterType as DrugTestingAdapterType);
    } catch (err) {
      log.error({ tpaOrgId, adapterType, err }, 'Failed to load adapter for result polling');
      continue;
    }

    for (const order of batch) {
      try {
        const result = await adapter.fetchResults(order.externalRowId!);

        // Check if result has meaningful data
        if (!result || result.resultValue === 'pending') {
          continue; // No update yet
        }

        // Update order status if results indicate completion
        const newStatus = mapResultToOrderStatus(result.resultValue);
        if (newStatus && newStatus !== order.status) {
          await db
            .update(orders)
            .set({ status: newStatus, updatedAt: new Date() })
            .where(eq(orders.id, order.id));

          // Emit webhook for status change
          await enqueueWebhookEvent({
            tpaOrgId,
            event: 'order.results_updated',
            payload: {
              orderId: order.id,
              adapterType,
              previousStatus: order.status,
              newStatus,
              resultValue: result.resultValue,
            },
          }).catch(() => {});

          await createAuditLog({
            tpaOrgId,
            actorUserId: 'system',
            actorEmail: 'system@tpaengx',
            entityType: 'order',
            entityId: order.id,
            action: 'results_fetched',
            diffJson: {
              adapterType,
              previousStatus: order.status,
              newStatus,
              resultValue: result.resultValue,
            },
          }).catch(() => {});

          totalUpdated++;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        log.error(
          { orderId: order.id, adapterType, tpaOrgId, err: message },
          'Failed to fetch results for order',
        );
        totalErrors++;
      }
    }
  }

  log.info({ totalUpdated, totalErrors, totalPolled: pendingOrders.length }, 'Result fetch sweep complete');
}

type OrderStatus = 'new' | 'needs_site' | 'scheduled' | 'in_progress' | 'results_uploaded' | 'pending_review' | 'needs_correction' | 'complete' | 'cancelled';

/**
 * Map a result value to an order status.
 */
function mapResultToOrderStatus(resultValue: string): OrderStatus | null {
  const lower = resultValue.toLowerCase();
  switch (lower) {
    case 'negative':
    case 'positive':
    case 'inconclusive':
    case 'cancelled':
    case 'refused':
      return 'results_uploaded';
    case 'pending':
      return null; // No change
    default:
      // If we get an unknown value that isn't 'pending', it probably has results
      if (lower !== 'in_progress' && lower !== 'submitted') {
        return 'results_uploaded';
      }
      return null;
  }
}
