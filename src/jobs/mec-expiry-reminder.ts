import { Job } from 'bullmq';
import { db } from '@/db/client';
import {
  physicalExams,
  notifications,
  tenantModules,
  users,
} from '@/db/schema';
import { and, between, eq, gte, or } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';
import { sendMecExpiryReminder } from '@/lib/email';
import { getTpaBranding } from '@/lib/tpa-settings';
import { enqueueWebhookEvent } from '@/lib/webhooks';

export interface MecExpiryReminderData {
  tpaOrgId?: string;
}

/**
 * Runs daily. Finds DOT Medical Examiner's Certificates expiring in ~90 days
 * (85–95 day window) and sends reminders to TPA staff and the driver's client
 * admin so they can schedule the next physical in time.
 *
 * Deduplication: Before sending we check if a recent notification exists with
 * the same title (includes the driver name) for each recipient, avoiding
 * duplicate reminders if the job runs more than once inside the window.
 */
export async function handleMecExpiryReminder(job: Job<MecExpiryReminderData>) {
  const { tpaOrgId } = job.data;

  const enabledTenants = await db.query.tenantModules.findMany({
    where: and(
      eq(tenantModules.moduleId, 'occupational_health'),
      eq(tenantModules.isEnabled, true),
      ...(tpaOrgId ? [eq(tenantModules.tpaOrgId, tpaOrgId)] : []),
    ),
  });

  if (enabledTenants.length === 0) {
    console.log('[mec-expiry-reminder] No tenants with Occupational Health enabled — skipping');
    return;
  }

  const now = new Date();
  const startWindow = new Date(now.getTime() + 85 * 24 * 60 * 60 * 1000);
  const endWindow = new Date(now.getTime() + 95 * 24 * 60 * 60 * 1000);

  let processed = 0;

  for (const tenant of enabledTenants) {
    const exams = await db.query.physicalExams.findMany({
      where: and(
        eq(physicalExams.tpaOrgId, tenant.tpaOrgId),
        eq(physicalExams.status, 'completed'),
        between(physicalExams.mecExpiresOn, startWindow, endWindow),
      ),
      with: {
        person: { columns: { id: true, firstName: true, lastName: true, email: true } },
        clientOrg: { columns: { id: true, name: true } },
      },
    });

    if (exams.length === 0) continue;

    // Find recipients once per tenant
    const staffRows = await db.query.users.findMany({
      where: and(
        eq(users.orgId, tenant.tpaOrgId),
        or(eq(users.role, 'tpa_admin'), eq(users.role, 'tpa_staff'), eq(users.role, 'tpa_records')),
      ),
    });

    const branding = await getTpaBranding(tenant.tpaOrgId, 'general');

    for (const exam of exams) {
      const driverName = `${exam.person.firstName} ${exam.person.lastName}`;
      const expiresOn = exam.mecExpiresOn!;
      const daysUntil = Math.max(
        0,
        Math.ceil((expiresOn.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      );
      const title = `MEC Expiring — ${driverName}`;
      const message = `Medical certificate for ${driverName} expires on ${expiresOn.toLocaleDateString()} (${daysUntil} days).`;

      // Check for existing notification to dedup
      const earliestToCheck = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const existing = await db.query.notifications.findMany({
        where: and(
          eq(notifications.tpaOrgId, tenant.tpaOrgId),
          eq(notifications.title, title),
          gte(notifications.createdAt, earliestToCheck),
        ),
      });
      const alreadyNotified = new Set(existing.map((n) => n.userId));

      for (const staffUser of staffRows) {
        if (alreadyNotified.has(staffUser.id)) continue;
        await createNotification({
          userId: staffUser.id,
          tpaOrgId: tenant.tpaOrgId,
          type: 'general',
          title,
          message,
        });
      }

      // Emails to TPA staff recipients
      const emailRecipients = staffRows
        .filter((u) => u.email && !alreadyNotified.has(u.id))
        .map((u) => ({ email: u.email, name: u.name }));

      for (const recipient of emailRecipients) {
        await sendMecExpiryReminder({
          tpaOrgId: tenant.tpaOrgId,
          recipientEmail: recipient.email,
          recipientName: recipient.name || undefined,
          driverName,
          expiresOn: expiresOn.toLocaleDateString(),
          daysUntil,
          branding,
        }).catch((err) => console.error('[mec-expiry-reminder] Email to staff failed:', err));
      }

      // Notify the client admin users for the client org if present
      if (exam.clientOrgId) {
        const clientAdmins = await db.query.users.findMany({
          where: and(eq(users.orgId, exam.clientOrgId), eq(users.role, 'client_admin')),
        });

        for (const admin of clientAdmins) {
          if (alreadyNotified.has(admin.id)) continue;
          await createNotification({
            userId: admin.id,
            tpaOrgId: tenant.tpaOrgId,
            type: 'general',
            title,
            message,
          });

          if (admin.email) {
            await sendMecExpiryReminder({
              tpaOrgId: tenant.tpaOrgId,
              recipientEmail: admin.email,
              recipientName: admin.name || undefined,
              driverName,
              expiresOn: expiresOn.toLocaleDateString(),
              daysUntil,
              branding,
            }).catch((err) => console.error('[mec-expiry-reminder] Email to client failed:', err));
          }
        }
      }

      // Webhook so external integrations can react (e.g., schedule a new exam)
      await enqueueWebhookEvent({
        tpaOrgId: tenant.tpaOrgId,
        event: 'physical.mec_expiring',
        payload: {
          examId: exam.id,
          personId: exam.personId,
          driverName,
          certificateNumber: exam.certificateNumber,
          mecExpiresOn: expiresOn.toISOString(),
          daysUntil,
        },
      }).catch((err) => console.error('[mec-expiry-reminder] Webhook enqueue failed:', err));

      processed++;
    }
  }

  console.log(`[mec-expiry-reminder] Processed ${processed} expiring MECs`);
}
