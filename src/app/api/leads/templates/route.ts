import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leadEmailTemplates } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createTemplateSchema = z.object({
  stage: z.enum(['new_lead', 'outreach_sent', 'proposal_sent', 'follow_up', 'contract_sent', 'closed_won', 'closed_lost']),
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  delayMinutes: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

// GET /api/leads/templates — list all templates for this TPA
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'No TPA organization' }, { status: 403 });
  }

  const templates = await db.query.leadEmailTemplates.findMany({
    where: eq(leadEmailTemplates.tpaOrgId, user.tpaOrgId),
  });

  return NextResponse.json({ templates });
}

// POST /api/leads/templates — create a template
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Forbidden: tpa_admin required' }, { status: 403 });
  }

  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'No TPA organization' }, { status: 403 });
  }

  const body = await req.json();
  const validation = createTemplateSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  const [template] = await db.insert(leadEmailTemplates).values({
    tpaOrgId: user.tpaOrgId,
    stage: data.stage,
    subject: data.subject,
    body: data.body,
    delayMinutes: data.delayMinutes,
    isActive: data.isActive,
  }).returning();

  return NextResponse.json({ template, message: 'Template created' }, { status: 201 });
}
