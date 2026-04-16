import { NextResponse } from 'next/server';
import { db } from '@/db';
import { physicalExams } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { getDownloadUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export const GET = withPermission('view_physicals', async (_req, user, context) => {
  const { id } = context.params;
  const tpaOrgId = user.tpaOrgId;

  const exam = await db.query.physicalExams.findFirst({
    where: tpaOrgId
      ? and(eq(physicalExams.id, id), eq(physicalExams.tpaOrgId, tpaOrgId))
      : eq(physicalExams.id, id),
    columns: { id: true, mecStorageKey: true, tpaOrgId: true },
  });

  if (!exam) {
    return NextResponse.json({ error: 'Exam not found' }, { status: 404 });
  }
  if (!exam.mecStorageKey) {
    return NextResponse.json({ error: 'No MEC has been issued for this exam' }, { status: 404 });
  }

  const signed = await getDownloadUrl(exam.mecStorageKey);
  return NextResponse.redirect(signed, { status: 302 });
});
