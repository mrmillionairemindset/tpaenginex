import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leads } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { enqueueNotification } from '@/jobs/queue';

export const dynamic = 'force-dynamic';

const updateLeadSchema = z.object({
  stage: z.enum(['new_lead', 'outreach_sent', 'proposal_sent', 'follow_up', 'contract_sent', 'closed_won', 'closed_lost']).optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
  estimatedValue: z.number().int().optional(),
  lastContactedAt: z.string().datetime().optional(),
  nextFollowUpAt: z.string().datetime().optional(),
  ownedBy: z.string().uuid().optional(),
});

// GET /api/leads/[id] — single lead
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  const lead = await db.query.leads.findFirst({
    where: tpaOrgId
      ? and(eq(leads.id, id), eq(leads.tpaOrgId, tpaOrgId))
      : eq(leads.id, id),
    with: {
      owner: { columns: { id: true, name: true, email: true } },
      convertedOrg: { columns: { id: true, name: true, slug: true } },
    },
  });

  if (!lead) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  return NextResponse.json({ lead });
}

// PATCH /api/leads/[id] — update lead
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  const existing = await db.query.leads.findFirst({
    where: tpaOrgId
      ? and(eq(leads.id, id), eq(leads.tpaOrgId, tpaOrgId))
      : eq(leads.id, id),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = updateLeadSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (data.stage !== undefined) updateData.stage = data.stage;
  if (data.contactName !== undefined) updateData.contactName = data.contactName;
  if (data.contactEmail !== undefined) updateData.contactEmail = data.contactEmail;
  if (data.contactPhone !== undefined) updateData.contactPhone = data.contactPhone;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.estimatedValue !== undefined) updateData.estimatedValue = data.estimatedValue;
  if (data.lastContactedAt !== undefined) updateData.lastContactedAt = new Date(data.lastContactedAt);
  if (data.nextFollowUpAt !== undefined) updateData.nextFollowUpAt = new Date(data.nextFollowUpAt);
  if (data.ownedBy !== undefined) updateData.ownedBy = data.ownedBy;

  await db.update(leads).set(updateData).where(eq(leads.id, id));

  // Trigger stage automation if stage changed
  if (data.stage && data.stage !== existing.stage && existing.tpaOrgId) {
    await enqueueNotification('lead_stage_automation', {
      leadId: id,
      tpaOrgId: existing.tpaOrgId,
      fromStage: existing.stage,
      toStage: data.stage,
      changedBy: user.id,
    });
  }

  const updated = await db.query.leads.findFirst({
    where: eq(leads.id, id),
    with: {
      owner: { columns: { id: true, name: true, email: true } },
      convertedOrg: { columns: { id: true, name: true, slug: true } },
    },
  });

  return NextResponse.json({ lead: updated, message: 'Lead updated successfully' });
}
