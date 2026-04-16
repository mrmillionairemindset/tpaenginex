import { Job } from 'bullmq';
import { processPendingDeliveries } from '@/lib/webhooks';

/**
 * Runs every minute via a repeatable BullMQ schedule.
 * Claims pending webhook deliveries whose nextAttemptAt is due and POSTs them.
 */
export async function handleWebhookDelivery(_job: Job) {
  const count = await processPendingDeliveries(100);
  if (count > 0) {
    console.log(`[webhook-delivery] Processed ${count} webhook deliveries`);
  }
  return { processed: count };
}
