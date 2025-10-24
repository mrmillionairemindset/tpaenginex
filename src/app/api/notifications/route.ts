import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { notifications } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, desc } from 'drizzle-orm';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// GET /api/notifications - Get user's notifications
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all notifications for the user, ordered by most recent
    const userNotifications = await db.query.notifications.findMany({
      where: eq(notifications.userId, user.id),
      orderBy: [desc(notifications.createdAt)],
      limit: 50, // Limit to 50 most recent notifications
    });

    return NextResponse.json({ notifications: userNotifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications - Mark all notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Mark all unread notifications as read
    await db
      .update(notifications)
      .set({
        isRead: true,
        readAt: new Date()
      })
      .where(eq(notifications.userId, user.id));

    return NextResponse.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    return NextResponse.json(
      { error: 'Failed to mark notifications as read' },
      { status: 500 }
    );
  }
}
