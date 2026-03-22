import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { tpaSettings } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const AUTOMATION_FIELDS = [
  'enableSheetsSync',
  'enableKitReminders',
  'enableCollectorConfirmReminders',
  'enableResultsPendingDaily',
  'enableOrderCompletionEmail',
  'enableEventCompletionEmail',
  'enableLeadStageEmails',
  'enableLeadFollowUpReminders',
] as const;

// GET /api/tpa-settings — returns automation settings for the current TPA
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const settings = await db.query.tpaSettings.findFirst({
    where: eq(tpaSettings.tpaOrgId, tpaOrgId),
  });

  if (!settings) {
    return NextResponse.json({ error: 'TPA settings not found' }, { status: 404 });
  }

  return NextResponse.json({ settings });
}

// PATCH /api/tpa-settings — update automation toggles
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const body = await req.json();

  // Build update object with explicit column references
  const updateData: Partial<typeof tpaSettings.$inferInsert> = {
    updatedAt: new Date(),
  };
  let hasChanges = false;

  if (typeof body.enableSheetsSync === 'boolean') {
    updateData.enableSheetsSync = body.enableSheetsSync;
    hasChanges = true;
  }
  if (typeof body.enableKitReminders === 'boolean') {
    updateData.enableKitReminders = body.enableKitReminders;
    hasChanges = true;
  }
  if (typeof body.enableCollectorConfirmReminders === 'boolean') {
    updateData.enableCollectorConfirmReminders = body.enableCollectorConfirmReminders;
    hasChanges = true;
  }
  if (typeof body.enableResultsPendingDaily === 'boolean') {
    updateData.enableResultsPendingDaily = body.enableResultsPendingDaily;
    hasChanges = true;
  }
  if (typeof body.enableOrderCompletionEmail === 'boolean') {
    updateData.enableOrderCompletionEmail = body.enableOrderCompletionEmail;
    hasChanges = true;
  }
  if (typeof body.enableEventCompletionEmail === 'boolean') {
    updateData.enableEventCompletionEmail = body.enableEventCompletionEmail;
    hasChanges = true;
  }
  if (typeof body.enableLeadStageEmails === 'boolean') {
    updateData.enableLeadStageEmails = body.enableLeadStageEmails;
    hasChanges = true;
  }
  if (typeof body.enableLeadFollowUpReminders === 'boolean') {
    updateData.enableLeadFollowUpReminders = body.enableLeadFollowUpReminders;
    hasChanges = true;
  }

  // Reply-to email fields (per category)
  const emailFields = ['replyToEmail', 'replyToOrders', 'replyToBilling', 'replyToLeads'] as const;
  for (const field of emailFields) {
    if (body[field] !== undefined) {
      (updateData as any)[field] = body[field] || null;
      hasChanges = true;
    }
  }

  // Pricing fields
  if (body.defaultServiceRates !== undefined && typeof body.defaultServiceRates === 'object') {
    updateData.defaultServiceRates = body.defaultServiceRates;
    hasChanges = true;
  }
  if (typeof body.dotSurchargeRate === 'number') {
    updateData.dotSurchargeRate = body.dotSurchargeRate;
    hasChanges = true;
  }
  if (typeof body.defaultPaymentTermDays === 'number') {
    updateData.defaultPaymentTermDays = body.defaultPaymentTermDays;
    hasChanges = true;
  }

  if (!hasChanges) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  await db.update(tpaSettings).set(updateData).where(eq(tpaSettings.tpaOrgId, tpaOrgId));

  const updated = await db.query.tpaSettings.findFirst({
    where: eq(tpaSettings.tpaOrgId, tpaOrgId),
  });

  return NextResponse.json({ settings: updated, message: 'Automation settings updated' });
}
