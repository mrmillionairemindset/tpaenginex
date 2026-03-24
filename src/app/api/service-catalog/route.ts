import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { serviceCatalog, reasonCatalog, panelCodes } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and, asc } from 'drizzle-orm';
import { seedCatalogForTpa } from '@/lib/catalog-seed';

export const dynamic = 'force-dynamic';

// GET /api/service-catalog — list all active services, reasons, and panel codes for this TPA
export const GET = withAuth(async (req, user) => {
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required for catalog' }, { status: 400 });
  }

  // Auto-seed if no catalog exists yet
  const existingService = await db.query.serviceCatalog.findFirst({
    where: eq(serviceCatalog.tpaOrgId, tpaOrgId),
  });

  if (!existingService) {
    await seedCatalogForTpa(tpaOrgId);
  }

  // Fetch all active catalog data
  const [services, reasons, panels] = await Promise.all([
    db.query.serviceCatalog.findMany({
      where: and(
        eq(serviceCatalog.tpaOrgId, tpaOrgId),
        eq(serviceCatalog.isActive, true),
      ),
      orderBy: [asc(serviceCatalog.sortOrder)],
    }),
    db.query.reasonCatalog.findMany({
      where: and(
        eq(reasonCatalog.tpaOrgId, tpaOrgId),
        eq(reasonCatalog.isActive, true),
      ),
      orderBy: [asc(reasonCatalog.sortOrder)],
    }),
    db.query.panelCodes.findMany({
      where: and(
        eq(panelCodes.tpaOrgId, tpaOrgId),
        eq(panelCodes.isActive, true),
      ),
      orderBy: [asc(panelCodes.sortOrder)],
    }),
  ]);

  return NextResponse.json({
    services,
    reasons,
    panelCodes: panels,
  });
});
