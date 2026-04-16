import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { orders, specimens } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// ============================================================================
// POST /api/collector-portal/assignments/[id]/complete
// Mark a collection as complete (sets status to in_progress, optionally adds CCF)
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'collector') {
      return NextResponse.json(
        { error: 'Forbidden: Collector access only' },
        { status: 403 }
      );
    }

    if (!user.collectorId) {
      return NextResponse.json(
        { error: 'No collector profile linked to this account' },
        { status: 400 }
      );
    }

    const orderId = params.id;

    // Fetch the order and verify it belongs to this collector
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.collectorId !== user.collectorId) {
      return NextResponse.json(
        { error: 'This order is not assigned to you' },
        { status: 403 }
      );
    }

    if (order.status === 'complete' || order.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Order is already complete or cancelled' },
        { status: 400 }
      );
    }

    // Parse body for optional CCF number
    let body: { ccfNumber?: string } = {};
    try {
      body = await request.json();
    } catch {
      // No body provided — that's fine, ccfNumber is optional
    }

    const updateData: Record<string, unknown> = {
      status: 'in_progress',
      updatedAt: new Date(),
    };

    if (body.ccfNumber) {
      updateData.ccfNumber = body.ccfNumber;
    }

    await db.update(orders).set(updateData).where(eq(orders.id, orderId));

    // Auto-create a specimen record for this collection
    await db.insert(specimens).values({
      orderId: order.id,
      tpaOrgId: order.tpaOrgId,
      specimenType: 'primary',
      ccfNumber: body.ccfNumber || null,
      collectorId: user.collectorId,
      collectedAt: new Date(),
      status: 'collected',
    } as typeof specimens.$inferInsert);

    // Fetch updated order with relations (strip internalNotes)
    const updatedOrder = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        person: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        clientOrg: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!updatedOrder) {
      return NextResponse.json({ error: 'Order not found after update' }, { status: 500 });
    }

    const { internalNotes, ...sanitized } = updatedOrder;

    return NextResponse.json({
      order: sanitized,
      message: 'Collection marked as in progress',
    });
  } catch (error) {
    console.error('Failed to complete assignment:', error);
    return NextResponse.json(
      { error: 'Failed to mark collection complete' },
      { status: 500 }
    );
  }
}
