import { db } from '@/db/client';
import { emailTemplates } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

/**
 * Get a custom template for a TPA, or null if not set.
 * Template variables use {{varName}} syntax — e.g., {{personName}}, {{orderNumber}}
 */
export async function getEmailTemplate(
  tpaOrgId: string,
  templateKey: string,
): Promise<{ subject: string; bodyHtml: string } | null> {
  const template = await db.query.emailTemplates.findFirst({
    where: and(
      eq(emailTemplates.tpaOrgId, tpaOrgId),
      eq(emailTemplates.templateKey, templateKey),
      eq(emailTemplates.isEnabled, true),
    ),
  });
  if (!template || !template.subject || !template.bodyHtml) return null;
  return { subject: template.subject, bodyHtml: template.bodyHtml };
}

/**
 * Simple variable interpolation: replaces {{key}} with value from vars map.
 */
export function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}
