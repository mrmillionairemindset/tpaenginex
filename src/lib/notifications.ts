import { db } from '@/db/client';
import { notifications, orders, users, organizations } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';

type NotificationType =
  | 'order_created'
  | 'order_assigned'
  | 'order_scheduled'
  | 'order_completed'
  | 'results_uploaded'
  | 'results_approved'
  | 'results_rejected'
  | 'site_assigned'
  | 'general'
  | 'collector_assigned'
  | 'collection_complete'
  | 'kit_reminder'
  | 'collector_confirm_reminder'
  | 'results_pending_followup'
  | 'order_completed_client'
  | 'billing_queued'
  | 'random_selection';

interface CreateNotificationOptions {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string;
  tpaOrgId?: string;
}

export async function createNotification(options: CreateNotificationOptions) {
  try {
    await db.insert(notifications).values({
      userId: options.userId,
      type: options.type,
      title: options.title,
      message: options.message,
      orderId: options.orderId || null,
      tpaOrgId: options.tpaOrgId || null,
      isRead: false,
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

export async function notifyOrderCreated(orderId: string, orderNumber: string) {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        organization: true,
      },
    });

    if (!order) return;

    // Notify TPA admin and staff users scoped to this TPA
    const tpaUsers = await db.query.users.findMany({
      where: or(
        eq(users.role, 'tpa_admin'),
        eq(users.role, 'tpa_staff'),
      ),
    });

    // Filter to users in the same TPA org
    const relevantUsers = order.tpaOrgId
      ? tpaUsers.filter(u => {
          // Simple filter — in production, join through org membership
          return true; // Notify all TPA admins/staff for now
        })
      : tpaUsers;

    for (const user of relevantUsers) {
      await createNotification({
        userId: user.id,
        type: 'order_created',
        title: 'New Order Created',
        message: `Order ${orderNumber} has been created for ${order.organization.name}`,
        orderId,
        tpaOrgId: order.tpaOrgId || undefined,
      });
    }
  } catch (error) {
    console.error('Error notifying order created:', error);
  }
}

export async function notifyCollectorAssigned(orderId: string, orderNumber: string, collectorName: string) {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: {
        organization: {
          with: {
            users: true,
          },
        },
        person: true,
      },
    });

    if (!order || !order.organization) return;

    // Notify client admins
    const clientAdmins = order.organization.users.filter(
      u => u.role === 'client_admin'
    );

    for (const admin of clientAdmins) {
      await createNotification({
        userId: admin.id,
        type: 'collector_assigned',
        title: 'Collector Assigned',
        message: `${collectorName} has been assigned for ${order.person.firstName} ${order.person.lastName} (${orderNumber})`,
        orderId,
        tpaOrgId: order.tpaOrgId || undefined,
      });
    }
  } catch (error) {
    console.error('Error notifying collector assigned:', error);
  }
}

export async function notifyResultsUploaded(orderId: string, orderNumber: string) {
  try {
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

    // Notify all client users of this org
    for (const user of order.organization.users) {
      await createNotification({
        userId: user.id,
        type: 'results_uploaded',
        title: 'Results Ready for Review',
        message: `Results for order ${orderNumber} are ready for your review`,
        orderId,
        tpaOrgId: order.tpaOrgId || undefined,
      });
    }
  } catch (error) {
    console.error('Error notifying results uploaded:', error);
  }
}

export async function notifyResultsApproved(orderId: string, orderNumber: string) {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) return;

    // Notify TPA admin
    const tpaAdmins = await db.query.users.findMany({
      where: eq(users.role, 'tpa_admin'),
    });

    for (const user of tpaAdmins) {
      await createNotification({
        userId: user.id,
        type: 'results_approved',
        title: 'Results Approved',
        message: `Results for order ${orderNumber} have been approved`,
        orderId,
        tpaOrgId: order.tpaOrgId || undefined,
      });
    }
  } catch (error) {
    console.error('Error notifying results approved:', error);
  }
}

export async function notifyResultsRejected(orderId: string, orderNumber: string, feedback: string) {
  try {
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) return;

    // Notify TPA admin and records staff
    const tpaStaff = await db.query.users.findMany({
      where: or(
        eq(users.role, 'tpa_admin'),
        eq(users.role, 'tpa_records'),
      ),
    });

    for (const user of tpaStaff) {
      await createNotification({
        userId: user.id,
        type: 'results_rejected',
        title: 'Results Rejected - Correction Needed',
        message: `Results for order ${orderNumber} were rejected. Feedback: ${feedback.substring(0, 100)}${feedback.length > 100 ? '...' : ''}`,
        orderId,
        tpaOrgId: order.tpaOrgId || undefined,
      });
    }
  } catch (error) {
    console.error('Error notifying results rejected:', error);
  }
}
