import { Job } from 'bullmq';
import { db } from '@/db/client';
import {
  randomPools,
  randomPoolMembers,
  randomPrograms,
  tenantModules,
} from '@/db/schema';
import { eq, and, lt, ne, sql } from 'drizzle-orm';

export interface RandomPeriodRolloverData {
  tpaOrgId?: string; // If omitted, runs for all drug_testing tenants
}

/**
 * Daily cron. For programs with pools whose periodEndsAt is past:
 *   1. Close out-of-date pools (status != 'closed') → status='closed'
 *   2. Auto-create the next period's pool with the same eligibility list carried over
 *
 * Next period length is derived from the program's periodType:
 *   monthly / quarterly / semiannual / annual
 */
function computeNextPeriod(
  lastEnd: Date,
  periodType: 'monthly' | 'quarterly' | 'semiannual' | 'annual',
): { start: Date; end: Date } {
  const start = new Date(lastEnd);
  const end = new Date(lastEnd);
  switch (periodType) {
    case 'monthly':
      end.setMonth(end.getMonth() + 1);
      break;
    case 'quarterly':
      end.setMonth(end.getMonth() + 3);
      break;
    case 'semiannual':
      end.setMonth(end.getMonth() + 6);
      break;
    case 'annual':
      end.setFullYear(end.getFullYear() + 1);
      break;
  }
  return { start, end };
}

export async function handleRandomPeriodRollover(job: Job<RandomPeriodRolloverData>) {
  const { tpaOrgId } = job.data || {};

  const tenants = await db.query.tenantModules.findMany({
    where: and(
      eq(tenantModules.moduleId, 'drug_testing'),
      eq(tenantModules.isEnabled, true),
      ...(tpaOrgId ? [eq(tenantModules.tpaOrgId, tpaOrgId)] : []),
    ),
  });

  if (tenants.length === 0) {
    console.log('[random-period-rollover] No tenants with drug_testing enabled — skipping');
    return;
  }

  const now = new Date();
  let closedCount = 0;
  let createdCount = 0;

  for (const tenant of tenants) {
    // Find expired pools (period ended, status != 'closed')
    const expired = await db.query.randomPools.findMany({
      where: and(
        eq(randomPools.tpaOrgId, tenant.tpaOrgId),
        lt(randomPools.periodEndsAt, now),
        ne(randomPools.status, 'closed'),
      ),
      with: { program: true },
    });

    for (const pool of expired) {
      // Only roll over if the program is still active
      if (!pool.program.isActive) {
        await db
          .update(randomPools)
          .set({ status: 'closed', updatedAt: new Date() })
          .where(eq(randomPools.id, pool.id));
        closedCount++;
        continue;
      }

      // Close the expired pool
      await db
        .update(randomPools)
        .set({ status: 'closed', updatedAt: new Date() })
        .where(eq(randomPools.id, pool.id));
      closedCount++;

      // Compute next period from this pool's end
      const { start: nextStart, end: nextEnd } = computeNextPeriod(
        new Date(pool.periodEndsAt),
        pool.program.periodType,
      );

      // Skip if a pool for this program+period already exists (idempotent rollover)
      const existing = await db.query.randomPools.findFirst({
        where: and(
          eq(randomPools.programId, pool.programId),
          eq(randomPools.periodStartsAt, nextStart),
        ),
      });
      if (existing) continue;

      // Create next pool
      const [newPool] = await db
        .insert(randomPools)
        .values({
          programId: pool.programId,
          tpaOrgId: pool.tpaOrgId,
          periodStartsAt: nextStart,
          periodEndsAt: nextEnd,
          status: 'open',
        })
        .returning();

      // Carry over ACTIVE members from the closed pool
      const activeMembers = await db.query.randomPoolMembers.findMany({
        where: and(
          eq(randomPoolMembers.poolId, pool.id),
          eq(randomPoolMembers.eligibilityStatus, 'active'),
        ),
        columns: { personId: true },
      });

      if (activeMembers.length > 0) {
        await db.insert(randomPoolMembers).values(
          activeMembers.map((m) => ({
            poolId: newPool.id,
            personId: m.personId,
          })),
        );
        await db
          .update(randomPools)
          .set({ totalEligible: activeMembers.length, updatedAt: new Date() })
          .where(eq(randomPools.id, newPool.id));
      }

      createdCount++;
      console.log(
        `[random-period-rollover] Rolled over pool ${pool.id} → ${newPool.id} (${activeMembers.length} members)`,
      );
    }
  }

  console.log(
    `[random-period-rollover] Done. Closed ${closedCount}, created ${createdCount}`,
  );
  return { closedCount, createdCount };
}
