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

  // Only allow updating automation toggle fields
  const updateData: Record<string, boolean> = {};
  for (const field of AUTOMATION_FIELDS) {
    if (typeof body[field] === 'boolean') {
      updateData[field] = body[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  await db.update(tpaSettings).set({
    ...updateData,
    updatedAt: new Date(),
  }).where(eq(tpaSettings.tpaOrgId, tpaOrgId));

  const updated = await db.query.tpaSettings.findFirst({
    where: eq(tpaSettings.tpaOrgId, tpaOrgId),
  });

  return NextResponse.json({ settings: updated, message: 'Automation settings updated' });
}
