import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { orders, orderReviews } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { notifyResultsApproved, notifyResultsRejected } from '@/lib/notifications';

/**
 * POST /api/orders/[id]/review
 * Employer reviews order results (approve or reject)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only employers can review orders
    if (!user.role?.startsWith('employer')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { action, feedback } = await request.json();

    if (!action || !['approved', 'rejected'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const orderId = params.id;

    // Fetch the order to verify it exists and belongs to employer's org
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Verify order belongs to employer's org
    if (order.orgId !== user.orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Verify order is in pending_review status
    if (order.status !== 'pending_review') {
      return NextResponse.json(
        { error: 'Order is not in pending review status' },
        { status: 400 }
      );
    }

    // Create review record
    await db.insert(orderReviews).values({
      orderId,
      reviewedBy: user.id,
      action,
      feedback: feedback || null,
    });

    // Update order status based on action
    const newStatus = action === 'approved' ? 'complete' : 'needs_correction';
    await db
      .update(orders)
      .set({
        status: newStatus,
        completedAt: action === 'approved' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    // Send notifications
    if (action === 'approved') {
      await notifyResultsApproved(orderId, order.orderNumber);
    } else {
      await notifyResultsRejected(orderId, order.orderNumber, feedback || 'No feedback provided');
    }

    return NextResponse.json({
      message: `Order ${action} successfully`,
      status: newStatus,
    });
  } catch (error) {
    console.error('Failed to review order:', error);
    return NextResponse.json(
      { error: 'Failed to review order' },
      { status: 500 }
    );
  }
}
