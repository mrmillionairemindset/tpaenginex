import { NextResponse } from 'next/server';
import { db } from '@/db';
import { injuries, injuryTreatments } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const createTreatmentSchema = z.object({
  treatmentDate: z.string().datetime(),
  providerType: z.enum([
    'er',
    'urgent_care',
    'primary_care',
    'specialist',
    'physical_therapy',
    'occupational_medicine',
    'diagnostic',
    'pharmacy',
  ]),
  providerName: z.string().max(200).optional(),
  providerAddress: z.string().max(500).optional(),
  diagnosis: z.string().max(2000).optional(),
  icd10Codes: z.array(z.string()).optional(),
  procedures: z.array(z.string()).optional(),
  medications: z
    .array(z.object({ name: z.string(), dosage: z.string().optional() }))
    .optional(),
  workRestrictions: z.string().max(2000).optional(),
  nextVisitOn: z.string().datetime().optional(),
  costCents: z.number().int().min(0).optional(),
  notes: z.string().max(5000).optional(),
});

function scopeInjury(tpaOrgId: string | null | undefined, id: string) {
  return tpaOrgId
    ? and(eq(injuries.id, id), eq(injuries.tpaOrgId, tpaOrgId))
    : eq(injuries.id, id);
}

export const GET = withPermission('view_treatments', async (_req, user, context) => {
  const { id } = context.params;

  const injury = await db.query.injuries.findFirst({
    where: scopeInjury(user.tpaOrgId, id),
    columns: { id: true, tpaOrgId: true, clientOrgId: true },
  });
  if (!injury) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });

  if (user.role === 'client_admin') {
    if (!user.orgId || injury.clientOrgId !== user.orgId) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }
  }

  const treatments = await db.query.injuryTreatments.findMany({
    where: eq(injuryTreatments.injuryId, id),
    with: {
      recordedByUser: { columns: { id: true, name: true, email: true } },
    },
    orderBy: [desc(injuryTreatments.treatmentDate)],
  });

  return NextResponse.json({ treatments });
});

export const POST = withPermission('manage_treatments', async (req, user, context) => {
  const { id } = context.params;

  const injury = await db.query.injuries.findFirst({
    where: scopeInjury(user.tpaOrgId, id),
  });
  if (!injury) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createTreatmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 },
    );
  }
  const d = parsed.data;

  const [treatment] = await db
    .insert(injuryTreatments)
    .values({
      injuryId: id,
      tpaOrgId: injury.tpaOrgId,
      treatmentDate: new Date(d.treatmentDate),
      providerType: d.providerType,
      providerName: d.providerName || null,
      providerAddress: d.providerAddress || null,
      diagnosis: d.diagnosis || null,
      icd10Codes: d.icd10Codes ?? [],
      procedures: d.procedures ?? [],
      medications: d.medications ?? [],
      workRestrictions: d.workRestrictions || null,
      nextVisitOn: d.nextVisitOn ? new Date(d.nextVisitOn) : null,
      costCents: d.costCents ?? null,
      recordedBy: user.id,
      notes: d.notes || null,
    })
    .returning();

  // When first treatment is logged and injury is still "open", auto-advance
  // to "in_treatment" so the timeline reflects active medical care.
  if (injury.status === 'open') {
    await db
      .update(injuries)
      .set({ status: 'in_treatment', updatedAt: new Date() })
      .where(eq(injuries.id, id));
  }

  await createAuditLog({
    tpaOrgId: injury.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'injury_treatment',
    entityId: treatment.id,
    action: 'created',
    diffJson: {
      injuryId: id,
      providerType: d.providerType,
      treatmentDate: d.treatmentDate,
    },
  });

  return NextResponse.json({ treatment, message: 'Treatment recorded' }, { status: 201 });
});
