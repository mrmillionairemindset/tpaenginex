import { Job } from 'bullmq';
import { db } from '@/db/client';
import { events, users } from '@/db/schema';
import { eq, and, gt, or, lte } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';
import { sendPendingResultsReminder } from '@/lib/email';
import { getTpaAutomationSettings, getTpaBranding } from '@/lib/tpa-settings';

/**
 * Runs daily at 9am. For each event with totalPending > 0 and
 * pendingFollowUpUntil not yet passed, sends reminder to TPA records staff.
 * Auto-cancels when totalPending hits 0.
 */
export async function handleResultsPendingDaily(job: Job) {
  const now = new Date();

  // Find events with pending results that still need follow-up
  const pendingEvents = await db.query.events.findMany({
    where: and(
      gt(events.totalPending, 0),
      // pendingFollowUpUntil is either null (always follow up) or in the future
    ),
    with: {
      clientOrg: { columns: { id: true, name: true } },
    },
  });

  const activeEvents = pendingEvents.filter(e => {
    if (!e.pendingFollowUpUntil) return true;
    return new Date(e.pendingFollowUpUntil) > now;
  });

  if (activeEvents.length === 0) {
    console.log('[results-pending-daily] No pending events to follow up on');
    return;
  }

  // Find TPA records staff
  const recordsStaff = await db.query.users.findMany({
    where: or(eq(users.role, 'tpa_records'), eq(users.role, 'tpa_admin')),
  });

  // Batch-fetch automation settings for all distinct TPAs
  const tpaOrgIds = [...new Set(activeEvents.map(e => e.tpaOrgId))];
  const settingsMap = new Map<string, Awaited<ReturnType<typeof getTpaAutomationSettings>>>();
  await Promise.all(
    tpaOrgIds.map(async (id) => {
      settingsMap.set(id, await getTpaAutomationSettings(id));
    })
  );

  for (const event of activeEvents) {
    const settings = settingsMap.get(event.tpaOrgId);
    if (!settings?.enableResultsPendingDaily) {
      console.log(`[results-pending-daily] Disabled for TPA ${event.tpaOrgId} — skipping event ${event.eventNumber}`);
      continue;
    }

    const daysSinceEvent = Math.floor(
      (now.getTime() - new Date(event.scheduledDate).getTime()) / (1000 * 60 * 60 * 24)
    );

    // In-app notification
    for (const user of recordsStaff) {
      await createNotification({
        userId: user.id,
        type: 'results_pending_followup',
        title: `${event.totalPending} Results Pending — ${event.eventNumber}`,
        message: `${event.totalPending} results still pending for ${event.clientOrg.name} (${daysSinceEvent} days since collection)`,
        tpaOrgId: event.tpaOrgId,
      });
    }

    // Email to first records staff
    const branding = await getTpaBranding(event.tpaOrgId);
    const recipient = recordsStaff.find(u => u.email);
    if (recipient) {
      await sendPendingResultsReminder({
        to: recipient.email,
        eventNumber: event.eventNumber,
        pendingCount: event.totalPending,
        daysSinceEvent,
        branding,
      }).catch(err => console.error('[results-pending-daily] Email failed:', err));
    }
  }

  console.log(`[results-pending-daily] Processed ${activeEvents.length} events`);
}
