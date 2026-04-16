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

export type AutomationSettings = { -readonly [K in keyof typeof AUTOMATION_DEFAULTS]: boolean };

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

export type EmailCategory = 'orders' | 'billing' | 'leads' | 'general';

export async function getTpaBranding(tpaOrgId: string, category: EmailCategory = 'general') {
  const settings = await db.query.tpaSettings.findFirst({
    where: eq(tpaSettings.tpaOrgId, tpaOrgId),
    columns: {
      brandName: true,
      replyToEmail: true,
      replyToOrders: true,
      replyToBilling: true,
      replyToLeads: true,
    },
  });

  if (!settings) return { brandName: null, replyToEmail: null };

  // Use category-specific email, fall back to general replyToEmail
  const categoryEmailMap: Record<EmailCategory, string | null | undefined> = {
    orders: settings.replyToOrders,
    billing: settings.replyToBilling,
    leads: settings.replyToLeads,
    general: settings.replyToEmail,
  };

  return {
    brandName: settings.brandName,
    replyToEmail: categoryEmailMap[category] || settings.replyToEmail,
  };
}
