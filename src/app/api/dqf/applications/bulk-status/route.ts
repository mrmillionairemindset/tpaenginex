import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { driverApplications } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { createAuditLog } from '@/lib/audit';
import { notifyApplicationStatusChange } from '@/lib/dqf-notifications';

export const dynamic = 'force-dynamic';

const StatusSchema = z.enum([
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'withdrawn',
]);

const BulkStatusBodySchema = z.object({
  applicationIds: z.array(z.string().uuid()).min(1).max(500),
  status: StatusSchema,
});

// ============================================================================
// POST /api/dqf/applications/bulk-status — bulk status update
// ============================================================================

export const POST = withAuth(async (req, user) => {
  const allowedRoles = ['tpa_admin', 'tpa_staff', 'platform_admin'];
  if (!allowedRoles.includes(user.role ?? '')) {
    return NextResponse.json(
      { error: 'Forbidden: Insufficient permissions' },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BulkStatusBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { applicationIds, status } = parsed.data;
  const tpaOrgId = user.tpaOrgId;

  const baseCond = [inArray(driverApplications.id, applicationIds)];
  if (tpaOrgId) {
    baseCond.push(eq(driverApplications.tpaOrgId, tpaOrgId));
  }

  const matching = await db.query.driverApplications.findMany({
    where: and(...baseCond),
    columns: {
      id: true,
      status: true,
      tpaOrgId: true,
    },
  });

  if (matching.length !== applicationIds.length) {
    return NextResponse.json(
      {
        error:
          'One or more applicationIds are not accessible to your tenant or do not exist',
      },
      { status: 403 }
    );
  }

  const updateWhere = tpaOrgId
    ? and(
        inArray(driverApplications.id, applicationIds),
        eq(driverApplications.tpaOrgId, tpaOrgId)
      )
    : inArray(driverApplications.id, applicationIds);

  await db
    .update(driverApplications)
    .set({ status, updatedAt: new Date() })
    .where(updateWhere);

  await Promise.all(
    matching.map((a) =>
      createAuditLog({
        tpaOrgId: a.tpaOrgId,
        actorUserId: user.id,
        actorEmail: user.email ?? '',
        entityType: 'driver_application',
        entityId: a.id,
        action: 'bulk_status_update',
        diffJson: {
          status: { from: a.status, to: status },
          bulk: true,
        },
      })
    )
  );

  // Fire notifications for any application whose status actually changed
  await Promise.all(
    matching
      .filter((a) => a.status !== status)
      .map((a) => notifyApplicationStatusChange(a.id, status, a.tpaOrgId))
  );

  return NextResponse.json({ updated: matching.length });
});
