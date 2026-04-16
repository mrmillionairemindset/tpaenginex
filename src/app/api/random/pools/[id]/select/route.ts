import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { randomPools, randomPoolMembers, randomSelections } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, and } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';
import {
  runRandomSelection,
  calculatePeriodSelectionCount,
  periodsPerYear,
} from '@/lib/random-selection';

export const dynamic = 'force-dynamic';

// POST /api/random/pools/[id]/select — CORE OPERATION
// Cryptographically random selection of drug + alcohol test candidates.
// Pool must be status='open'. Transaction-wrapped for atomicity.
export const POST = withPermission('manage_random', async (req, user, context) => {
  const { id } = context.params as { id: string };
  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const pool = await db.query.randomPools.findFirst({
    where: and(eq(randomPools.id, id), eq(randomPools.tpaOrgId, tpaOrgId)),
    with: { program: true },
  });

  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
  }

  if (pool.status !== 'open') {
    return NextResponse.json(
      { error: `Pool is ${pool.status} — selection can only be run on open pools` },
      { status: 409 },
    );
  }

  // Load ACTIVE (eligible) members only
  const activeMembers = await db.query.randomPoolMembers.findMany({
    where: and(
      eq(randomPoolMembers.poolId, id),
      eq(randomPoolMembers.eligibilityStatus, 'active'),
    ),
    columns: { id: true, personId: true },
  });

  if (activeMembers.length === 0) {
    return NextResponse.json(
      { error: 'No active members in pool — cannot run selection' },
      { status: 409 },
    );
  }

  const poolSize = activeMembers.length;
  const ppy = periodsPerYear(pool.program.periodType);

  const drugCount = Math.min(
    calculatePeriodSelectionCount(poolSize, pool.program.drugTestRate, ppy),
    poolSize,
  );
  const alcoholCount = Math.min(
    calculatePeriodSelectionCount(poolSize, pool.program.alcoholTestRate, ppy),
    poolSize,
  );

  // Run drug + alcohol selections independently. Each uses its own
  // cryptographic seed — alcohol selection is NOT a subset of drug.
  const memberIds = activeMembers.map((m) => m.id);

  const drugResult =
    drugCount > 0
      ? runRandomSelection({ memberIds, count: drugCount })
      : { selectedMemberIds: [], seedHash: '' };

  const alcoholResult =
    alcoholCount > 0
      ? runRandomSelection({ memberIds, count: alcoholCount })
      : { selectedMemberIds: [], seedHash: '' };

  // Combine — a member selected for both gets a single 'both' row
  const memberToPersonMap = new Map(activeMembers.map((m) => [m.id, m.personId]));
  const drugSet = new Set(drugResult.selectedMemberIds);
  const alcoholSet = new Set(alcoholResult.selectedMemberIds);
  const allSelectedMemberIds = new Set<string>([...drugSet, ...alcoholSet]);

  const selectionRows = Array.from(allSelectedMemberIds).map((memberId) => {
    const inDrug = drugSet.has(memberId);
    const inAlcohol = alcoholSet.has(memberId);
    const selectionType: 'drug' | 'alcohol' | 'both' =
      inDrug && inAlcohol ? 'both' : inDrug ? 'drug' : 'alcohol';
    return {
      poolId: id,
      personId: memberToPersonMap.get(memberId)!,
      tpaOrgId,
      selectionType,
    };
  });

  // Composite seed hash for audit (concatenation of both seed hashes)
  const composedSeedHash = `drug:${drugResult.seedHash};alcohol:${alcoholResult.seedHash}`;
  // 64-char varchar limit on column — store only drug seed; full audit in logs
  const storedSeedHash = drugResult.seedHash || alcoholResult.seedHash || '';

  const createdSelections = await db.transaction(async (tx) => {
    // Re-check pool status inside tx to avoid race
    const current = await tx.query.randomPools.findFirst({
      where: eq(randomPools.id, id),
      columns: { status: true },
    });
    if (!current || current.status !== 'open') {
      throw new Error('Pool status changed — selection aborted');
    }

    const inserted =
      selectionRows.length > 0
        ? await tx.insert(randomSelections).values(selectionRows).returning()
        : [];

    await tx
      .update(randomPools)
      .set({
        status: 'selected',
        selectedAt: new Date(),
        selectedBy: user.id,
        totalSelectedDrug: drugCount,
        totalSelectedAlcohol: alcoholCount,
        totalEligible: poolSize,
        selectionSeedHash: storedSeedHash,
        updatedAt: new Date(),
      })
      .where(eq(randomPools.id, id));

    return inserted;
  });

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'random_pool',
    entityId: id,
    action: 'random_selection_run',
    diffJson: {
      programId: pool.programId,
      programName: pool.program.name,
      periodStartsAt: pool.periodStartsAt,
      periodEndsAt: pool.periodEndsAt,
      poolSize,
      drugCount,
      alcoholCount,
      totalSelected: selectionRows.length,
      seedHash: composedSeedHash,
    },
  });

  const grouped = {
    drug: createdSelections.filter((s) => s.selectionType === 'drug'),
    alcohol: createdSelections.filter((s) => s.selectionType === 'alcohol'),
    both: createdSelections.filter((s) => s.selectionType === 'both'),
  };

  return NextResponse.json({
    success: true,
    poolSize,
    drugCount,
    alcoholCount,
    totalSelected: createdSelections.length,
    seedHash: composedSeedHash,
    selections: grouped,
  });
});
