import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
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
      requestedByUser: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      appointments: {
        with: {
          site: true,
          assignedByUser: {
            columns: {
              id: true,
              name: true,
              email: true,
            },
          },
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

  // Check permissions
  const isProvider = user.role?.startsWith('provider');
  const isOwner = order.orgId === user.organization?.id;

  if (!isProvider && !isOwner) {
    return NextResponse.json(
      { error: 'You do not have permission to view this order' },
      { status: 403 }
    );
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
  const isProvider = user.role?.startsWith('provider');
  const isEmployerAdmin = user.role === 'employer_admin';
  const isOwner = existingOrder.orgId === user.organization?.id;

  if (!isProvider && (!isOwner || !isEmployerAdmin)) {
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
      requestedByUser: {
        columns: {
          id: true,
          name: true,
          email: true,
        },
      },
      appointments: {
        with: {
          site: true,
        },
      },
    },
  });

  return NextResponse.json({ order: fullOrder, message: 'Order updated successfully' });
}

// ============================================================================
// DELETE /api/orders/[id] - Cancel order
// ============================================================================

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  // Fetch existing order
  const existingOrder = await db.query.orders.findFirst({
    where: eq(orders.id, id),
  });

  if (!existingOrder) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Check permissions
  const isProvider = user.role?.startsWith('provider');
  const isEmployerAdmin = user.role === 'employer_admin';
  const isOwner = existingOrder.orgId === user.organization?.id;

  if (!isProvider && (!isOwner || !isEmployerAdmin)) {
    return NextResponse.json(
      { error: 'You do not have permission to cancel this order' },
      { status: 403 }
    );
  }

  // Soft delete - set status to cancelled
  await db
    .update(orders)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id));

  return NextResponse.json({ message: 'Order cancelled successfully' });
}
