import { NextResponse } from 'next/server';
import { db } from '@/db';
import { physicalExams, physicalExamFindings } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const FINDING_CATEGORIES = [
  'hypertension_stage1',
  'hypertension_stage2',
  'hypertension_stage3',
  'diabetes_insulin',
  'diabetes_non_insulin',
  'cardiovascular_stable',
  'cardiovascular_unstable',
  'sleep_apnea_osa',
  'sleep_apnea_untreated',
  'copd',
  'asthma_controlled',
  'vision_monocular',
  'vision_corrected',
  'hearing_aid',
  'hearing_impaired',
  'musculoskeletal_limb',
  'neurological_seizure',
  'neurological_stable',
  'psychiatric_controlled',
  'psychiatric_active',
  'other',
] as const;

const findingSchema = z.object({
  category: z.enum(FINDING_CATEGORIES),
  description: z.string().min(1).max(2000),
  action: z.string().max(2000).optional().nullable(),
  requiresFollowUp: z.boolean().optional(),
  followUpByDate: z.string().datetime().optional(),
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

  const findings = await db.query.physicalExamFindings.findMany({
    where: eq(physicalExamFindings.examId, id),
    orderBy: [asc(physicalExamFindings.createdAt)],
  });

  return NextResponse.json({ findings });
});

export const POST = withPermission('manage_physicals', async (req, user, context) => {
  const { id } = context.params;
  const exam = await loadExam(user.tpaOrgId, id);
  if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
  if (exam.status === 'completed' || exam.status === 'abandoned') {
    return NextResponse.json(
      { error: `Cannot add findings to ${exam.status} exam` },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = findingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const [finding] = await db
    .insert(physicalExamFindings)
    .values({
      examId: id,
      category: parsed.data.category,
      description: parsed.data.description,
      action: parsed.data.action ?? null,
      requiresFollowUp: parsed.data.requiresFollowUp ?? false,
      followUpByDate: parsed.data.followUpByDate ? new Date(parsed.data.followUpByDate) : null,
    })
    .returning();

  await createAuditLog({
    tpaOrgId: exam.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'physical_exam_finding',
    entityId: finding.id,
    action: 'created',
    diffJson: { examId: id, category: parsed.data.category },
  });

  return NextResponse.json({ finding }, { status: 201 });
});
