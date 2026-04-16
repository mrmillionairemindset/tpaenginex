import { Job } from 'bullmq';
import { db } from '@/db/client';
import { annualReviews, tenantModules, persons, users, organizations } from '@/db/schema';
import { eq, and, between, or } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';
import { sendAnnualReviewReminder } from '@/lib/email';
import { getTpaBranding } from '@/lib/tpa-settings';

export interface DqfAnnualReviewReminderData {
  tpaOrgId?: string; // If omitted, runs for all enabled tenants
}

/**
 * Fires daily. Queries annual reviews with scheduledDate within 14 days
 * and status = 'scheduled'. Sends email + in-app notification to TPA staff.
 */
export async function handleDqfAnnualReviewReminder(job: Job<DqfAnnualReviewReminderData>) {
  const { tpaOrgId } = job.data;

  // Find all tenants with DQF enabled
  const enabledTenants = await db.query.tenantModules.findMany({
    where: and(
      eq(tenantModules.moduleId, 'dqf'),
      eq(tenantModules.isEnabled, true),
      ...(tpaOrgId ? [eq(tenantModules.tpaOrgId, tpaOrgId)] : []),
    ),
  });

  if (enabledTenants.length === 0) {
    console.log('[dqf-annual-review-reminder] No tenants with DQF enabled — skipping');
    return;
  }

  const now = new Date();
  const fourteenDaysOut = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  let totalProcessed = 0;

  for (const tenant of enabledTenants) {
    // Find reviews due within 14 days that are still scheduled
    const upcomingReviews = await db.query.annualReviews.findMany({
      where: and(
        eq(annualReviews.tpaOrgId, tenant.tpaOrgId),
        eq(annualReviews.status, 'scheduled'),
        between(annualReviews.scheduledDate, now, fourteenDaysOut),
      ),
      with: {
        person: { columns: { id: true, firstName: true, lastName: true } },
        clientOrg: { columns: { id: true, name: true } },
      },
    });

    if (upcomingReviews.length === 0) continue;

    // Find TPA staff to notify
    const staffUsers = await db.query.users.findMany({
      where: or(eq(users.role, 'tpa_staff'), eq(users.role, 'tpa_admin')),
    });

    const branding = await getTpaBranding(tenant.tpaOrgId, 'general');

    for (const review of upcomingReviews) {
      const personName = `${review.person.firstName} ${review.person.lastName}`;
      const reviewDate = review.scheduledDate.toLocaleDateString();

      // In-app notifications
      for (const user of staffUsers) {
        await createNotification({
          userId: user.id,
          type: 'general',
          title: `Annual Review Due — ${personName}`,
          message: `Annual review for ${personName} is scheduled for ${reviewDate}${review.clientOrg ? ` (${review.clientOrg.name})` : ''}`,
          tpaOrgId: tenant.tpaOrgId,
        });
      }

      // Email to first staff member with an email
      const recipient = staffUsers.find(u => u.email);
      if (recipient) {
        await sendAnnualReviewReminder({
          tpaOrgId: tenant.tpaOrgId,
          personName,
          reviewDate,
          recipientEmail: recipient.email,
          branding,
        }).catch(err => console.error('[dqf-annual-review-reminder] Email failed:', err));
      }

      totalProcessed++;
    }
  }

  console.log(`[dqf-annual-review-reminder] Processed ${totalProcessed} upcoming reviews`);
}
