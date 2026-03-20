import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { clientChecklistTemplates, organizations } from '@/db/schema';
import { withTpaAuth, withAdminAuth } from '@/auth/api-middleware';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { SERVICE_TYPE_CHECKLISTS } from '@/lib/service-templates';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/clients/[id]/checklist-templates — list all templates for a client
// ============================================================================

export const GET = withTpaAuth(async (req, user) => {
  const id = req.url.split('/clients/')[1].split('/checklist-templates')[0];
  const tpaOrgId = user.tpaOrgId;

  // Verify client belongs to this TPA
  const clientOrg = await db.query.organizations.findFirst({
    where: tpaOrgId
      ? and(eq(organizations.id, id), eq(organizations.tpaOrgId, tpaOrgId))
      : eq(organizations.id, id),
  });

  if (!clientOrg || clientOrg.type !== 'client') {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const templates = await db.query.clientChecklistTemplates.findMany({
    where: eq(clientChecklistTemplates.clientOrgId, id),
  });

  // Build response with defaults for comparison
  const serviceTypes = Object.keys(SERVICE_TYPE_CHECKLISTS);
  const templateMap = new Map(templates.map(t => [t.serviceType, t]));

  const result = serviceTypes.map(serviceType => ({
    serviceType,
    defaultItems: SERVICE_TYPE_CHECKLISTS[serviceType] || [],
    customTemplate: templateMap.get(serviceType) || null,
    isCustom: templateMap.has(serviceType) && templateMap.get(serviceType)!.isActive,
  }));

  return NextResponse.json({ templates: result, rawTemplates: templates });
});

// ============================================================================
// POST /api/clients/[id]/checklist-templates — create or update template
// ============================================================================

const createTemplateSchema = z.object({
  serviceType: z.string().min(1, 'Service type is required'),
  items: z.array(z.string().min(1)).min(1, 'At least one checklist item is required'),
});

export const POST = withAdminAuth(async (req, user) => {
  const id = req.url.split('/clients/')[1].split('/checklist-templates')[0];
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  // Verify client belongs to this TPA
  const clientOrg = await db.query.organizations.findFirst({
    where: and(eq(organizations.id, id), eq(organizations.tpaOrgId, tpaOrgId)),
  });

  if (!clientOrg || clientOrg.type !== 'client') {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = createTemplateSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const { serviceType, items } = validation.data;

  // Check if a template already exists for this client + serviceType
  const existing = await db.query.clientChecklistTemplates.findFirst({
    where: and(
      eq(clientChecklistTemplates.clientOrgId, id),
      eq(clientChecklistTemplates.serviceType, serviceType),
    ),
  });

  let template;
  if (existing) {
    // Update existing
    [template] = await db.update(clientChecklistTemplates)
      .set({ items, isActive: true, updatedAt: new Date() })
      .where(eq(clientChecklistTemplates.id, existing.id))
      .returning();
  } else {
    // Create new
    [template] = await db.insert(clientChecklistTemplates).values({
      tpaOrgId,
      clientOrgId: id,
      serviceType,
      items,
    }).returning();
  }

  return NextResponse.json(
    { template, message: existing ? 'Template updated' : 'Template created' },
    { status: existing ? 200 : 201 }
  );
});
