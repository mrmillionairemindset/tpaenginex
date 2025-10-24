import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { notifications } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// PATCH /api/notifications/[id] - Mark single notification as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify notification belongs to user and mark as read
    const [updated] = await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date()
      })
      .where(
        and(
          eq(notifications.id, params.id),
          eq(notifications.userId, user.id)
        )
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Notification not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ notification: updated });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notification as read' },
      { status: 500 }
    );
  }
}
