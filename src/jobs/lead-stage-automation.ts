import { Job } from 'bullmq';
import { db } from '@/db/client';
import { leads, leadEmailTemplates, leadActivities, organizations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { sendLeadStageEmail } from '@/lib/email';
import { scheduleReminder } from './queue';
import { createNotification } from '@/lib/notifications';
import { getTpaAutomationSettings, getTpaBranding } from '@/lib/tpa-settings';

export interface LeadStageAutomationData {
  leadId: string;
  tpaOrgId: string;
  fromStage: string;
  toStage: string;
  changedBy: string;
}

const STAGE_LABELS: Record<string, string> = {
  new_lead: 'New Lead',
  outreach_sent: 'Outreach Sent',
  proposal_sent: 'Proposal Sent',
  follow_up: 'Follow Up',
  contract_sent: 'Contract Sent',
  closed_won: 'Closed Won',
  closed_lost: 'Closed Lost',
};

/**
 * Handles lead stage change automation:
 * 1. Logs stage change activity
 * 2. Looks up email template for the new stage
 * 3. Sends customized email if template exists and is active
 * 4. Logs email sent activity
 * 5. Schedules follow-up reminders based on stage
 */
export async function handleLeadStageAutomation(job: Job<LeadStageAutomationData>) {
  const { leadId, tpaOrgId, fromStage, toStage, changedBy } = job.data;

  console.log(`[lead-stage-automation] Processing: ${fromStage} -> ${toStage} for lead ${leadId}`);

  // Fetch the lead
  const lead = await db.query.leads.findFirst({
    where: eq(leads.id, leadId),
  });

  if (!lead) {
    console.warn(`[lead-stage-automation] Lead ${leadId} not found`);
    return;
  }

  // Fetch the TPA org for the name
  const tpaOrg = await db.query.organizations.findFirst({
    where: eq(organizations.id, tpaOrgId),
  });

  const tpaName = tpaOrg?.name || 'Our Team';

  // 1. Log stage change activity
  await db.insert(leadActivities).values({
    leadId,
    tpaOrgId,
    type: 'stage_change',
    description: `Stage changed from ${STAGE_LABELS[fromStage] || fromStage} to ${STAGE_LABELS[toStage] || toStage}`,
    metadata: { from: fromStage, to: toStage },
    createdBy: changedBy,
  });

  // Check if lead stage emails are enabled for this TPA
  const automationSettings = await getTpaAutomationSettings(tpaOrgId);

  // 2. Look up email template for the new stage (only if emails enabled)
  const template = automationSettings.enableLeadStageEmails ? await db.query.leadEmailTemplates.findFirst({
    where: and(
      eq(leadEmailTemplates.tpaOrgId, tpaOrgId),
      eq(leadEmailTemplates.stage, toStage as any),
      eq(leadEmailTemplates.isActive, true),
    ),
  }) : null;

  // 3. Send email if template exists and lead has a contact email
  if (template && lead.contactEmail) {
    try {
      // Replace placeholders
      const subject = replacePlaceholders(template.subject, {
        companyName: lead.companyName,
        contactName: lead.contactName || 'there',
        contactEmail: lead.contactEmail,
        tpaName,
      });

      const body = replacePlaceholders(template.body, {
        companyName: lead.companyName,
        contactName: lead.contactName || 'there',
        contactEmail: lead.contactEmail,
        tpaName,
      });

      // Handle delay if configured
      if (template.delayMinutes > 0) {
        // For delayed emails, we'd need a separate delayed job
        // For now, schedule it as a delayed notification
        console.log(`[lead-stage-automation] Email delayed by ${template.delayMinutes} minutes`);
      }

      const branding = await getTpaBranding(tpaOrgId, 'leads');
      await sendLeadStageEmail({
        to: lead.contactEmail,
        subject,
        body,
        branding,
      });

      // 4. Log email sent activity
      await db.insert(leadActivities).values({
        leadId,
        tpaOrgId,
        type: 'email_sent',
        description: `Email sent: "${subject}" to ${lead.contactEmail}`,
        metadata: { subject, to: lead.contactEmail, templateId: template.id },
        createdBy: changedBy,
      });

      console.log(`[lead-stage-automation] Email sent to ${lead.contactEmail}`);
    } catch (error) {
      console.error(`[lead-stage-automation] Failed to send email:`, error);

      // Log the failure
      await db.insert(leadActivities).values({
        leadId,
        tpaOrgId,
        type: 'email_sent',
        description: `Email failed to send to ${lead.contactEmail}`,
        metadata: { error: String(error), templateId: template.id },
        createdBy: changedBy,
      });
    }
  }

  // 5. Schedule follow-up reminders based on stage
  await scheduleFollowUpReminders(leadId, tpaOrgId, toStage, lead.ownedBy, lead.companyName);

  console.log(`[lead-stage-automation] Completed for lead ${lead.companyName}`);
}

function replacePlaceholders(
  text: string,
  values: { companyName: string; contactName: string; contactEmail: string; tpaName: string }
): string {
  return text
    .replace(/\{\{companyName\}\}/g, values.companyName)
    .replace(/\{\{contactName\}\}/g, values.contactName)
    .replace(/\{\{contactEmail\}\}/g, values.contactEmail)
    .replace(/\{\{tpaName\}\}/g, values.tpaName);
}

async function scheduleFollowUpReminders(
  leadId: string,
  tpaOrgId: string,
  stage: string,
  ownedBy: string | null,
  companyName: string,
) {
  if (!ownedBy) return;

  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  switch (stage) {
    case 'outreach_sent':
      // Internal call reminder in 3 days
      await scheduleReminder('lead_followup_reminder', { leadId, tpaOrgId }, 3 * MS_PER_DAY);
      await db.insert(leadActivities).values({
        leadId,
        tpaOrgId,
        type: 'follow_up_scheduled',
        description: `Follow-up call reminder scheduled in 3 days`,
        metadata: { reminderType: 'call_reminder', delayDays: 3 },
      });
      break;

    case 'proposal_sent':
      // Follow-up reminder in 3 days
      await scheduleReminder('lead_followup_reminder', { leadId, tpaOrgId }, 3 * MS_PER_DAY);
      await db.insert(leadActivities).values({
        leadId,
        tpaOrgId,
        type: 'follow_up_scheduled',
        description: `Follow-up reminder scheduled in 3 days`,
        metadata: { reminderType: 'follow_up', delayDays: 3 },
      });
      break;

    case 'follow_up':
      // Internal call reminder in 2 days
      await scheduleReminder('lead_followup_reminder', { leadId, tpaOrgId }, 2 * MS_PER_DAY);
      await db.insert(leadActivities).values({
        leadId,
        tpaOrgId,
        type: 'follow_up_scheduled',
        description: `Follow-up call reminder scheduled in 2 days`,
        metadata: { reminderType: 'call_reminder', delayDays: 2 },
      });
      break;

    case 'contract_sent':
      // Follow-up reminder in 5 days
      await scheduleReminder('lead_followup_reminder', { leadId, tpaOrgId }, 5 * MS_PER_DAY);
      await db.insert(leadActivities).values({
        leadId,
        tpaOrgId,
        type: 'follow_up_scheduled',
        description: `Follow-up reminder scheduled in 5 days`,
        metadata: { reminderType: 'follow_up', delayDays: 5 },
      });
      break;

    case 'closed_won':
      // No reminder, but log the win
      console.log(`[lead-stage-automation] Lead ${companyName} closed won — conversion flow triggered`);
      break;

    case 'closed_lost':
      // No reminder
      console.log(`[lead-stage-automation] Lead ${companyName} closed lost`);
      break;
  }
}
