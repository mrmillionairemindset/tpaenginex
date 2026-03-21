import { Job } from 'bullmq';
import { db } from '@/db/client';
import { orders, events, collectors, users } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';
import { getTpaAutomationSettings } from '@/lib/tpa-settings';

export interface CollectorConfirmReminderData {
  orderId?: string;
  eventId?: string;
  collectorId: string;
  scheduledFor: string;
  tpaOrgId: string;
}

/**
 * Fires 48 hours before scheduledFor/scheduledDate.
 * Sends notification to TPA staff: "Reconfirm [Collector] for [Client] on [date]"
 */
export async function handleCollectorConfirmReminder(job: Job<CollectorConfirmReminderData>) {
  const { collectorId, scheduledFor, tpaOrgId } = job.data;

  const settings = await getTpaAutomationSettings(tpaOrgId);
  if (!settings.enableCollectorConfirmReminders) {
    console.log(`[collector-confirm-reminder] Disabled for TPA ${tpaOrgId} — skipping`);
    return;
  }

  const collector = await db.query.collectors.findFirst({
    where: eq(collectors.id, collectorId),
  });

  if (!collector) return;

  const collectorName = `${collector.firstName} ${collector.lastName}`;
  const dateStr = new Date(scheduledFor).toLocaleDateString();

  // Find TPA staff
  const staffUsers = await db.query.users.findMany({
    where: or(eq(users.role, 'tpa_staff'), eq(users.role, 'tpa_admin')),
  });

  for (const user of staffUsers) {
    await createNotification({
      userId: user.id,
      type: 'collector_confirm_reminder',
      title: `Reconfirm Collector — ${collectorName}`,
      message: `Please reconfirm ${collectorName} for collection on ${dateStr}`,
      tpaOrgId,
    });
  }

  console.log(`[collector-confirm-reminder] Processed for ${collectorName} on ${dateStr}`);
}
