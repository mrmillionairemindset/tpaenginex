import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { orders } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq } from 'drizzle-orm';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// POST /api/orders/[id]/auth-created - Mark when authorization was created in Concentra HUB
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only providers can mark authorization as created
    if (!user.role?.startsWith('provider')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, params.id),
      with: {
        organization: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Calculate expiration date based on organization's auth expiry days setting
    const authCreatedAt = new Date();
    const authExpiryDays = order.organization.authExpiryDays || 3;
    const authExpiresAt = new Date(authCreatedAt.getTime() + authExpiryDays * 24 * 60 * 60 * 1000);

    // Update order with authorization timestamps
    await db
      .update(orders)
      .set({
        authCreatedAt,
        authExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, params.id));

    return NextResponse.json({
      message: 'Authorization created and expiration timer started',
      authCreatedAt: authCreatedAt.toISOString(),
      authExpiresAt: authExpiresAt.toISOString(),
      expiresInDays: authExpiryDays,
    });
  } catch (error: any) {
    console.error('Error marking authorization as created:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to mark authorization as created' },
      { status: 500 }
    );
  }
}
