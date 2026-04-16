/**
 * Push Receipt Processor Job
 *
 * Runs every 30 minutes. Fetches Expo push receipts for tickets
 * sent recently and deactivates tokens reported as DeviceNotRegistered.
 *
 * Expo requires a delay between sending and checking receipts —
 * 30 minutes is well within their recommended window.
 */

import type { Job } from 'bullmq';
import { db } from '@/db/client';
import { collectorPushTokens } from '@/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import Expo from 'expo-server-sdk';

// In-memory store for recent tickets (populated when push-notifications.ts sends)
// In production, these would be persisted to Redis or DB. For now the worker
// shares memory with the push service, so this works when running in the same process.
// For a distributed setup, store tickets in Redis with a TTL.
const recentTickets: Array<{
  ticketId: string;
  token: string;
  collectorId: string;
  sentAt: Date;
}> = [];

const MAX_TICKET_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Call this from push-notifications.ts after a successful send
 * to register tickets for later receipt checking.
 */
export function registerPushTickets(
  tickets: Array<{ ticketId: string; token: string; collectorId: string }>
) {
  const now = new Date();
  for (const ticket of tickets) {
    recentTickets.push({ ...ticket, sentAt: now });
  }

  // Prune old tickets
  const cutoff = Date.now() - MAX_TICKET_AGE_MS;
  let i = 0;
  while (i < recentTickets.length && recentTickets[i].sentAt.getTime() < cutoff) {
    i++;
  }
  if (i > 0) {
    recentTickets.splice(0, i);
  }
}

/**
 * BullMQ job handler — process push receipts
 */
export async function handlePushReceiptProcessor(job: Job) {
  if (process.env.EXPO_PUSH_DISABLED === 'true') {
    console.log('[push-receipt] Push disabled — skipping receipt check');
    return;
  }

  if (recentTickets.length === 0) {
    console.log('[push-receipt] No recent tickets to check');
    return;
  }

  const expo = new Expo();
  const ticketIds = recentTickets.map((t) => t.ticketId);
  const chunks = expo.chunkPushNotificationReceiptIds(ticketIds);

  let processed = 0;
  let deactivated = 0;

  for (const chunk of chunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const [receiptId, receipt] of Object.entries(receipts)) {
        processed++;

        if (receipt.status === 'error') {
          console.error(`[push-receipt] Error for ${receiptId}:`, receipt.message);

          if (receipt.details?.error === 'DeviceNotRegistered') {
            const ticket = recentTickets.find((t) => t.ticketId === receiptId);
            if (ticket) {
              await db
                .update(collectorPushTokens)
                .set({ isActive: false, updatedAt: new Date() })
                .where(eq(collectorPushTokens.token, ticket.token));
              deactivated++;
              console.log(`[push-receipt] Deactivated token for collector ${ticket.collectorId}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('[push-receipt] Failed to fetch receipts:', error);
    }
  }

  // Clear processed tickets
  recentTickets.length = 0;

  console.log(`[push-receipt] Processed ${processed} receipts, deactivated ${deactivated} tokens`);
}
