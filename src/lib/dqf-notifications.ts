import { db } from '@/db/client';
import { notifications, users } from '@/db/schema';
import { eq, or } from 'drizzle-orm';

/**
 * DQF in-app notification helpers.
 *
 * Uses the 'general' notification type since the notification_type enum
 * does not yet include DQF-specific values. A future migration can add
 * dedicated types like 'dqf_application_status', 'annual_review_reminder', etc.
 */

async function notifyTpaStaff(
  tpaOrgId: string,
  title: string,
  message: string,
) {
  try {
    // Fetch TPA admin and staff users
    const tpaUsers = await db.query.users.findMany({
      where: or(
        eq(users.role, 'tpa_admin'),
        eq(users.role, 'tpa_staff'),
      ),
    });

    for (const user of tpaUsers) {
      await db.insert(notifications).values({
        userId: user.id,
        tpaOrgId,
        type: 'general',
        title,
        message,
        isRead: false,
      });
    }
  } catch (error) {
    console.error('Error sending DQF notification:', error);
  }
}

/**
 * Notify TPA staff when a driver application status changes.
 */
export async function notifyApplicationStatusChange(
  applicationId: string,
  newStatus: string,
  tpaOrgId: string,
) {
  await notifyTpaStaff(
    tpaOrgId,
    'Application Status Changed',
    `Driver application ${applicationId.slice(0, 8)}... has been updated to "${newStatus}".`,
  );
}

/**
 * Notify TPA staff when an annual review is scheduled.
 */
export async function notifyReviewScheduled(
  reviewId: string,
  personName: string,
  scheduledDate: string,
  tpaOrgId: string,
) {
  await notifyTpaStaff(
    tpaOrgId,
    'Annual Review Scheduled',
    `Annual review for ${personName} has been scheduled for ${scheduledDate}.`,
  );
}

/**
 * Notify TPA staff when an annual review is completed / signed off.
 */
export async function notifyReviewCompleted(
  reviewId: string,
  personName: string,
  tpaOrgId: string,
) {
  await notifyTpaStaff(
    tpaOrgId,
    'Annual Review Completed',
    `Annual review for ${personName} has been completed and signed off.`,
  );
}

/**
 * Notify TPA staff when a new employer investigation is created.
 */
export async function notifyInvestigationCreated(
  investigationId: string,
  employerName: string,
  tpaOrgId: string,
) {
  await notifyTpaStaff(
    tpaOrgId,
    'Employer Investigation Created',
    `A new employer investigation has been created for "${employerName}".`,
  );
}
