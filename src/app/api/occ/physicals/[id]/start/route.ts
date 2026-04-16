import { NextResponse } from 'next/server';
import { db } from '@/db';
import { physicalExams } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';
import { roleHasPermission, type UserRole } from '@/auth/rbac';

export const dynamic = 'force-dynamic';

export const POST = withPermission('manage_physicals', async (_req, user, context) => {
  const { id } = context.params;
  const tpaOrgId = user.tpaOrgId;

  const existing = await db.query.physicalExams.findFirst({
    where: tpaOrgId
      ? and(eq(physicalExams.id, id), eq(physicalExams.tpaOrgId, tpaOrgId))
      : eq(physicalExams.id, id),
  });
  if (!existing) {
    return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
  }
  if (existing.status !== 'scheduled' && existing.status !== 'in_progress') {
    return NextResponse.json(
      { error: `Cannot start exam in status '${existing.status}'` },
      { status: 400 }
    );
  }

  // If the starting user will later certify, they must have an NRCME number.
  // We allow any user with manage_physicals to start the exam (e.g., tpa_staff
  // can lead intake) but block setting themselves as examiner unless they hold
  // certify_physicals.
  const canCertify =
    user.role && roleHasPermission(user.role as UserRole, 'certify_physicals');

  if (canCertify && !user.nrcmeNumber) {
    // A role that can certify but lacks an NRCME number should not be recorded
    // as the examiner of record — the MEC would be invalid.
    return NextResponse.json(
      {
        error:
          'Your account is authorized to certify physicals but has no NRCME number set. ' +
          'Update your profile with an NRCME number before starting an exam as examiner of record.',
      },
      { status: 403 }
    );
  }

  await db
    .update(physicalExams)
    .set({
      status: 'in_progress',
      examDate: existing.examDate ?? new Date(),
      examinerId: canCertify ? user.id : existing.examinerId,
      updatedAt: new Date(),
    })
    .where(eq(physicalExams.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'physical_exam',
    entityId: id,
    action: 'exam_started',
    diffJson: { examinerId: canCertify ? user.id : existing.examinerId },
  });

  const updated = await db.query.physicalExams.findFirst({
    where: eq(physicalExams.id, id),
    with: {
      person: { columns: { id: true, firstName: true, lastName: true } },
      examiner: { columns: { id: true, name: true, nrcmeNumber: true } },
    },
  });

  return NextResponse.json({ exam: updated });
});
