import { NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { leads } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const StageSchema = z.enum([
  'new_lead',
  'outreach_sent',
  'proposal_sent',
  'follow_up',
  'contract_sent',
  'closed_won',
  'closed_lost',
]);

const BulkStageBodySchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1).max(500),
  stage: StageSchema,
});

// ============================================================================
// POST /api/leads/bulk-stage — update stage on many leads at once
// ============================================================================

export const POST = withPermission('manage_leads', async (req, user) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = BulkStageBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { leadIds, stage } = parsed.data;
  const tpaOrgId = user.tpaOrgId;

  // Verify all leadIds belong to the user's tpaOrgId
  const baseCond = [inArray(leads.id, leadIds)];
  if (tpaOrgId) {
    baseCond.push(eq(leads.tpaOrgId, tpaOrgId));
  }

  const matching = await db.query.leads.findMany({
    where: and(...baseCond),
    columns: {
      id: true,
      stage: true,
      tpaOrgId: true,
    },
  });

  if (matching.length !== leadIds.length) {
    return NextResponse.json(
      {
        error:
          'One or more leadIds are not accessible to your tenant or do not exist',
      },
      { status: 403 }
    );
  }

  const updateWhere = tpaOrgId
    ? and(inArray(leads.id, leadIds), eq(leads.tpaOrgId, tpaOrgId))
    : inArray(leads.id, leadIds);

  await db
    .update(leads)
    .set({ stage, updatedAt: new Date() })
    .where(updateWhere);

  await Promise.all(
    matching.map((l) =>
      createAuditLog({
        tpaOrgId: l.tpaOrgId,
        actorUserId: user.id,
        actorEmail: user.email ?? '',
        entityType: 'lead',
        entityId: l.id,
        action: 'bulk_stage_update',
        diffJson: {
          stage: { from: l.stage, to: stage },
          bulk: true,
        },
      })
    )
  );

  return NextResponse.json({ updated: matching.length });
});
