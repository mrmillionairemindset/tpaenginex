import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getCurrentUser } from '@/auth/get-user';
import {
  startImpersonation,
  endActiveImpersonation,
  getActiveImpersonation,
  MAX_DURATION_MINUTES,
} from '@/lib/impersonation';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const startSchema = z.object({
  targetUserId: z.string().uuid(),
  reason: z.string().min(10).max(1000),
  durationMinutes: z.number().int().positive().max(MAX_DURATION_MINUTES).optional(),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Only the real platform_admin (not an impersonation chain) may start sessions
  if (user.actualUserId !== user.id || user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Forbidden: platform admin only' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = startSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const target = await db.query.users.findFirst({
    where: eq(users.id, parsed.data.targetUserId),
    columns: { id: true, email: true, name: true, role: true, isActive: true, orgId: true },
  });
  if (!target) {
    return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
  }
  if (target.role === 'platform_admin') {
    return NextResponse.json(
      { error: 'Cannot impersonate another platform admin' },
      { status: 400 }
    );
  }
  if (!target.isActive) {
    return NextResponse.json(
      { error: 'Cannot impersonate an inactive user' },
      { status: 400 }
    );
  }

  const ipAddress = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || undefined;
  const userAgent = req.headers.get('user-agent') || undefined;

  const { sessionId, expiresAt } = await startImpersonation({
    adminUserId: user.id,
    targetUserId: target.id,
    reason: parsed.data.reason,
    durationMinutes: parsed.data.durationMinutes,
    ipAddress,
    userAgent,
  });

  // Audit: log against the target's tpa (for visibility by that TPA) plus a platform-level note
  if (target.orgId) {
    const targetUserFull = await db.query.users.findFirst({
      where: eq(users.id, target.id),
      with: { organization: true },
    });
    const targetTpaId = targetUserFull?.organization?.type === 'tpa'
      ? targetUserFull.organization.id
      : targetUserFull?.organization?.tpaOrgId ?? null;

    if (targetTpaId) {
      await createAuditLog({
        tpaOrgId: targetTpaId,
        actorUserId: user.id,
        actorEmail: user.email,
        entityType: 'impersonation_session',
        entityId: sessionId,
        action: 'started',
        diffJson: {
          targetUserId: target.id,
          targetEmail: target.email,
          reason: parsed.data.reason,
          expiresAt,
        },
        ipAddress,
        userAgent,
      });
    }
  }

  return NextResponse.json({ sessionId, expiresAt, target: { id: target.id, email: target.email, name: target.name } }, { status: 201 });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // When impersonating, actualUserId is the platform_admin's real id
  const adminId = user.isImpersonating ? user.actualUserId : user.id;

  // Validate that the real user is a platform admin
  const adminRow = await db.query.users.findFirst({
    where: eq(users.id, adminId),
    columns: { id: true, email: true, role: true },
  });
  if (!adminRow || adminRow.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ended = await endActiveImpersonation(adminId);
  if (!ended) {
    return NextResponse.json({ error: 'No active impersonation session' }, { status: 404 });
  }

  const ipAddress = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || undefined;
  const userAgent = req.headers.get('user-agent') || undefined;

  // Audit under target's tpa
  const targetUserFull = await db.query.users.findFirst({
    where: eq(users.id, ended.targetUserId),
    with: { organization: true },
  });
  const targetTpaId = targetUserFull?.organization?.type === 'tpa'
    ? targetUserFull.organization.id
    : targetUserFull?.organization?.tpaOrgId ?? null;

  if (targetTpaId) {
    await createAuditLog({
      tpaOrgId: targetTpaId,
      actorUserId: adminRow.id,
      actorEmail: adminRow.email,
      entityType: 'impersonation_session',
      entityId: ended.id,
      action: 'ended',
      ipAddress,
      userAgent,
    });
  }

  return NextResponse.json({ success: true });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const adminId = user.isImpersonating ? user.actualUserId : user.id;
  const adminRow = await db.query.users.findFirst({
    where: eq(users.id, adminId),
    columns: { role: true },
  });
  if (!adminRow || adminRow.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const active = await getActiveImpersonation(adminId);
  if (!active) {
    return NextResponse.json({ active: null });
  }

  const target = await db.query.users.findFirst({
    where: eq(users.id, active.targetUserId),
    columns: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json({ active: { ...active, target } });
}
