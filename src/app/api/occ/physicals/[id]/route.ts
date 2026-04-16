import { NextResponse } from 'next/server';
import { db } from '@/db';
import { physicalExams, physicalExamHealthHistory } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { decryptAtRest } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  scheduledFor: z.string().datetime().optional(),
  notes: z.string().max(5000).optional(),
  clientOrgId: z.string().uuid().optional().nullable(),
});

function scopeWhere(tpaOrgId: string | null | undefined, id: string) {
  return tpaOrgId
    ? and(eq(physicalExams.id, id), eq(physicalExams.tpaOrgId, tpaOrgId))
    : eq(physicalExams.id, id);
}

export const GET = withPermission('view_physicals', async (_req, user, context) => {
  const { id } = context.params;

  const exam = await db.query.physicalExams.findFirst({
    where: scopeWhere(user.tpaOrgId, id),
    with: {
      person: true,
      clientOrg: { columns: { id: true, name: true } },
      examiner: { columns: { id: true, name: true, email: true, nrcmeNumber: true } },
      healthHistory: true,
      vitals: true,
      findings: true,
      batTests: true,
    },
  });

  if (!exam) {
    return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
  }

  // Decrypt health history
  let healthHistoryData: unknown = null;
  if (exam.healthHistory?.encryptedPayload) {
    try {
      const plain = decryptAtRest(exam.healthHistory.encryptedPayload);
      healthHistoryData = plain ? JSON.parse(plain) : null;
    } catch (err) {
      console.error('[occ/physicals/[id]] failed to decrypt health history:', err);
      healthHistoryData = null;
    }
  }

  return NextResponse.json({
    exam: {
      ...exam,
      healthHistory: exam.healthHistory
        ? {
            id: exam.healthHistory.id,
            driverSignature: exam.healthHistory.driverSignature,
            driverSignedAt: exam.healthHistory.driverSignedAt,
            createdAt: exam.healthHistory.createdAt,
            updatedAt: exam.healthHistory.updatedAt,
            data: healthHistoryData,
          }
        : null,
    },
  });
});

export const PATCH = withPermission('manage_physicals', async (req, user, context) => {
  const { id } = context.params;

  const existing = await db.query.physicalExams.findFirst({
    where: scopeWhere(user.tpaOrgId, id),
  });
  if (!existing) {
    return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.scheduledFor) update.scheduledFor = new Date(parsed.data.scheduledFor);
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;
  if (parsed.data.clientOrgId !== undefined) update.clientOrgId = parsed.data.clientOrgId;

  await db.update(physicalExams).set(update).where(eq(physicalExams.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'physical_exam',
    entityId: id,
    action: 'updated',
    diffJson: parsed.data as Record<string, unknown>,
  });

  const updated = await db.query.physicalExams.findFirst({
    where: eq(physicalExams.id, id),
  });
  return NextResponse.json({ exam: updated });
});

export const DELETE = withPermission('manage_physicals', async (_req, user, context) => {
  const { id } = context.params;

  const existing = await db.query.physicalExams.findFirst({
    where: scopeWhere(user.tpaOrgId, id),
  });
  if (!existing) {
    return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
  }
  if (existing.status !== 'scheduled') {
    return NextResponse.json(
      { error: 'Only scheduled exams can be abandoned' },
      { status: 400 }
    );
  }

  await db
    .update(physicalExams)
    .set({ status: 'abandoned', updatedAt: new Date() })
    .where(eq(physicalExams.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'physical_exam',
    entityId: id,
    action: 'abandoned',
    diffJson: { prevStatus: 'scheduled' },
  });

  return NextResponse.json({ ok: true });
});
