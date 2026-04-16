import { NextResponse } from 'next/server';
import { db } from '@/db';
import { injuryTreatments } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  treatmentDate: z.string().datetime().optional(),
  providerName: z.string().max(200).nullable().optional(),
  providerAddress: z.string().max(500).nullable().optional(),
  diagnosis: z.string().max(2000).nullable().optional(),
  icd10Codes: z.array(z.string()).optional(),
  procedures: z.array(z.string()).optional(),
  medications: z
    .array(z.object({ name: z.string(), dosage: z.string().optional() }))
    .optional(),
  workRestrictions: z.string().max(2000).nullable().optional(),
  nextVisitOn: z.string().datetime().nullable().optional(),
  costCents: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
});

function scope(tpaOrgId: string | null | undefined, id: string) {
  return tpaOrgId
    ? and(eq(injuryTreatments.id, id), eq(injuryTreatments.tpaOrgId, tpaOrgId))
    : eq(injuryTreatments.id, id);
}

export const PATCH = withPermission('manage_treatments', async (req, user, context) => {
  const { id } = context.params;

  const existing = await db.query.injuryTreatments.findFirst({
    where: scope(user.tpaOrgId, id),
  });
  if (!existing) {
    return NextResponse.json({ error: 'Treatment not found' }, { status: 404 });
  }

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
    if (v === undefined) continue;
    if ((k === 'treatmentDate' || k === 'nextVisitOn') && typeof v === 'string') {
      update[k] = new Date(v);
    } else {
      update[k] = v;
    }
  }

  await db.update(injuryTreatments).set(update).where(eq(injuryTreatments.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'injury_treatment',
    entityId: id,
    action: 'updated',
    diffJson: parsed.data as Record<string, unknown>,
  });

  const updated = await db.query.injuryTreatments.findFirst({
    where: eq(injuryTreatments.id, id),
  });
  return NextResponse.json({ treatment: updated });
});

export const DELETE = withPermission('manage_treatments', async (_req, user, context) => {
  const { id } = context.params;

  const existing = await db.query.injuryTreatments.findFirst({
    where: scope(user.tpaOrgId, id),
  });
  if (!existing) {
    return NextResponse.json({ error: 'Treatment not found' }, { status: 404 });
  }

  await db.delete(injuryTreatments).where(eq(injuryTreatments.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'injury_treatment',
    entityId: id,
    action: 'deleted',
    diffJson: { injuryId: existing.injuryId },
  });

  return NextResponse.json({ ok: true });
});
