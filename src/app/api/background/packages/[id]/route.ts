import { NextResponse } from 'next/server';
import { db } from '@/db';
import { backgroundCheckPackages } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional().nullable(),
  providerPackageSlug: z.string().min(1).max(100).optional(),
  includesMvr: z.boolean().optional(),
  includesDrugTest: z.boolean().optional(),
  includesEmploymentVerification: z.boolean().optional(),
  includesEducationVerification: z.boolean().optional(),
  retailPriceCents: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

function scopeWhere(tpaOrgId: string | null | undefined, id: string) {
  return tpaOrgId
    ? and(eq(backgroundCheckPackages.id, id), eq(backgroundCheckPackages.tpaOrgId, tpaOrgId))
    : eq(backgroundCheckPackages.id, id);
}

export const GET = withPermission('view_background_checks', async (_req, user, context) => {
  const { id } = context.params;
  const pkg = await db.query.backgroundCheckPackages.findFirst({
    where: scopeWhere(user.tpaOrgId, id),
  });
  if (!pkg) return NextResponse.json({ error: 'Package not found' }, { status: 404 });
  return NextResponse.json({ package: pkg });
});

export const PATCH = withPermission('manage_background_packages', async (req, user, context) => {
  const { id } = context.params;
  const existing = await db.query.backgroundCheckPackages.findFirst({
    where: scopeWhere(user.tpaOrgId, id),
  });
  if (!existing) return NextResponse.json({ error: 'Package not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 },
    );
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) update[k] = v;
  }

  await db.update(backgroundCheckPackages).set(update).where(eq(backgroundCheckPackages.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'background_check_package',
    entityId: id,
    action: 'updated',
    diffJson: parsed.data as Record<string, unknown>,
  });

  const updated = await db.query.backgroundCheckPackages.findFirst({
    where: eq(backgroundCheckPackages.id, id),
  });
  return NextResponse.json({ package: updated });
});

// DELETE — soft delete (set isActive=false). Preserves historical reference from background_checks.
export const DELETE = withPermission('manage_background_packages', async (_req, user, context) => {
  const { id } = context.params;
  const existing = await db.query.backgroundCheckPackages.findFirst({
    where: scopeWhere(user.tpaOrgId, id),
  });
  if (!existing) return NextResponse.json({ error: 'Package not found' }, { status: 404 });

  await db
    .update(backgroundCheckPackages)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(backgroundCheckPackages.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'background_check_package',
    entityId: id,
    action: 'deactivated',
    diffJson: { prevIsActive: existing.isActive },
  });

  return NextResponse.json({ ok: true });
});
