/**
 * POST /api/orders/[id]/submit-to-lab
 *
 * Submit an order to the TPA's configured lab vendor via the adapter framework.
 * Stores the external reference on the order and updates status to in_progress.
 *
 * Requires: tpa_admin, tpa_staff, or platform_admin role
 * Tenant isolation: order must belong to the authenticated TPA
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, persons } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentUser } from '@/auth/get-user';
import { getAdapterForTenant } from '@/modules/drug-testing/adapters';
import { createAuditLog } from '@/lib/audit';
import { enqueueWebhookEvent } from '@/lib/webhooks';
import type { CanonicalOrder } from '@/modules/adapter-interface';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const log = logger.child({ component: 'submit-to-lab' });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canSubmit = user.role === 'tpa_admin' || user.role === 'tpa_staff' || user.role === 'platform_admin';
  if (!canSubmit) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { id: orderId } = await params;
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId) {
    return NextResponse.json({ error: 'No TPA context' }, { status: 403 });
  }

  // 1. Load and validate order
  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, orderId), eq(orders.tpaOrgId, tpaOrgId)),
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (order.externalRowId) {
    return NextResponse.json(
      { error: 'Order has already been submitted to a lab', externalRowId: order.externalRowId },
      { status: 409 },
    );
  }

  // 2. Load person data for the canonical order
  const person = await db.query.persons.findFirst({
    where: eq(persons.id, order.personId),
  });

  if (!person) {
    return NextResponse.json({ error: 'Person record not found for this order' }, { status: 404 });
  }

  // 3. Get adapter for this TPA
  const adapterResult = await getAdapterForTenant(tpaOrgId);
  if (!adapterResult) {
    return NextResponse.json(
      { error: 'No lab integration configured for this tenant. Configure one in Settings > Drug Testing > Lab Integrations.' },
      { status: 422 },
    );
  }

  const { adapter, adapterType } = adapterResult;

  // 4. Build canonical order
  const canonicalOrder: CanonicalOrder = {
    orderId: order.id,
    tpaOrgId: order.tpaOrgId,
    personId: order.personId,
    personFirstName: person.firstName,
    personLastName: person.lastName,
    personDOB: person.dob || undefined,
    serviceType: order.serviceType,
    isDOT: order.isDOT,
    panelCodes: order.panelCode ? [order.panelCode] : undefined,
    collectionSite: order.jobsiteLocation,
  };

  // 5. Submit to lab
  let externalRef;
  try {
    externalRef = await adapter.submitOrder(canonicalOrder);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, orderId, adapterType, tpaOrgId }, 'Lab submission failed');

    await createAuditLog({
      tpaOrgId,
      actorUserId: user.id,
      actorEmail: user.email || 'unknown',
      entityType: 'order',
      entityId: orderId,
      action: 'submit_to_lab_failed',
      diffJson: { adapterType, error: message },
    }).catch(() => {});

    return NextResponse.json(
      { error: 'Lab submission failed', details: message },
      { status: 502 },
    );
  }

  // 6. Update order with external reference
  await db
    .update(orders)
    .set({
      externalRowId: externalRef.externalId,
      adapterId: adapterType,
      status: 'in_progress',
      meta: {
        ...(order.meta as Record<string, unknown> || {}),
        externalRef: externalRef.externalRef,
        submittedToLabAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  // 7. Audit log
  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email || 'unknown',
    entityType: 'order',
    entityId: orderId,
    action: 'submitted_to_lab',
    diffJson: {
      adapterType,
      externalId: externalRef.externalId,
      externalRef: externalRef.externalRef,
    },
  }).catch(() => {});

  // 8. Emit webhook event
  await enqueueWebhookEvent({
    tpaOrgId,
    event: 'order.submitted_to_lab',
    payload: {
      orderId,
      adapterType,
      externalId: externalRef.externalId,
      externalRef: externalRef.externalRef,
    },
  }).catch(() => {});

  log.info({ orderId, adapterType, externalId: externalRef.externalId }, 'Order submitted to lab');

  return NextResponse.json({
    success: true,
    externalId: externalRef.externalId,
    externalRef: externalRef.externalRef,
    adapterType,
  });
}
