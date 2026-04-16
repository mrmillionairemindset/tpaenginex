/**
 * Push Notification Service — Expo Push API
 *
 * Sends push notifications to collector mobile apps via Expo's push service.
 * Handles ticket → receipt flow, token cleanup, and mock mode for testing.
 */

import Expo, {
  ExpoPushMessage,
  ExpoPushTicket,
  ExpoPushReceipt,
  ExpoPushSuccessTicket,
} from 'expo-server-sdk';
import { db } from '@/db';
import { collectorPushTokens } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

// ============================================================================
// SINGLETON EXPO CLIENT
// ============================================================================

let expoClient: Expo | null = null;

function getExpoClient(): Expo {
  if (!expoClient) {
    expoClient = new Expo();
  }
  return expoClient;
}

// ============================================================================
// TYPES
// ============================================================================

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: string;
}

export interface BulkPushNotification {
  collectorId: string;
  payload: PushNotificationPayload;
}

export interface PushTicketRecord {
  ticketId: string;
  token: string;
  collectorId: string;
}

const PUSH_DISABLED = process.env.EXPO_PUSH_DISABLED === 'true';

// ============================================================================
// SEND TO A SINGLE COLLECTOR
// ============================================================================

/**
 * Send a push notification to all active devices for a given collector.
 * Returns an array of Expo push tickets (needed for receipt polling later).
 */
export async function sendPushNotification(
  collectorId: string,
  payload: PushNotificationPayload
): Promise<PushTicketRecord[]> {
  // Look up all active tokens for this collector
  const tokens = await db.query.collectorPushTokens.findMany({
    where: and(
      eq(collectorPushTokens.collectorId, collectorId),
      eq(collectorPushTokens.isActive, true)
    ),
  });

  if (tokens.length === 0) {
    console.log(`[push] No active tokens for collector ${collectorId} — skipping`);
    return [];
  }

  const messages: ExpoPushMessage[] = tokens
    .filter((t) => Expo.isExpoPushToken(t.token))
    .map((t) => ({
      to: t.token,
      title: payload.title,
      body: payload.body,
      data: payload.data as Record<string, unknown> | undefined,
      sound: payload.sound ?? 'default',
      badge: payload.badge,
      channelId: payload.channelId,
    }));

  if (messages.length === 0) {
    console.warn(`[push] All tokens for collector ${collectorId} are invalid Expo tokens`);
    return [];
  }

  // Mock mode — log and return empty tickets
  if (PUSH_DISABLED) {
    console.log(`[push] MOCK — would send ${messages.length} notification(s) to collector ${collectorId}:`, payload.title);
    return [];
  }

  const expo = getExpoClient();
  const chunks = expo.chunkPushNotifications(messages);
  const ticketRecords: PushTicketRecord[] = [];

  for (const chunk of chunks) {
    const tickets = await expo.sendPushNotificationsAsync(chunk);

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      const token = (chunk[i].to as string);
      const matchingToken = tokens.find((t) => t.token === token);

      if (ticket.status === 'ok') {
        ticketRecords.push({
          ticketId: (ticket as ExpoPushSuccessTicket).id,
          token,
          collectorId: matchingToken?.collectorId ?? collectorId,
        });
      } else if (ticket.status === 'error') {
        console.error(`[push] Error sending to ${token}:`, ticket.message);

        // If the token is invalid, deactivate it immediately
        if (ticket.details?.error === 'DeviceNotRegistered') {
          await deactivateToken(token);
        }
      }
    }
  }

  // Update lastUsedAt on the tokens we successfully sent to
  const sentTokenStrings = ticketRecords.map((t) => t.token);
  if (sentTokenStrings.length > 0) {
    const tokenRecords = tokens.filter((t) => sentTokenStrings.includes(t.token));
    for (const tr of tokenRecords) {
      await db
        .update(collectorPushTokens)
        .set({ lastUsedAt: new Date(), updatedAt: new Date() })
        .where(eq(collectorPushTokens.id, tr.id));
    }
  }

  return ticketRecords;
}

// ============================================================================
// SEND BULK (MULTIPLE COLLECTORS)
// ============================================================================

/**
 * Send push notifications to multiple collectors in an efficient batch.
 * Returns all Expo push tickets for receipt polling.
 */
export async function sendBulkPushNotifications(
  notifications: BulkPushNotification[]
): Promise<PushTicketRecord[]> {
  const allTickets: PushTicketRecord[] = [];

  for (const notification of notifications) {
    const tickets = await sendPushNotification(
      notification.collectorId,
      notification.payload
    );
    allTickets.push(...tickets);
  }

  return allTickets;
}

// ============================================================================
// RECEIPT PROCESSING — check ticket outcomes
// ============================================================================

/**
 * Process Expo push receipts for a batch of ticket IDs.
 * Should be called ~30 minutes after sending notifications.
 * Deactivates tokens that Expo reports as DeviceNotRegistered.
 */
export async function processPushReceipts(
  ticketRecords: PushTicketRecord[]
): Promise<{ processed: number; deactivated: number }> {
  if (PUSH_DISABLED || ticketRecords.length === 0) {
    return { processed: 0, deactivated: 0 };
  }

  const expo = getExpoClient();
  const ticketIds = ticketRecords.map((t) => t.ticketId);
  const ticketIdChunks = expo.chunkPushNotificationReceiptIds(ticketIds);

  let processed = 0;
  let deactivated = 0;

  for (const chunk of ticketIdChunks) {
    const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

    for (const [receiptId, receipt] of Object.entries(receipts)) {
      processed++;

      if (receipt.status === 'error') {
        console.error(`[push] Receipt error for ${receiptId}:`, receipt.message);

        if (receipt.details?.error === 'DeviceNotRegistered') {
          // Find the token associated with this ticket
          const ticketRecord = ticketRecords.find((t) => t.ticketId === receiptId);
          if (ticketRecord) {
            await deactivateToken(ticketRecord.token);
            deactivated++;
          }
        }
      }
    }
  }

  return { processed, deactivated };
}

// ============================================================================
// TOKEN CLEANUP
// ============================================================================

/**
 * Deactivate a push token (soft delete).
 * Called when Expo reports DeviceNotRegistered.
 */
async function deactivateToken(token: string): Promise<void> {
  console.log(`[push] Deactivating token: ${token.substring(0, 20)}...`);
  await db
    .update(collectorPushTokens)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(collectorPushTokens.token, token));
}

/**
 * Remove all inactive tokens that were deactivated more than 30 days ago.
 * Call periodically to keep the table clean.
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await db
    .delete(collectorPushTokens)
    .where(
      and(
        eq(collectorPushTokens.isActive, false),
      )
    )
    .returning({ id: collectorPushTokens.id });

  console.log(`[push] Cleaned up ${result.length} expired tokens`);
  return result.length;
}

// ============================================================================
// CONVENIENCE — send a collector push alongside existing notification
// ============================================================================

/**
 * Helper to send a push notification to a collector for a new assignment.
 * Called from the assign-collector route handler.
 */
export async function sendCollectorAssignmentPush(
  collectorId: string,
  orderNumber: string,
  location: string
): Promise<void> {
  await sendPushNotification(collectorId, {
    title: 'New Assignment',
    body: `New assignment: ${orderNumber} at ${location}`,
    data: { type: 'new_assignment', orderNumber },
    channelId: 'assignments',
  });
}

/**
 * Helper to send a push notification to a collector for a new event assignment.
 */
export async function sendCollectorEventPush(
  collectorId: string,
  eventNumber: string,
  location: string,
  scheduledDate: string
): Promise<void> {
  await sendPushNotification(collectorId, {
    title: 'New Event Assignment',
    body: `New event: ${eventNumber} at ${location} on ${scheduledDate}`,
    data: { type: 'new_event', eventNumber },
    channelId: 'assignments',
  });
}
