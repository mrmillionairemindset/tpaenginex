import { NextResponse } from 'next/server';
import { db } from '@/db';
import { physicalExams, physicalExamHealthHistory } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { encryptAtRest, decryptAtRest } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

// Driver-reported medical history. Entirely structural — we don't restrict
// beyond basic shape because regulations + the clinical intake form evolve
// and we want to future-proof the payload. The whole object is encrypted.
const medicationSchema = z.object({
  name: z.string(),
  dose: z.string().optional(),
  frequency: z.string().optional(),
  condition: z.string().optional(),
});

const surgerySchema = z.object({
  procedure: z.string(),
  year: z.string().optional(),
  complications: z.string().optional(),
});

const conditionSchema = z.object({
  name: z.string(),
  currentlyTreated: z.boolean().optional(),
  notes: z.string().optional(),
});

const healthHistorySchema = z.object({
  // Section 1: chronic conditions (yes/no checklist with notes)
  conditions: z.array(conditionSchema).optional(),
  // Section 2: medications
  medications: z.array(medicationSchema).optional(),
  // Section 3: surgeries / hospitalizations
  surgeries: z.array(surgerySchema).optional(),
  // Section 4: family history
  familyHistory: z.record(z.unknown()).optional(),
  // Section 5: substance use disclosure
  substanceUse: z
    .object({
      tobacco: z.string().optional(),
      alcohol: z.string().optional(),
      illegalDrugs: z.string().optional(),
    })
    .optional(),
  // Section 6: employment / driving history
  drivingHistory: z
    .object({
      hasCommercialLicense: z.boolean().optional(),
      yearsExperience: z.number().optional(),
      previousDotPhysicals: z.number().optional(),
      accidents: z.string().optional(),
      violations: z.string().optional(),
    })
    .optional(),
  // Catch-all for any additional intake fields
  additional: z.record(z.unknown()).optional(),
});

const postSchema = z.object({
  data: healthHistorySchema,
  driverSignature: z.string().max(500_000).optional(),
});

async function loadExam(tpaOrgId: string | null | undefined, id: string) {
  return db.query.physicalExams.findFirst({
    where: tpaOrgId
      ? and(eq(physicalExams.id, id), eq(physicalExams.tpaOrgId, tpaOrgId))
      : eq(physicalExams.id, id),
  });
}

export const GET = withPermission('view_physicals', async (_req, user, context) => {
  const { id } = context.params;
  const exam = await loadExam(user.tpaOrgId, id);
  if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });

  const row = await db.query.physicalExamHealthHistory.findFirst({
    where: eq(physicalExamHealthHistory.examId, id),
  });

  if (!row) {
    return NextResponse.json({ healthHistory: null });
  }

  let decrypted: unknown = null;
  try {
    const plain = decryptAtRest(row.encryptedPayload);
    decrypted = plain ? JSON.parse(plain) : null;
  } catch (err) {
    console.error('[occ/health-history] decrypt failed:', err);
  }

  return NextResponse.json({
    healthHistory: {
      id: row.id,
      data: decrypted,
      driverSignature: row.driverSignature,
      driverSignedAt: row.driverSignedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    },
  });
});

async function upsertHealthHistory(
  req: Request,
  user: { id: string; email: string | null; tpaOrgId: string | null },
  id: string,
) {
  const exam = await loadExam(user.tpaOrgId, id);
  if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
  if (exam.status === 'completed' || exam.status === 'abandoned') {
    return NextResponse.json(
      { error: `Cannot modify health history for ${exam.status} exam` },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const encrypted = encryptAtRest(JSON.stringify(parsed.data.data));
  const signature = parsed.data.driverSignature || null;

  const existing = await db.query.physicalExamHealthHistory.findFirst({
    where: eq(physicalExamHealthHistory.examId, id),
  });

  if (existing) {
    const update: Record<string, unknown> = {
      encryptedPayload: encrypted,
      updatedAt: new Date(),
    };
    if (signature !== null) {
      update.driverSignature = signature;
      update.driverSignedAt = new Date();
    }
    await db
      .update(physicalExamHealthHistory)
      .set(update)
      .where(eq(physicalExamHealthHistory.id, existing.id));
  } else {
    await db.insert(physicalExamHealthHistory).values({
      examId: id,
      encryptedPayload: encrypted,
      driverSignature: signature,
      driverSignedAt: signature ? new Date() : null,
    });
  }

  await createAuditLog({
    tpaOrgId: exam.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'physical_exam_health_history',
    entityId: id,
    action: existing ? 'updated' : 'created',
    diffJson: { signed: Boolean(signature) },
  });

  return NextResponse.json({ ok: true });
}

export const POST = withPermission('manage_physicals', async (req, user, context) => {
  return upsertHealthHistory(req, user, context.params.id);
});

export const PATCH = withPermission('manage_physicals', async (req, user, context) => {
  return upsertHealthHistory(req, user, context.params.id);
});
