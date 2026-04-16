import { NextResponse } from 'next/server';
import { db } from '@/db';
import { batTests } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  screeningResult: z.string().max(10).optional(),
  confirmationResult: z.string().max(10).optional(),
  status: z.enum(['negative', 'positive', 'refused', 'invalid', 'pending']).optional(),
  notes: z.string().max(5000).optional(),
});

function scope(tpaOrgId: string | null | undefined, id: string) {
  return tpaOrgId ? and(eq(batTests.id, id), eq(batTests.tpaOrgId, tpaOrgId)) : eq(batTests.id, id);
}

export const GET = withPermission('view_bat', async (_req, user, context) => {
  const { id } = context.params;
  const row = await db.query.batTests.findFirst({
    where: scope(user.tpaOrgId, id),
    with: {
      person: { columns: { id: true, firstName: true, lastName: true, email: true } },
    },
  });
  if (!row) return NextResponse.json({ error: 'BAT test not found' }, { status: 404 });
  return NextResponse.json({ batTest: row });
});

export const PATCH = withPermission('manage_bat', async (req, user, context) => {
  const { id } = context.params;
  const existing = await db.query.batTests.findFirst({ where: scope(user.tpaOrgId, id) });
  if (!existing) return NextResponse.json({ error: 'BAT test not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

  await db
    .update(batTests)
    .set({ ...parsed.data, updatedAt: new Date() } as any)
    .where(eq(batTests.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'bat_test',
    entityId: id,
    action: 'updated',
    diffJson: parsed.data as Record<string, unknown>,
  });

  const updated = await db.query.batTests.findFirst({ where: eq(batTests.id, id) });
  return NextResponse.json({ batTest: updated });
});
