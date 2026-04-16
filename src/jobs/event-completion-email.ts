import { Job } from 'bullmq';
import { db } from '@/db/client';
import { events } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';
import { sendEventCompletionEmail } from '@/lib/email';
import { getTpaAutomationSettings, getTpaBranding } from '@/lib/tpa-settings';

export interface EventCompletionEmailData {
  eventId: string;
  tpaOrgId: string;
}

/**
 * Fires when event status → complete.
 * Sends summary email to client: X done, X pending, timeline.
 */
export async function handleEventCompletionEmail(job: Job<EventCompletionEmailData>) {
  const { eventId, tpaOrgId } = job.data;

  const settings = await getTpaAutomationSettings(tpaOrgId);
  if (!settings.enableEventCompletionEmail) {
    console.log(`[event-completion-email] Disabled for TPA ${tpaOrgId} — skipping`);
    return;
  }

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      clientOrg: {
        with: {
          users: true,
        },
      },
    },
  });

  if (!event || !event.clientOrg) return;

  const branding = await getTpaBranding(tpaOrgId, 'orders');
  const clientAdmins = event.clientOrg.users.filter(u => u.role === 'client_admin');

  for (const admin of clientAdmins) {
    await createNotification({
      userId: admin.id,
      type: 'order_completed_client',
      title: `Event Complete — ${event.eventNumber}`,
      message: `Collection event for ${event.clientOrg.name} is complete. ${event.totalCompleted} completed, ${event.totalPending} pending.`,
      tpaOrgId,
    });

    await sendEventCompletionEmail({
      to: admin.email,
      eventNumber: event.eventNumber,
      clientName: event.clientOrg.name,
      totalDone: event.totalCompleted,
      totalPending: event.totalPending,
      eventDate: event.scheduledDate.toLocaleDateString(),
      branding,
    }).catch(err => console.error('[event-completion-email] Email failed:', err));
  }

  console.log(`[event-completion-email] Processed for event ${event.eventNumber}`);
}
