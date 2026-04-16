import { Job } from 'bullmq';
import { db } from '@/db/client';
import { driverApplications, tenantModules, users } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';
import { sendTicketFormConfirmation } from '@/lib/email';
import { getTpaBranding } from '@/lib/tpa-settings';

export interface DqfTicketFormSubmissionNotifyData {
  applicationId: string;
  tpaOrgId: string;
}

/**
 * Called when a public ticket form is submitted.
 * Sends confirmation email to the applicant and creates in-app
 * notification for TPA staff.
 */
export async function handleDqfTicketFormSubmissionNotify(job: Job<DqfTicketFormSubmissionNotifyData>) {
  const { applicationId, tpaOrgId } = job.data;

  // Verify DQF module is enabled
  const module = await db.query.tenantModules.findFirst({
    where: and(
      eq(tenantModules.tpaOrgId, tpaOrgId),
      eq(tenantModules.moduleId, 'dqf'),
      eq(tenantModules.isEnabled, true),
    ),
  });

  if (!module) {
    console.log(`[dqf-ticket-form-submission-notify] DQF module not enabled for TPA ${tpaOrgId} — skipping`);
    return;
  }

  // Look up the application with person details
  const application = await db.query.driverApplications.findFirst({
    where: and(
      eq(driverApplications.id, applicationId),
      eq(driverApplications.tpaOrgId, tpaOrgId),
    ),
    with: {
      person: { columns: { id: true, firstName: true, lastName: true, email: true } },
      clientOrg: { columns: { id: true, name: true } },
    },
  });

  if (!application) {
    console.error(`[dqf-ticket-form-submission-notify] Application ${applicationId} not found`);
    return;
  }

  const branding = await getTpaBranding(tpaOrgId, 'general');
  const applicantName = `${application.person.firstName} ${application.person.lastName}`;

  // Send confirmation email to applicant
  if (application.person.email) {
    await sendTicketFormConfirmation({
      tpaOrgId,
      applicantName,
      applicantEmail: application.person.email,
      position: application.position || 'Driver',
      branding,
    }).catch(err => console.error('[dqf-ticket-form-submission-notify] Confirmation email failed:', err));
  }

  // Create in-app notification for TPA staff
  const staffUsers = await db.query.users.findMany({
    where: or(eq(users.role, 'tpa_staff'), eq(users.role, 'tpa_admin')),
  });

  for (const user of staffUsers) {
    await createNotification({
      userId: user.id,
      type: 'general',
      title: 'New Driver Application',
      message: `${applicantName} submitted a driver application${application.clientOrg ? ` for ${application.clientOrg.name}` : ''}${application.position ? ` — ${application.position}` : ''}`,
      tpaOrgId,
    });
  }

  console.log(`[dqf-ticket-form-submission-notify] Processed application ${applicationId} for ${applicantName}`);
}
