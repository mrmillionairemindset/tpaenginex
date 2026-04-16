import { NextResponse } from 'next/server';
import { db } from '@/db';
import { vaccinations } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  manufacturer: z.string().max(100).optional(),
  lotNumber: z.string().max(100).optional(),
  doseNumber: z.number().int().min(1).max(20).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  notes: z.string().max(5000).optional(),
});

function scope(tpaOrgId: string | null | undefined, id: string) {
  return tpaOrgId ? and(eq(vaccinations.id, id), eq(vaccinations.tpaOrgId, tpaOrgId)) : eq(vaccinations.id, id);
}

export const GET = withPermission('view_vaccinations', async (_req, user, context) => {
  const { id } = context.params;
  const row = await db.query.vaccinations.findFirst({
    where: scope(user.tpaOrgId, id),
    with: {
      person: { columns: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  if (!row) return NextResponse.json({ error: 'Vaccination not found' }, { status: 404 });
  return NextResponse.json({ vaccination: row });
});

export const PATCH = withPermission('manage_vaccinations', async (req, user, context) => {
  const { id } = context.params;
  const existing = await db.query.vaccinations.findFirst({ where: scope(user.tpaOrgId, id) });
  if (!existing) return NextResponse.json({ error: 'Vaccination not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.manufacturer !== undefined) update.manufacturer = parsed.data.manufacturer;
  if (parsed.data.lotNumber !== undefined) update.lotNumber = parsed.data.lotNumber;
  if (parsed.data.doseNumber !== undefined) update.doseNumber = parsed.data.doseNumber;
  if (parsed.data.expiresAt !== undefined)
    update.expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;

  await db.update(vaccinations).set(update).where(eq(vaccinations.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'vaccination',
    entityId: id,
    action: 'updated',
    diffJson: parsed.data as Record<string, unknown>,
  });

  const updated = await db.query.vaccinations.findFirst({ where: eq(vaccinations.id, id) });
  return NextResponse.json({ vaccination: updated });
});

export const DELETE = withPermission('manage_vaccinations', async (_req, user, context) => {
  const { id } = context.params;
  const existing = await db.query.vaccinations.findFirst({ where: scope(user.tpaOrgId, id) });
  if (!existing) return NextResponse.json({ error: 'Vaccination not found' }, { status: 404 });

  await db.delete(vaccinations).where(eq(vaccinations.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'vaccination',
    entityId: id,
    action: 'deleted',
  });

  return NextResponse.json({ ok: true });
});
