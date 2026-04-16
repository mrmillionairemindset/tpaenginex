/**
 * Outbound webhooks: HMAC-signed deliveries to tenant-configured URLs.
 *
 * Flow:
 *   enqueueWebhookEvent() — called from lifecycle producers. Creates one
 *                           webhook_deliveries row per matching subscription.
 *   deliverWebhook()      — worker picks up pending deliveries, POSTs to URL,
 *                           marks success or schedules retry with backoff.
 *
 * Security:
 *   - Secrets are encrypted at rest (encryptAtRest).
 *   - Signature format: `X-Webhook-Signature: sha256=<hex>` over the raw body.
 *   - Timestamp header allows receivers to reject replay attacks.
 */

import crypto from 'crypto';
import { db } from '@/db/client';
import { webhookSubscriptions, webhookDeliveries } from '@/db/schema';
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { decryptAtRest } from './crypto';

const BACKOFF_MINUTES = [1, 5, 30, 120, 480]; // 1m, 5m, 30m, 2h, 8h
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Compute the HMAC-SHA256 signature for a webhook payload.
 * Receiver should compute the same using their shared secret and compare.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

/**
 * Enqueue a webhook event for every active subscription on this TPA
 * that subscribes to this event. Creates pending delivery rows — the
 * worker picks them up.
 */
export async function enqueueWebhookEvent(params: {
  tpaOrgId: string;
  event: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const { tpaOrgId, event, payload } = params;

  try {
    const subs = await db.query.webhookSubscriptions.findMany({
      where: and(
        eq(webhookSubscriptions.tpaOrgId, tpaOrgId),
        eq(webhookSubscriptions.isActive, true)
      ),
    });

    const matching = subs.filter((s) => s.events.includes(event));
    if (matching.length === 0) return;

    const now = new Date();
    await db.insert(webhookDeliveries).values(
      matching.map((s) => ({
        subscriptionId: s.id,
        tpaOrgId,
        event,
        payload,
        status: 'pending' as const,
        attempts: 0,
        maxAttempts: 5,
        nextAttemptAt: now,
      }))
    );
  } catch (err) {
    console.error('[webhooks] enqueueWebhookEvent failed:', err);
  }
}

/**
 * Deliver a single webhook. Loads the delivery row + subscription, POSTs,
 * and updates status on success/failure.
 */
export async function deliverWebhook(deliveryId: string): Promise<void> {
  const delivery = await db.query.webhookDeliveries.findFirst({
    where: eq(webhookDeliveries.id, deliveryId),
  });
  if (!delivery) return;
  if (delivery.status !== 'pending') return;

  const subscription = await db.query.webhookSubscriptions.findFirst({
    where: eq(webhookSubscriptions.id, delivery.subscriptionId),
  });
  if (!subscription) {
    await db
      .update(webhookDeliveries)
      .set({
        status: 'failed',
        errorMessage: 'Subscription no longer exists',
        lastAttemptAt: new Date(),
        attempts: delivery.attempts + 1,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }
  if (!subscription.isActive) {
    await db
      .update(webhookDeliveries)
      .set({
        status: 'failed',
        errorMessage: 'Subscription inactive',
        lastAttemptAt: new Date(),
        attempts: delivery.attempts + 1,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  const secret = decryptAtRest(subscription.secret);
  const body = JSON.stringify({
    event: delivery.event,
    deliveryId: delivery.id,
    timestamp: Date.now(),
    data: delivery.payload,
  });
  const signature = signWebhookPayload(body, secret);
  const timestampMs = Date.now();

  // Rolling rotation: if a previous secret is still within its grace window,
  // emit a second signature so subscribers verifying with either secret succeed.
  let previousSignature: string | null = null;
  if (
    subscription.previousSecret &&
    subscription.previousSecretExpiresAt &&
    subscription.previousSecretExpiresAt.getTime() > Date.now()
  ) {
    try {
      const prev = decryptAtRest(subscription.previousSecret);
      previousSignature = signWebhookPayload(body, prev);
    } catch (err) {
      // If the previous secret can't be decrypted, log and proceed with only the current signature.
      console.error('[webhooks] failed to decrypt previous secret:', err);
    }
  }

  const attempts = delivery.attempts + 1;
  const now = new Date();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'TPAEngineX-Webhook/1.0',
      'X-Webhook-Event': delivery.event,
      'X-Webhook-Signature': signature,
      'X-Webhook-Delivery': delivery.id,
      'X-Webhook-Timestamp': String(timestampMs),
    };
    if (previousSignature) {
      headers['X-Webhook-Signature-Previous'] = previousSignature;
    }

    const res = await fetch(subscription.url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const responseText = await res.text().catch(() => '');
    const truncatedBody = responseText.slice(0, 2000);

    if (res.status >= 200 && res.status < 300) {
      await db
        .update(webhookDeliveries)
        .set({
          status: 'success',
          attempts,
          lastAttemptAt: now,
          deliveredAt: now,
          responseStatus: res.status,
          responseBody: truncatedBody,
          nextAttemptAt: null,
          errorMessage: null,
        })
        .where(eq(webhookDeliveries.id, deliveryId));
      return;
    }

    // Non-2xx response — schedule retry or dead-letter
    await scheduleRetryOrDeadLetter(deliveryId, {
      attempts,
      maxAttempts: delivery.maxAttempts,
      responseStatus: res.status,
      responseBody: truncatedBody,
      errorMessage: `HTTP ${res.status}`,
      lastAttemptAt: now,
    });
  } catch (err: any) {
    clearTimeout(timer);
    const message = err?.name === 'AbortError' ? 'Request timeout' : (err?.message || 'Request failed');
    await scheduleRetryOrDeadLetter(deliveryId, {
      attempts,
      maxAttempts: delivery.maxAttempts,
      responseStatus: null,
      responseBody: null,
      errorMessage: message,
      lastAttemptAt: now,
    });
  }
}

async function scheduleRetryOrDeadLetter(
  deliveryId: string,
  params: {
    attempts: number;
    maxAttempts: number;
    responseStatus: number | null;
    responseBody: string | null;
    errorMessage: string;
    lastAttemptAt: Date;
  }
) {
  const { attempts, maxAttempts } = params;

  if (attempts >= maxAttempts) {
    await db
      .update(webhookDeliveries)
      .set({
        status: 'dead_letter',
        attempts,
        lastAttemptAt: params.lastAttemptAt,
        responseStatus: params.responseStatus,
        responseBody: params.responseBody,
        errorMessage: params.errorMessage,
        nextAttemptAt: null,
      })
      .where(eq(webhookDeliveries.id, deliveryId));
    return;
  }

  // attempts is 1-indexed now; backoff index is attempts-1 (since we just consumed one)
  const backoffIdx = Math.min(attempts - 1, BACKOFF_MINUTES.length - 1);
  const delayMs = BACKOFF_MINUTES[backoffIdx] * 60_000;
  const nextAttemptAt = new Date(Date.now() + delayMs);

  await db
    .update(webhookDeliveries)
    .set({
      status: 'pending',
      attempts,
      lastAttemptAt: params.lastAttemptAt,
      responseStatus: params.responseStatus,
      responseBody: params.responseBody,
      errorMessage: params.errorMessage,
      nextAttemptAt,
    })
    .where(eq(webhookDeliveries.id, deliveryId));
}

/**
 * Claim and deliver all pending deliveries that are due. Called by the worker.
 * Returns the number processed.
 */
export async function processPendingDeliveries(limit = 100): Promise<number> {
  const now = new Date();
  const pending = await db.query.webhookDeliveries.findMany({
    where: and(
      eq(webhookDeliveries.status, 'pending'),
      or(
        isNull(webhookDeliveries.nextAttemptAt),
        lte(webhookDeliveries.nextAttemptAt, now)
      )
    ),
    limit,
    orderBy: webhookDeliveries.createdAt,
  });

  let count = 0;
  for (const delivery of pending) {
    await deliverWebhook(delivery.id);
    count++;
  }
  return count;
}

/**
 * Re-queue a failed or dead-letter delivery for another attempt.
 */
export async function redeliverWebhook(deliveryId: string): Promise<boolean> {
  const delivery = await db.query.webhookDeliveries.findFirst({
    where: eq(webhookDeliveries.id, deliveryId),
  });
  if (!delivery) return false;

  await db
    .update(webhookDeliveries)
    .set({
      status: 'pending',
      attempts: 0,
      nextAttemptAt: new Date(),
      errorMessage: null,
      responseStatus: null,
      responseBody: null,
    })
    .where(eq(webhookDeliveries.id, deliveryId));

  return true;
}

/**
 * All events that can currently be produced. Surfaced in the UI.
 */
export const AVAILABLE_WEBHOOK_EVENTS = [
  'order.created',
  'order.completed',
  'order.cancelled',
  'dqf.application.submitted',
  'dqf.application.status_changed',
  'dqf.review.completed',
  'physical.certified',
  'physical.mec_expiring',
  'physical.fmcsa_submitted',
  'background_check.created',
  'background_check.completed',
  'background_check.updated',
  'background_check.canceled',
  'order.results_updated',
  'order.submitted_to_lab',
] as const;

export type WebhookEvent = (typeof AVAILABLE_WEBHOOK_EVENTS)[number];
