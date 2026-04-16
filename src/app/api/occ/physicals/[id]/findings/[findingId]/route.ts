import { NextResponse } from 'next/server';
import { db } from '@/db';
import { physicalExams, physicalExamFindings } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export const DELETE = withPermission('manage_physicals', async (_req, user, context) => {
  const { id, findingId } = context.params;
  const tpaOrgId = user.tpaOrgId;

  const exam = await db.query.physicalExams.findFirst({
    where: tpaOrgId
      ? and(eq(physicalExams.id, id), eq(physicalExams.tpaOrgId, tpaOrgId))
      : eq(physicalExams.id, id),
  });
  if (!exam) return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
  if (exam.status === 'completed' || exam.status === 'abandoned') {
    return NextResponse.json(
      { error: `Cannot remove findings on ${exam.status} exam` },
      { status: 400 }
    );
  }

  const finding = await db.query.physicalExamFindings.findFirst({
    where: and(
      eq(physicalExamFindings.id, findingId),
      eq(physicalExamFindings.examId, id),
    ),
  });
  if (!finding) return NextResponse.json({ error: 'Finding not found' }, { status: 404 });

  await db.delete(physicalExamFindings).where(eq(physicalExamFindings.id, findingId));

  await createAuditLog({
    tpaOrgId: exam.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'physical_exam_finding',
    entityId: findingId,
    action: 'deleted',
    diffJson: { examId: id, category: finding.category },
  });

  return NextResponse.json({ ok: true });
});
