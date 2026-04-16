import { NextResponse } from 'next/server';
import { db } from '@/db';
import { physicalExams, physicalExamVitals, physicalExamFindings } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { evaluateBloodPressure, calculateBmi } from '@/lib/dot-physical';

export const dynamic = 'force-dynamic';

const vitalsSchema = z.object({
  heightInches: z.number().int().min(36).max(96).optional().nullable(),
  weightPounds: z.number().int().min(50).max(600).optional().nullable(),
  bpSystolic: z.number().int().min(60).max(260).optional().nullable(),
  bpDiastolic: z.number().int().min(30).max(200).optional().nullable(),
  pulse: z.number().int().min(20).max(220).optional().nullable(),
  visionRightUncorrected: z.string().max(10).optional().nullable(),
  visionLeftUncorrected: z.string().max(10).optional().nullable(),
  visionBothUncorrected: z.string().max(10).optional().nullable(),
  visionRightCorrected: z.string().max(10).optional().nullable(),
  visionLeftCorrected: z.string().max(10).optional().nullable(),
  visionBothCorrected: z.string().max(10).optional().nullable(),
  wearsCorrectiveLenses: z.boolean().optional(),
  horizontalFieldOfVisionRight: z.number().int().min(0).max(180).optional().nullable(),
  horizontalFieldOfVisionLeft: z.number().int().min(0).max(180).optional().nullable(),
  colorVisionAdequate: z.boolean().optional().nullable(),
  hearingRight: z.string().max(20).optional().nullable(),
  hearingLeft: z.string().max(20).optional().nullable(),
  urineSpecificGravity: z.string().max(10).optional().nullable(),
  urineProtein: z.string().max(20).optional().nullable(),
  urineBlood: z.string().max(20).optional().nullable(),
  urineSugar: z.string().max(20).optional().nullable(),
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

  const vitals = await db.query.physicalExamVitals.findFirst({
    where: eq(physicalExamVitals.examId, id),
  });
  const bmi =
    vitals?.heightInches && vitals?.weightPounds
      ? calculateBmi(vitals.heightInches, vitals.weightPounds)
      : null;

  return NextResponse.json({ vitals: vitals ?? null, bmi });
});

async function upsertVitals(
  req: Request,
  user: { id: string; email: string | null; tpaOrgId: string | null },
  id: string,
) {
  const exam = await loadExam(user.tpaOrgId, id);
  if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
  if (exam.status === 'completed' || exam.status === 'abandoned') {
    return NextResponse.json(
      { error: `Cannot modify vitals for ${exam.status} exam` },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = vitalsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  const existing = await db.query.physicalExamVitals.findFirst({
    where: eq(physicalExamVitals.examId, id),
  });

  if (existing) {
    await db
      .update(physicalExamVitals)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(physicalExamVitals.id, existing.id));
  } else {
    await db.insert(physicalExamVitals).values({ examId: id, ...data } as any);
  }

  // Auto-create hypertension finding when BP indicates it
  let autoFindingCategory: string | null = null;
  if (typeof data.bpSystolic === 'number' && typeof data.bpDiastolic === 'number') {
    const bpFinding = evaluateBloodPressure(data.bpSystolic, data.bpDiastolic);
    if (bpFinding) {
      // Check if we already auto-created the same category to avoid duplicates
      const existingFindings = await db.query.physicalExamFindings.findMany({
        where: and(
          eq(physicalExamFindings.examId, id),
          eq(physicalExamFindings.category, bpFinding),
        ),
      });
      if (existingFindings.length === 0) {
        await db.insert(physicalExamFindings).values({
          examId: id,
          category: bpFinding,
          description: `Blood pressure ${data.bpSystolic}/${data.bpDiastolic} meets ${bpFinding.replace('_', ' ')} threshold (auto-detected from vitals)`,
          action: null,
          requiresFollowUp:
            bpFinding === 'hypertension_stage2' || bpFinding === 'hypertension_stage3',
        });
        autoFindingCategory = bpFinding;
      }
    }
  }

  await createAuditLog({
    tpaOrgId: exam.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'physical_exam_vitals',
    entityId: id,
    action: existing ? 'updated' : 'created',
    diffJson: {
      bpSystolic: data.bpSystolic,
      bpDiastolic: data.bpDiastolic,
      heightInches: data.heightInches,
      weightPounds: data.weightPounds,
      autoFindingCategory,
    },
  });

  const bmi =
    data.heightInches && data.weightPounds
      ? calculateBmi(data.heightInches, data.weightPounds)
      : null;

  return NextResponse.json({ ok: true, bmi, autoFindingCategory });
}

export const POST = withPermission('manage_physicals', async (req, user, context) => {
  return upsertVitals(req, user, context.params.id);
});

export const PATCH = withPermission('manage_physicals', async (req, user, context) => {
  return upsertVitals(req, user, context.params.id);
});
