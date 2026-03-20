import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leadEmailTemplates } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateTemplateSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  body: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  delayMinutes: z.number().int().min(0).optional(),
});

// PATCH /api/leads/templates/[id] — update a template
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const { id } = params;

  // Verify template belongs to this TPA
  const existing = await db.query.leadEmailTemplates.findFirst({
    where: and(
      eq(leadEmailTemplates.id, id),
      eq(leadEmailTemplates.tpaOrgId, user.tpaOrgId),
    ),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = updateTemplateSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (data.subject !== undefined) updateData.subject = data.subject;
  if (data.body !== undefined) updateData.body = data.body;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.delayMinutes !== undefined) updateData.delayMinutes = data.delayMinutes;

  const [updated] = await db.update(leadEmailTemplates)
    .set(updateData)
    .where(eq(leadEmailTemplates.id, id))
    .returning();

  return NextResponse.json({ template: updated, message: 'Template updated' });
}
