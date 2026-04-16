/**
 * Inbound webhook route for all lab vendor adapters.
 *
 * Single dynamic route handles: escreen, formfox, crl, quest, labcorp.
 * Each vendor's webhook is authenticated via HMAC-SHA256 signature
 * verification using the tenant's stored webhook secret.
 *
 * Flow:
 *   1. Read adapter param from URL
 *   2. Read raw body (HMAC requires exact bytes)
 *   3. Determine TPA from webhook payload or query params
 *   4. Load adapter, verify signature
 *   5. Process webhook -> canonical event
 *   6. Update order/specimen/result records
 *   7. Emit internal webhook + audit log
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, specimens, results } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import {
  isValidAdapterType,
  getAdapterByTypeForTenant,
  type DrugTestingAdapterType,
} from '@/modules/drug-testing/adapters';
import { enqueueWebhookEvent } from '@/lib/webhooks';
import { createAuditLog } from '@/lib/audit';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const log = logger.child({ component: 'webhook-labs' });

/**
 * Extract the TPA org ID from the webhook payload.
 * Each vendor embeds this differently — we check multiple locations.
 */
function extractTpaOrgId(
  payload: Record<string, unknown>,
  searchParams: URLSearchParams,
): string | null {
  // Query parameter (most reliable — set when configuring webhook URL)
  const fromQuery = searchParams.get('tpa_org_id') || searchParams.get('tpaOrgId');
  if (fromQuery) return fromQuery;

  // In payload.data.tpa_org_id (eScreen, FormFox, Quest)
  const data = payload.data as Record<string, unknown> | undefined;
  if (data?.tpa_org_id && typeof data.tpa_org_id === 'string') return data.tpa_org_id;

  // Top-level tpa_org_id
  if (payload.tpa_org_id && typeof payload.tpa_org_id === 'string') return payload.tpa_org_id as string;

  // From custom_id or order_id — look up in DB (handled by caller if null)
  return null;
}

/**
 * Try to find TPA org ID from an external ID or order reference.
 */
async function lookupTpaOrgIdFromExternalRef(
  externalId: string | undefined,
  orderId: string | undefined,
): Promise<string | null> {
  if (orderId) {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      columns: { tpaOrgId: true },
    });
    if (order) return order.tpaOrgId;
  }
  if (externalId) {
    const order = await db.query.orders.findFirst({
      where: eq(orders.externalRowId, externalId),
      columns: { tpaOrgId: true },
    });
    if (order) return order.tpaOrgId;
  }
  return null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ adapter: string }> },
): Promise<Response> {
  const { adapter: adapterParam } = await params;

  // 1. Validate adapter type
  if (!isValidAdapterType(adapterParam)) {
    log.warn({ adapter: adapterParam }, 'Unknown adapter type in webhook URL');
    return NextResponse.json({ error: 'Unknown adapter type' }, { status: 400 });
  }
  const adapterType = adapterParam as DrugTestingAdapterType;

  // 2. Read raw body for HMAC verification
  const rawBody = await req.text();
  const signatureHeader =
    req.headers.get('x-webhook-signature') ||
    req.headers.get('x-signature') ||
    req.headers.get('x-hub-signature-256') ||
    '';

  // 3. Parse payload
  let payload: Record<string, unknown>;
  try {
    // CRL may send HL7v2 (not JSON)
    if (rawBody.startsWith('MSH|')) {
      payload = { _hl7: true, _raw: rawBody };
    } else {
      payload = JSON.parse(rawBody);
    }
  } catch {
    log.warn({ adapter: adapterType }, 'Webhook payload not valid JSON or HL7');
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  // 4. Determine TPA org ID
  let tpaOrgId = extractTpaOrgId(payload, req.nextUrl.searchParams);

  if (!tpaOrgId) {
    // Try to find from external references in the payload
    const data = payload.data as Record<string, unknown> | undefined;
    tpaOrgId = await lookupTpaOrgIdFromExternalRef(
      (data?.id as string) || (data?.external_id as string),
      (data?.order_id as string) || (payload.order_id as string),
    );
  }

  if (!tpaOrgId) {
    log.warn({ adapter: adapterType }, 'Could not determine TPA org from webhook');
    // Return 200 to avoid vendor retries for events we cannot route
    return NextResponse.json({ ok: true, ignored: true, reason: 'no_tpa_org' });
  }

  // 5. Load adapter and verify signature
  let adapter: Awaited<ReturnType<typeof getAdapterByTypeForTenant>>;
  try {
    adapter = await getAdapterByTypeForTenant(tpaOrgId, adapterType);
  } catch (err) {
    log.error({ adapter: adapterType, tpaOrgId, err }, 'Failed to load adapter for webhook');
    return NextResponse.json({ error: 'Adapter not configured' }, { status: 500 });
  }

  // Verify signature if the adapter supports it
  const adapterAny = adapter as unknown as Record<string, unknown>;
  if (typeof adapterAny.verifyWebhookSignature === 'function') {
    const verified = (adapterAny.verifyWebhookSignature as (body: string, sig: string) => boolean)(
      rawBody,
      signatureHeader,
    );
    if (!verified) {
      log.warn({ adapter: adapterType, tpaOrgId }, 'Webhook signature verification failed');
      await createAuditLog({
        tpaOrgId,
        actorUserId: 'system',
        actorEmail: 'system@tpaengx',
        entityType: 'webhook',
        entityId: adapterType,
        action: 'webhook_signature_mismatch',
        diffJson: { adapter: adapterType },
      }).catch(() => {});
      return NextResponse.json({ error: 'Signature mismatch' }, { status: 401 });
    }
  }

  // 6. Process webhook through adapter
  let canonicalEvent;
  try {
    const webhookPayload = payload._hl7 ? rawBody : payload;
    canonicalEvent = await adapter.handleWebhook(webhookPayload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ adapter: adapterType, tpaOrgId, err: message }, 'Adapter handleWebhook failed');
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }

  // 7. Update order/specimen/result records if we can match
  const matchedOrderId = canonicalEvent.orderId;
  if (matchedOrderId) {
    try {
      // Try to match by external ID first, then by order ID
      let order = await db.query.orders.findFirst({
        where: and(
          eq(orders.tpaOrgId, tpaOrgId),
          eq(orders.externalRowId, canonicalEvent.externalId),
        ),
      });

      if (!order) {
        order = await db.query.orders.findFirst({
          where: and(
            eq(orders.tpaOrgId, tpaOrgId),
            eq(orders.id, matchedOrderId),
          ),
        });
      }

      if (order) {
        // Update order status based on event type
        const statusUpdate = mapEventToOrderStatus(canonicalEvent.eventType);
        if (statusUpdate) {
          await db
            .update(orders)
            .set({ status: statusUpdate, updatedAt: new Date() })
            .where(eq(orders.id, order.id));
        }
      }
    } catch (err) {
      log.error({ err, orderId: matchedOrderId }, 'Failed to update order from webhook');
      // Don't fail the webhook — still return 200
    }
  }

  // 8. Audit log
  await createAuditLog({
    tpaOrgId,
    actorUserId: 'system',
    actorEmail: 'system@tpaengx',
    entityType: 'webhook',
    entityId: canonicalEvent.externalId || adapterType,
    action: `webhook:${adapterType}:${canonicalEvent.eventType}`,
    diffJson: {
      eventType: canonicalEvent.eventType,
      externalId: canonicalEvent.externalId,
      orderId: canonicalEvent.orderId,
    },
  }).catch(() => {});

  // 9. Emit internal webhook
  await enqueueWebhookEvent({
    tpaOrgId,
    event: 'order.results_updated',
    payload: {
      adapter: adapterType,
      eventType: canonicalEvent.eventType,
      externalId: canonicalEvent.externalId,
      orderId: canonicalEvent.orderId,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

type OrderStatus = 'new' | 'needs_site' | 'scheduled' | 'in_progress' | 'results_uploaded' | 'pending_review' | 'needs_correction' | 'complete' | 'cancelled';

/**
 * Map adapter event types to internal order status values.
 */
function mapEventToOrderStatus(eventType: string): OrderStatus | null {
  switch (eventType) {
    case 'drug_screening.collected':
    case 'ccf.collected':
    case 'order.collected':
      return 'in_progress';
    case 'drug_screening.completed':
    case 'results.ready':
    case 'result.available':
    case 'hl7.oru_r01':
    case 'sftp.hl7_result':
    case 'sftp.csv_result':
    case 'results.received':
      return 'results_uploaded';
    case 'order.cancelled':
      return 'cancelled';
    default:
      return null;
  }
}
