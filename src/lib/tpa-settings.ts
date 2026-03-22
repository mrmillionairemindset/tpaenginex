import { db } from '@/db';
import { tpaSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';

const AUTOMATION_DEFAULTS = {
  enableSheetsSync: false,
  enableKitReminders: true,
  enableCollectorConfirmReminders: true,
  enableResultsPendingDaily: true,
  enableOrderCompletionEmail: true,
  enableEventCompletionEmail: true,
  enableLeadStageEmails: false,
  enableLeadFollowUpReminders: true,
} as const;

export type AutomationSettings = typeof AUTOMATION_DEFAULTS;

export async function getTpaAutomationSettings(tpaOrgId: string): Promise<AutomationSettings> {
  const settings = await db.query.tpaSettings.findFirst({
    where: eq(tpaSettings.tpaOrgId, tpaOrgId),
    columns: {
      enableSheetsSync: true,
      enableKitReminders: true,
      enableCollectorConfirmReminders: true,
      enableResultsPendingDaily: true,
      enableOrderCompletionEmail: true,
      enableEventCompletionEmail: true,
      enableLeadStageEmails: true,
      enableLeadFollowUpReminders: true,
    },
  });

  return settings ?? { ...AUTOMATION_DEFAULTS };
}

export async function getTpaBranding(tpaOrgId: string) {
  const settings = await db.query.tpaSettings.findFirst({
    where: eq(tpaSettings.tpaOrgId, tpaOrgId),
    columns: {
      brandName: true,
      replyToEmail: true,
    },
  });

  return settings ?? { brandName: null, replyToEmail: null };
}
