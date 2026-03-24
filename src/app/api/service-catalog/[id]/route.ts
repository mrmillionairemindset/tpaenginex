import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { serviceCatalog, reasonCatalog } from '@/db/schema';
import { withAdminAuth } from '@/auth/api-middleware';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  name: z.string().min(1).optional(),
}).refine((data) => data.isActive !== undefined || data.name !== undefined, {
  message: 'At least one field (isActive or name) must be provided',
});

// PATCH /api/service-catalog/[id] — update a service or reason catalog entry (tpa_admin only)
export const PATCH = withAdminAuth(async (req, user) => {
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const url = new URL(req.url);
  const id = url.pathname.split('/').pop();

  if (!id) {
    return NextResponse.json({ error: 'ID is required' }, { status: 400 });
  }

  const body = await req.json();
  const validation = updateSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 },
    );
  }

  const data = validation.data;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.isActive !== undefined) updates.isActive = data.isActive;
  if (data.name !== undefined) updates.name = data.name;

  // Try service_catalog first
  const existingService = await db.query.serviceCatalog.findFirst({
    where: and(
      eq(serviceCatalog.id, id),
      eq(serviceCatalog.tpaOrgId, tpaOrgId),
    ),
  });

  if (existingService) {
    const [updated] = await db
      .update(serviceCatalog)
      .set(updates)
      .where(and(
        eq(serviceCatalog.id, id),
        eq(serviceCatalog.tpaOrgId, tpaOrgId),
      ))
      .returning();

    return NextResponse.json({ item: updated, type: 'service' });
  }

  // Try reason_catalog
  const existingReason = await db.query.reasonCatalog.findFirst({
    where: and(
      eq(reasonCatalog.id, id),
      eq(reasonCatalog.tpaOrgId, tpaOrgId),
    ),
  });

  if (existingReason) {
    const [updated] = await db
      .update(reasonCatalog)
      .set(updates)
      .where(and(
        eq(reasonCatalog.id, id),
        eq(reasonCatalog.tpaOrgId, tpaOrgId),
      ))
      .returning();

    return NextResponse.json({ item: updated, type: 'reason' });
  }

  return NextResponse.json({ error: 'Catalog item not found' }, { status: 404 });
});
