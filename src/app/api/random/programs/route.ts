import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { randomPrograms, randomPools } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, and, desc, sql } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// ============================================================================
// Validation
// ============================================================================

const createProgramSchema = z.object({
  name: z.string().min(1).max(200),
  programType: z.enum(['dot', 'non_dot', 'consortium']),
  clientOrgId: z.string().uuid().optional().nullable(),
  // Basis points 0..20000 (up to 200% for catch-up scenarios)
  drugTestRateBp: z.number().int().min(0).max(20000),
  alcoholTestRateBp: z.number().int().min(0).max(20000),
  periodType: z.enum(['monthly', 'quarterly', 'semiannual', 'annual']),
  notes: z.string().optional().nullable(),
});

// ============================================================================
// GET /api/random/programs — list programs for TPA
// ============================================================================

export const GET = withPermission('view_random', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const whereClause = tpaOrgId
    ? eq(randomPrograms.tpaOrgId, tpaOrgId)
    : undefined;

  const programs = await db.query.randomPrograms.findMany({
    where: whereClause,
    with: {
      clientOrg: { columns: { id: true, name: true } },
    },
    orderBy: [desc(randomPrograms.createdAt)],
  });

  // Pool counts per program
  const poolCounts = await db
    .select({
      programId: randomPools.programId,
      poolCount: sql<number>`count(*)::int`,
    })
    .from(randomPools)
    .where(tpaOrgId ? eq(randomPools.tpaOrgId, tpaOrgId) : undefined)
    .groupBy(randomPools.programId);

  const countMap = new Map(poolCounts.map((c) => [c.programId, Number(c.poolCount)]));

  return NextResponse.json({
    programs: programs.map((p) => ({
      ...p,
      poolCount: countMap.get(p.id) ?? 0,
    })),
  });
});

// ============================================================================
// POST /api/random/programs — create program
// ============================================================================

export const POST = withPermission('manage_random', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const body = await req.json();
  const parsed = createProgramSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const [created] = await db
    .insert(randomPrograms)
    .values({
      tpaOrgId,
      clientOrgId: data.clientOrgId ?? null,
      name: data.name,
      programType: data.programType,
      drugTestRate: data.drugTestRateBp,
      alcoholTestRate: data.alcoholTestRateBp,
      periodType: data.periodType,
      notes: data.notes ?? null,
    })
    .returning();

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'random_program',
    entityId: created.id,
    action: 'created',
    diffJson: {
      name: data.name,
      programType: data.programType,
      drugTestRateBp: data.drugTestRateBp,
      alcoholTestRateBp: data.alcoholTestRateBp,
      periodType: data.periodType,
    },
  });

  return NextResponse.json({ program: created }, { status: 201 });
});
