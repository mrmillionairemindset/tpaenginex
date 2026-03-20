import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, orderChecklists, users } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and, asc } from 'drizzle-orm';
import { z } from 'zod';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/orders/[id]/checklist - Get checklist items for an order
// ============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  // Verify order exists and user has access
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Check permissions — TPA users see TPA-scoped orders, clients see own orders
  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  const isOwner = order.orgId === user.organization?.id;
  const isTpaScoped = user.tpaOrgId && order.tpaOrgId === user.tpaOrgId;

  if (!isTpaUser && !isOwner) {
    return NextResponse.json(
      { error: 'You do not have permission to view this order' },
      { status: 403 }
    );
  }

  if (isTpaUser && !isTpaScoped && user.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Order not found in your TPA scope' },
      { status: 403 }
    );
  }

  const items = await db.query.orderChecklists.findMany({
    where: eq(orderChecklists.orderId, id),
    with: {
      completedByUser: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: [asc(orderChecklists.sortOrder)],
  });

  return NextResponse.json({ checklist: items });
}

// ============================================================================
// PATCH /api/orders/[id]/checklist - Toggle a checklist item
// ============================================================================

const patchSchema = z.object({
  checklistItemId: z.string().uuid(),
  isCompleted: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  // Only TPA users can toggle checklist items
  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  if (!isTpaUser) {
    return NextResponse.json(
      { error: 'Only TPA users can update checklist items' },
      { status: 403 }
    );
  }

  // Verify order exists and is in TPA scope
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const isTpaScoped = user.tpaOrgId && order.tpaOrgId === user.tpaOrgId;
  if (!isTpaScoped && user.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Order not found in your TPA scope' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const validation = patchSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const { checklistItemId, isCompleted } = validation.data;

  // Verify checklist item belongs to this order
  const item = await db.query.orderChecklists.findFirst({
    where: and(
      eq(orderChecklists.id, checklistItemId),
      eq(orderChecklists.orderId, id)
    ),
  });

  if (!item) {
    return NextResponse.json(
      { error: 'Checklist item not found for this order' },
      { status: 404 }
    );
  }

  // Update the checklist item
  await db
    .update(orderChecklists)
    .set({
      isCompleted,
      completedBy: isCompleted ? user.id : null,
      completedAt: isCompleted ? new Date() : null,
    })
    .where(eq(orderChecklists.id, checklistItemId));

  // Return updated item
  const updated = await db.query.orderChecklists.findFirst({
    where: eq(orderChecklists.id, checklistItemId),
    with: {
      completedByUser: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json({ item: updated });
}
