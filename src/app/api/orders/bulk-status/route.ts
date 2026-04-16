import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const StatusSchema = z.enum([
  'new',
  'needs_site',
  'scheduled',
  'in_progress',
  'results_uploaded',
  'pending_review',
  'needs_correction',
  'complete',
  'cancelled',
]);

const BulkStatusBodySchema = z.object({
  orderIds: z.array(z.string().uuid()).min(1).max(500),
  status: StatusSchema,
});

// ============================================================================
// POST /api/orders/bulk-status — update status on many orders at once
// ============================================================================

export const POST = withAuth(async (req, user) => {
  const allowedRoles = ['tpa_admin', 'tpa_staff', 'platform_admin'];
  if (!allowedRoles.includes(user.role ?? '')) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BulkStatusBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { orderIds, status } = parsed.data;
  const tpaOrgId = user.tpaOrgId;

  // Verify all orderIds belong to the user's tpaOrgId
  const baseCond = [inArray(orders.id, orderIds)];
  if (tpaOrgId) {
    baseCond.push(eq(orders.tpaOrgId, tpaOrgId));
  }

  const matching = await db.query.orders.findMany({
    where: and(...baseCond),
    columns: {
      id: true,
      status: true,
      tpaOrgId: true,
    },
  });

  if (matching.length !== orderIds.length) {
    return NextResponse.json(
      {
        error:
          'One or more orderIds are not accessible to your tenant or do not exist',
      },
      { status: 403 }
    );
  }

  // Bulk update
  const updateWhere = tpaOrgId
    ? and(inArray(orders.id, orderIds), eq(orders.tpaOrgId, tpaOrgId))
    : inArray(orders.id, orderIds);

  await db
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(updateWhere);

  // Audit logs per order
  await Promise.all(
    matching.map((o) =>
      createAuditLog({
        tpaOrgId: o.tpaOrgId,
        actorUserId: user.id,
        actorEmail: user.email ?? '',
        entityType: 'order',
        entityId: o.id,
        action: 'bulk_status_update',
        diffJson: {
          status: { from: o.status, to: status },
          bulk: true,
        },
      })
    )
  );

  return NextResponse.json({ updated: matching.length });
});
