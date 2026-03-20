import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders, auditLogs, orderChecklists, documents, notifications } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { notifyResultsUploaded } from '@/lib/notifications';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const updateOrderSchema = z.object({
  status: z.enum(['new', 'needs_site', 'scheduled', 'in_progress', 'results_uploaded', 'pending_review', 'needs_correction', 'complete', 'cancelled']).optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  ccfNumber: z.string().optional(),
  ccfAuditReason: z.string().optional(),
  collectorId: z.string().uuid().optional(),
  resultStatus: z.enum(['pending', 'received', 'delivered']).optional(),
});

// ============================================================================
// GET /api/orders/[id] - Get single order
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

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      candidate: true,
      organization: {
        columns: {
          id: true,
          name: true,
          type: true,
        },
      },
      collector: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
      requestedByUser: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      documents: {
        with: {
          uploadedByUser: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      reviews: {
        with: {
          reviewer: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: (reviews, { desc }) => [desc(reviews.createdAt)],
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Check permissions — TPA users can see orders in their TPA scope, clients see own orders
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

  // Strip internal notes for client_admin users
  if (user.role === 'client_admin') {
    return NextResponse.json({
      order: { ...order, internalNotes: undefined },
    });
  }

  return NextResponse.json({ order });
}

// ============================================================================
// PATCH /api/orders/[id] - Update order
// ============================================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  const body = await req.json();
  const validation = updateOrderSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Fetch existing order
  const existingOrder = await db.query.orders.findFirst({
    where: eq(orders.id, id),
  });

  if (!existingOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Check permissions
  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  const isOwner = existingOrder.orgId === user.organization?.id;

  if (!isTpaUser && !isOwner) {
    return NextResponse.json(
      { error: 'You do not have permission to update this order' },
      { status: 403 }
    );
  }

  // Build update object
  const updateData: any = { updatedAt: new Date() };

  if (data.status) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;
  if (data.scheduledFor) updateData.scheduledFor = new Date(data.scheduledFor);
  if (data.completedAt) updateData.completedAt = new Date(data.completedAt);
  if (data.ccfNumber !== undefined) {
    if (existingOrder.ccfNumber) {
      // CCF already set — only admin can override, with audit reason required
      const isAdmin = user.role === 'tpa_admin' || user.role === 'platform_admin';
      if (!isAdmin) {
        return NextResponse.json(
          { error: 'CCF number cannot be modified after entry. Contact an admin.' },
          { status: 403 }
        );
      }
      if (!data.ccfAuditReason?.trim()) {
        return NextResponse.json(
          { error: 'Audit reason is required when overriding a CCF number.' },
          { status: 400 }
        );
      }
      // Write audit log
      await db.insert(auditLogs).values({
        tpaOrgId: existingOrder.tpaOrgId,
        actorUserId: user.id,
        actorEmail: user.email,
        entityType: 'order',
        entityId: id,
        action: 'ccf_override',
        diffJson: {
          previousCcf: existingOrder.ccfNumber,
          newCcf: data.ccfNumber,
          reason: data.ccfAuditReason.trim(),
        },
      });
    }
    updateData.ccfNumber = data.ccfNumber;
  }
  if (data.collectorId) updateData.collectorId = data.collectorId;
  if (data.resultStatus) updateData.resultStatus = data.resultStatus;

  // Auto-set completedAt if status changes to complete
  if (data.status === 'complete' && !existingOrder.completedAt) {
    updateData.completedAt = new Date();
  }

  // Update order
  await db.update(orders).set(updateData).where(eq(orders.id, id));

  // Send notifications for status changes
  if (data.status === 'pending_review' && existingOrder.status !== 'pending_review') {
    await notifyResultsUploaded(id, existingOrder.orderNumber);
  }

  // Fetch full order with relations
  const fullOrder = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    with: {
      candidate: true,
      organization: {
        columns: {
          id: true,
          name: true,
          type: true,
        },
      },
      collector: {
        columns: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      requestedByUser: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json({ order: fullOrder, message: 'Order updated successfully' });
}

// ============================================================================
// DELETE /api/orders/[id] - Cancel or hard-delete order
// ============================================================================
// Query param: ?action=delete for hard delete, default is cancel
// Hard delete rules:
//   - tpa_staff: only 'new' orders
//   - tpa_admin: any status
//   - platform_admin: no delete (troubleshoot/setup only)
//   - client_admin: no delete
// All deletes require audit reason

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action'); // 'delete' for hard delete

  const existingOrder = await db.query.orders.findFirst({
    where: eq(orders.id, id),
  });

  if (!existingOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (action === 'delete') {
    // Hard delete flow
    // Platform admin cannot delete — they're for troubleshooting only
    if (user.role === 'platform_admin') {
      return NextResponse.json(
        { error: 'Platform admins cannot delete orders. Submit a support ticket to the TPA admin.' },
        { status: 403 }
      );
    }

    // Client admin cannot delete
    if (user.role === 'client_admin') {
      return NextResponse.json(
        { error: 'You do not have permission to delete orders' },
        { status: 403 }
      );
    }

    // tpa_staff can only delete 'new' orders
    if (user.role === 'tpa_staff' && existingOrder.status !== 'new') {
      return NextResponse.json(
        { error: 'Staff can only delete orders in "new" status. Use cancel for orders already in progress.' },
        { status: 403 }
      );
    }

    // tpa_admin can delete any status
    if (user.role !== 'tpa_admin' && user.role !== 'tpa_staff') {
      return NextResponse.json(
        { error: 'You do not have permission to delete orders' },
        { status: 403 }
      );
    }

    // Require audit reason
    let body;
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    if (!body.reason?.trim()) {
      return NextResponse.json(
        { error: 'Audit reason is required to delete an order' },
        { status: 400 }
      );
    }

    // Write audit log before deletion
    await db.insert(auditLogs).values({
      tpaOrgId: existingOrder.tpaOrgId,
      actorUserId: user.id,
      actorEmail: user.email,
      entityType: 'order',
      entityId: id,
      action: 'order_deleted',
      diffJson: {
        orderNumber: existingOrder.orderNumber,
        status: existingOrder.status,
        reason: body.reason.trim(),
        candidateId: existingOrder.candidateId,
        serviceType: existingOrder.serviceType,
      },
    });

    // Hard delete — cascade removes checklists, documents FK will be set null
    await db.delete(orderChecklists).where(eq(orderChecklists.orderId, id));
    await db.delete(notifications).where(eq(notifications.orderId, id));
    await db.delete(orders).where(eq(orders.id, id));

    return NextResponse.json({ message: 'Order permanently deleted', deleted: true });
  } else {
    // Cancel flow (soft delete)
    const isTpaUser = user.role?.startsWith('tpa_');
    const isClientAdmin = user.role === 'client_admin' && existingOrder.orgId === user.organization?.id;

    if (!isTpaUser && !isClientAdmin && user.role !== 'platform_admin') {
      return NextResponse.json(
        { error: 'You do not have permission to cancel this order' },
        { status: 403 }
      );
    }

    if (existingOrder.status === 'complete' || existingOrder.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot cancel an order that is already complete or cancelled' },
        { status: 400 }
      );
    }

    await db
      .update(orders)
      .set({
        status: 'cancelled',
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));

    return NextResponse.json({ message: 'Order cancelled successfully' });
  }
}
