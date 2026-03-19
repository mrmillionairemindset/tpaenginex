import { Job } from 'bullmq';
import { db } from '@/db/client';
import { events, users } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';
import { sendKitMailingReminder } from '@/lib/email';

export interface KitMailingReminderData {
  eventId: string;
  tpaOrgId: string;
}

/**
 * Fires 48 hours before event.scheduledDate.
 * Sends email + in-app notification to TPA staff: "Mail collection kits for [Event]"
 */
export async function handleKitMailingReminder(job: Job<KitMailingReminderData>) {
  const { eventId, tpaOrgId } = job.data;

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      clientOrg: { columns: { id: true, name: true } },
    },
  });

  if (!event || event.status === 'cancelled') return;

  // Find TPA staff to notify
  const staffUsers = await db.query.users.findMany({
    where: or(eq(users.role, 'tpa_staff'), eq(users.role, 'tpa_admin')),
  });

  for (const user of staffUsers) {
    await createNotification({
      userId: user.id,
      type: 'kit_reminder',
      title: `Mail Kits — ${event.clientOrg.name}`,
      message: `Collection kits need to be mailed for event ${event.eventNumber} scheduled on ${event.scheduledDate.toLocaleDateString()}`,
      tpaOrgId,
    });
  }

  // Send email to first staff member with an email
  const recipient = staffUsers.find(u => u.email);
  if (recipient) {
    await sendKitMailingReminder({
      to: recipient.email,
      eventNumber: event.eventNumber,
      clientName: event.clientOrg.name,
      scheduledDate: event.scheduledDate.toLocaleDateString(),
      location: event.location,
    }).catch(err => console.error('[kit-mailing-reminder] Email failed:', err));
  }

  console.log(`[kit-mailing-reminder] Processed for event ${event.eventNumber}`);
}
