import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, specimens, results, signatures, documents, auditLogs } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

type TimelineEvent = {
  id: string;
  type:
    | 'order_created'
    | 'status_changed'
    | 'specimen_collected'
    | 'result_reported'
    | 'signature_added'
    | 'document_uploaded'
    | 'collector_assigned';
  timestamp: string;
  description: string;
  actor?: string | null;
};

// GET /api/orders/[id]/timeline — aggregate lifecycle events for an order
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      collector: { columns: { firstName: true, lastName: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Permission: TPA-scoped or owning client
  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  const isOwner = order.orgId === user.organization?.id;

  if (!isTpaUser && !isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (isTpaUser && user.role !== 'platform_admin' && order.tpaOrgId !== user.tpaOrgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const events: TimelineEvent[] = [];

  // Order creation
  events.push({
    id: `order-created-${order.id}`,
    type: 'order_created',
    timestamp: new Date(order.createdAt).toISOString(),
    description: `Order ${order.orderNumber} created`,
    actor: null,
  });

  // Collector assignment (use updatedAt as approximate timestamp if assigned)
  if (order.collectorId && order.collector) {
    events.push({
      id: `collector-${order.collectorId}`,
      type: 'collector_assigned',
      timestamp: new Date(order.updatedAt).toISOString(),
      description: `Collector assigned: ${order.collector.firstName} ${order.collector.lastName}`,
    });
  }

  // Specimens
  const orderSpecimens = await db.query.specimens.findMany({
    where: eq(specimens.orderId, id),
  });
  for (const s of orderSpecimens) {
    if (s.collectedAt) {
      events.push({
        id: `specimen-${s.id}`,
        type: 'specimen_collected',
        timestamp: new Date(s.collectedAt).toISOString(),
        description: `${s.specimenType || 'Primary'} specimen collected${s.ccfNumber ? ` (CCF ${s.ccfNumber})` : ''}`,
      });
    }
  }

  // Results
  const orderResults = await db.query.results.findMany({
    where: eq(results.orderId, id),
  });
  for (const r of orderResults) {
    if (r.reportedAt) {
      events.push({
        id: `result-${r.id}`,
        type: 'result_reported',
        timestamp: new Date(r.reportedAt).toISOString(),
        description: `${r.panelType} result reported: ${r.resultValue}${r.mroDecision ? ` (MRO: ${r.mroDecision.replace(/_/g, ' ')})` : ''}`,
      });
    }
  }

  // Signatures
  const orderSignatures = await db.query.signatures.findMany({
    where: eq(signatures.orderId, id),
  });
  for (const sig of orderSignatures) {
    events.push({
      id: `signature-${sig.id}`,
      type: 'signature_added',
      timestamp: new Date(sig.signedAt).toISOString(),
      description: `Signed by ${sig.signerName} as ${sig.signerRole}`,
      actor: sig.signerName,
    });
  }

  // Documents
  const orderDocs = await db.query.documents.findMany({
    where: eq(documents.orderId, id),
    with: {
      uploadedByUser: { columns: { name: true, email: true } },
    },
  });
  for (const d of orderDocs) {
    events.push({
      id: `document-${d.id}`,
      type: 'document_uploaded',
      timestamp: new Date(d.createdAt).toISOString(),
      description: `Document uploaded: ${d.fileName} (${d.kind})`,
      actor: d.uploadedByUser?.name || d.uploadedByUser?.email || null,
    });
  }

  // Audit logs for this order — capture status changes and other mutations
  const logs = await db.query.auditLogs.findMany({
    where: and(eq(auditLogs.entityType, 'order'), eq(auditLogs.entityId, id)),
  });
  for (const log of logs) {
    const diff = (log.diffJson as any) || {};
    let description = `${log.action.replace(/_/g, ' ')}`;
    let type: TimelineEvent['type'] = 'status_changed';

    if (log.action === 'status_changed' && diff.from && diff.to) {
      description = `Status changed: ${diff.from} → ${diff.to}`;
      type = 'status_changed';
    } else if (log.action === 'ccf_override') {
      description = `CCF number overridden${diff.reason ? `: ${diff.reason}` : ''}`;
      type = 'status_changed';
    } else {
      description = `${log.action.replace(/_/g, ' ')}`;
    }

    events.push({
      id: `audit-${log.id}`,
      type,
      timestamp: new Date(log.createdAt).toISOString(),
      description,
      actor: log.actorEmail || null,
    });
  }

  // Sort newest first
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ events });
}
