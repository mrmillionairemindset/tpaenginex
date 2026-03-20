import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { clientChecklistTemplates, organizations } from '@/db/schema';
import { withAdminAuth } from '@/auth/api-middleware';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ============================================================================
// PATCH /api/clients/[id]/checklist-templates/[templateId] — update template
// ============================================================================

const patchSchema = z.object({
  items: z.array(z.string().min(1)).min(1).optional(),
  isActive: z.boolean().optional(),
});

export const PATCH = withAdminAuth(async (req, user) => {
  const urlParts = req.url.split('/clients/')[1].split('/checklist-templates/');
  const clientId = urlParts[0];
  const templateId = urlParts[1].split('?')[0];
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  // Verify client belongs to this TPA
  const clientOrg = await db.query.organizations.findFirst({
    where: and(eq(organizations.id, clientId), eq(organizations.tpaOrgId, tpaOrgId)),
  });

  if (!clientOrg || clientOrg.type !== 'client') {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // Verify template exists and belongs to this client
  const existing = await db.query.clientChecklistTemplates.findFirst({
    where: and(
      eq(clientChecklistTemplates.id, templateId),
      eq(clientChecklistTemplates.clientOrgId, clientId),
    ),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = patchSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const updates: Record<string, any> = { updatedAt: new Date() };
  if (validation.data.items !== undefined) updates.items = validation.data.items;
  if (validation.data.isActive !== undefined) updates.isActive = validation.data.isActive;

  const [updated] = await db.update(clientChecklistTemplates)
    .set(updates)
    .where(eq(clientChecklistTemplates.id, templateId))
    .returning();

  return NextResponse.json({ template: updated });
});

// ============================================================================
// DELETE /api/clients/[id]/checklist-templates/[templateId] — remove template
// ============================================================================

export const DELETE = withAdminAuth(async (req, user) => {
  const urlParts = req.url.split('/clients/')[1].split('/checklist-templates/');
  const clientId = urlParts[0];
  const templateId = urlParts[1].split('?')[0];
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  // Verify client belongs to this TPA
  const clientOrg = await db.query.organizations.findFirst({
    where: and(eq(organizations.id, clientId), eq(organizations.tpaOrgId, tpaOrgId)),
  });

  if (!clientOrg || clientOrg.type !== 'client') {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // Verify template exists
  const existing = await db.query.clientChecklistTemplates.findFirst({
    where: and(
      eq(clientChecklistTemplates.id, templateId),
      eq(clientChecklistTemplates.clientOrgId, clientId),
    ),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  }

  await db.delete(clientChecklistTemplates)
    .where(eq(clientChecklistTemplates.id, templateId));

  return NextResponse.json({ message: 'Template deleted, will fall back to default checklist' });
});
