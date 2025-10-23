import { db } from '@/db/client';
import { notifications, orders, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

type NotificationType =
  | 'order_created'
  | 'order_assigned'
  | 'order_scheduled'
  | 'order_completed'
  | 'results_uploaded'
  | 'results_approved'
  | 'results_rejected'
  | 'site_assigned'
  | 'general';

interface CreateNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string;
}

export async function createNotification(options: CreateNotificationOptions) {
  try {
    await db.insert(notifications).values({
      userId: options.userId,
      type: options.type,
      title: options.title,
      message: options.message,
      orderId: options.orderId || null,
      isRead: false,
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

export async function notifyOrderCreated(orderId: string, orderNumber: string) {
  try {
    // Get order with organization
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        organization: true,
      },
    });

    if (!order) return;

    // Notify all provider admins and agents
    const providerUsers = await db.query.users.findMany({
      where: eq(users.role, 'provider_admin'),
    });

    for (const user of providerUsers) {
      await createNotification({
        userId: user.id,
        type: 'order_created',
        title: 'New Order Created',
        message: `Order ${orderNumber} has been created by ${order.organization.name}`,
        orderId,
      });
    }
  } catch (error) {
    console.error('Error notifying order created:', error);
  }
}

export async function notifySiteAssigned(orderId: string, orderNumber: string, siteName: string) {
  try {
    // Get order to find employer users
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        organization: {
          with: {
            users: true,
          },
        },
        candidate: true,
      },
    });

    if (!order || !order.organization) return;

    // Notify employer admin
    const employerAdmins = order.organization.users.filter(
      u => u.role === 'employer_admin'
    );

    for (const admin of employerAdmins) {
      await createNotification({
        userId: admin.id,
        type: 'site_assigned',
        title: 'Site Assigned',
        message: `${siteName} has been assigned for ${order.candidate.firstName} ${order.candidate.lastName} (${orderNumber})`,
        orderId,
      });
    }
  } catch (error) {
    console.error('Error notifying site assigned:', error);
  }
}

export async function notifyResultsUploaded(orderId: string, orderNumber: string) {
  try {
    // Get order to find employer users
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        organization: {
          with: {
            users: true,
          },
        },
      },
    });

    if (!order || !order.organization) return;

    // Notify all employer users
    for (const user of order.organization.users) {
      await createNotification({
        userId: user.id,
        type: 'results_uploaded',
        title: 'Results Ready for Review',
        message: `Results for order ${orderNumber} are ready for your review`,
        orderId,
      });
    }
  } catch (error) {
    console.error('Error notifying results uploaded:', error);
  }
}

export async function notifyResultsApproved(orderId: string, orderNumber: string) {
  try {
    // Get order
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) return;

    // Notify provider admins
    const providerUsers = await db.query.users.findMany({
      where: eq(users.role, 'provider_admin'),
    });

    for (const user of providerUsers) {
      await createNotification({
        userId: user.id,
        type: 'results_approved',
        title: 'Results Approved',
        message: `Results for order ${orderNumber} have been approved`,
        orderId,
      });
    }
  } catch (error) {
    console.error('Error notifying results approved:', error);
  }
}

export async function notifyResultsRejected(orderId: string, orderNumber: string, feedback: string) {
  try {
    // Get order
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) return;

    // Notify provider admins and agents
    const providerUsers = await db.query.users.findMany();
    const providerRoles = providerUsers.filter(
      u => u.role === 'provider_admin' || u.role === 'provider_agent'
    );

    for (const user of providerRoles) {
      await createNotification({
        userId: user.id,
        type: 'results_rejected',
        title: 'Results Rejected - Correction Needed',
        message: `Results for order ${orderNumber} were rejected. Feedback: ${feedback.substring(0, 100)}${feedback.length > 100 ? '...' : ''}`,
        orderId,
      });
    }
  } catch (error) {
    console.error('Error notifying results rejected:', error);
  }
}
