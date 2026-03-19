import { Job } from 'bullmq';
import { db } from '@/db/client';
import { leads } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';

export interface LeadFollowUpReminderData {
  leadId: string;
  tpaOrgId: string;
}

/**
 * Fires when leads.nextFollowUpAt is reached.
 * Sends in-app notification to leads.ownedBy user: "Follow up with [Company]"
 */
export async function handleLeadFollowUpReminder(job: Job<LeadFollowUpReminderData>) {
  const { leadId, tpaOrgId } = job.data;

  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });

  if (!lead || !lead.ownedBy) return;

  // Check if lead is still in an active stage
  if (lead.stage === 'closed_won' || lead.stage === 'closed_lost') return;

  await createNotification({
    userId: lead.ownedBy,
    type: 'general',
    title: `Follow Up — ${lead.companyName}`,
    message: `Scheduled follow-up with ${lead.companyName}${lead.contactName ? ` (${lead.contactName})` : ''}`,
    tpaOrgId,
  });

  console.log(`[lead-followup-reminder] Notified for lead ${lead.companyName}`);
}
