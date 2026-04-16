import { NextResponse } from 'next/server';
import { db } from '@/db';
import { returnToWorkEvals } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

function scope(tpaOrgId: string | null | undefined, id: string) {
  return tpaOrgId
    ? and(eq(returnToWorkEvals.id, id), eq(returnToWorkEvals.tpaOrgId, tpaOrgId))
    : eq(returnToWorkEvals.id, id);
}

export const POST = withPermission('sign_off_rtw', async (_req, user, context) => {
  const { id } = context.params;

  const existing = await db.query.returnToWorkEvals.findFirst({
    where: scope(user.tpaOrgId, id),
  });
  if (!existing) {
    return NextResponse.json({ error: 'RTW evaluation not found' }, { status: 404 });
  }
  if (existing.signedOffAt) {
    return NextResponse.json(
      { error: 'RTW evaluation already signed off', signedOffAt: existing.signedOffAt },
      { status: 400 },
    );
  }

  const now = new Date();
  await db
    .update(returnToWorkEvals)
    .set({
      signedOffByUserId: user.id,
      signedOffAt: now,
      updatedAt: now,
    })
    .where(eq(returnToWorkEvals.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'rtw_eval',
    entityId: id,
    action: 'signed_off',
    diffJson: { injuryId: existing.injuryId, signedOffAt: now.toISOString() },
  });

  const updated = await db.query.returnToWorkEvals.findFirst({
    where: eq(returnToWorkEvals.id, id),
  });
  return NextResponse.json({ rtwEval: updated, message: 'RTW evaluation signed off' });
});
