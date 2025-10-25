import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Webhook endpoint for Google Sheets edits
 * Called by Apps Script when the sheet is edited
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Verify webhook signature (optional but recommended)
    const signature = body.signature;
    const expectedSignature = process.env.SHEETS_WEBHOOK_SIGNING_SECRET;

    if (expectedSignature && signature !== expectedSignature) {
      console.warn('Invalid webhook signature from Google Sheets');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const { rowId, values, headers, editedBy, ts } = body;

    console.log(`📊 Received Google Sheets webhook for row ${rowId} edited by ${editedBy}`);

    if (!headers || !values) {
      return NextResponse.json(
        { error: 'Missing headers or values' },
        { status: 400 }
      );
    }

    // Map sheet columns to order fields
    const statusIdx = headers.indexOf('Status');
    const notesIdx = headers.indexOf('Notes');

    if (statusIdx === -1) {
      return NextResponse.json(
        { error: 'Status column not found in headers' },
        { status: 400 }
      );
    }

    const newStatus = values[statusIdx];
    const newNotes = notesIdx !== -1 ? values[notesIdx] : undefined;

    // Find order by externalRowId (the row number in the sheet)
    const order = await db.query.orders.findFirst({
      where: eq(orders.externalRowId, String(rowId)),
    });

    if (!order) {
      console.warn(`Order with externalRowId ${rowId} not found`);
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Prepare updates
    const updates: any = {
      updatedAt: new Date(),
    };

    let hasChanges = false;

    // Update status if changed
    if (newStatus && newStatus !== order.status) {
      updates.status = newStatus;
      hasChanges = true;
      console.log(`📝 Updating order ${order.orderNumber} status: ${order.status} → ${newStatus}`);
    }

    // Update notes if changed
    if (newNotes !== undefined && newNotes !== order.notes) {
      updates.notes = newNotes || null;
      hasChanges = true;
      console.log(`📝 Updating order ${order.orderNumber} notes`);
    }

    // Apply updates if there are any changes
    if (hasChanges) {
      await db
        .update(orders)
        .set(updates)
        .where(eq(orders.id, order.id));

      console.log(`✅ Updated order ${order.orderNumber} from Google Sheets`);

      return NextResponse.json({
        success: true,
        message: 'Order updated successfully',
        orderNumber: order.orderNumber,
        changes: Object.keys(updates).filter(k => k !== 'updatedAt'),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'No changes detected',
    });
  } catch (error) {
    console.error('Google Sheets webhook error:', error);
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for testing webhook connectivity
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({
    message: 'Google Sheets webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
