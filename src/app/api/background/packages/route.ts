import { NextResponse } from 'next/server';
import { db } from '@/db';
import { backgroundCheckPackages } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const packageSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  providerPackageSlug: z.string().min(1).max(100),
  includesMvr: z.boolean().optional(),
  includesDrugTest: z.boolean().optional(),
  includesEmploymentVerification: z.boolean().optional(),
  includesEducationVerification: z.boolean().optional(),
  retailPriceCents: z.number().int().nonnegative(),
  provider: z.enum(['checkr', 'first_advantage', 'sterling', 'manual']).optional(),
});

// GET /api/background/packages — list packages for TPA
export const GET = withPermission('view_background_checks', async (req, user) => {
  const { searchParams } = new URL(req.url);
  const tpaOrgId = user.tpaOrgId;
  const includeInactive = searchParams.get('includeInactive') === 'true';

  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  let where: any = eq(backgroundCheckPackages.tpaOrgId, tpaOrgId);
  if (!includeInactive) {
    where = and(where, eq(backgroundCheckPackages.isActive, true));
  }

  const rows = await db.query.backgroundCheckPackages.findMany({
    where,
    orderBy: [desc(backgroundCheckPackages.createdAt)],
  });

  return NextResponse.json({ packages: rows });
});

// POST /api/background/packages — create a package
export const POST = withPermission('manage_background_packages', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = packageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const [pkg] = await db
    .insert(backgroundCheckPackages)
    .values({
      tpaOrgId,
      provider: data.provider ?? 'checkr',
      name: data.name,
      description: data.description ?? null,
      providerPackageSlug: data.providerPackageSlug,
      includesMvr: data.includesMvr ?? false,
      includesDrugTest: data.includesDrugTest ?? false,
      includesEmploymentVerification: data.includesEmploymentVerification ?? false,
      includesEducationVerification: data.includesEducationVerification ?? false,
      retailPriceCents: data.retailPriceCents,
    })
    .returning();

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'background_check_package',
    entityId: pkg.id,
    action: 'created',
    diffJson: { name: pkg.name, providerPackageSlug: pkg.providerPackageSlug, retailPriceCents: pkg.retailPriceCents },
  });

  return NextResponse.json({ package: pkg }, { status: 201 });
});
