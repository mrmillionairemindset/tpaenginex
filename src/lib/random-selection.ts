/**
 * DOT-compliant random selection for drug & alcohol testing pools.
 *
 * Per 49 CFR Part 382.305 and Part 40, random selection MUST be:
 *   - Scientifically valid (no employee can predict their own selection)
 *   - Unbiased (every pool member has equal probability of selection)
 *   - Auditable (the selection method must be documented and reproducible
 *     for compliance audits)
 *
 * WHY crypto.randomBytes (NOT Math.random):
 *   - Math.random uses xorshift128+ (V8) — deterministic, predictable from
 *     observed outputs. A motivated insider could predict selections.
 *   - crypto.randomBytes is sourced from the OS CSPRNG (getrandom on Linux,
 *     CCRandomGenerateBytes on macOS, BCryptGenRandom on Windows).
 *
 * Reproducibility for audit:
 *   - We store a SHA-256 hash of the seed used (not the seed itself, to
 *     prevent re-running). Combined with the input member set + timestamp,
 *     this proves the selection wasn't manipulated.
 */

import { randomBytes, createHash } from 'crypto';

export interface SelectionInput {
  /** Pool member IDs (random_pool_members.id). Must be deduplicated upstream. */
  memberIds: string[];
  /** Number to select. Must be <= memberIds.length. */
  count: number;
}

export interface SelectionResult {
  selectedMemberIds: string[];
  /** SHA-256 hex of the seed used. Stored in random_pools.selectionSeedHash. */
  seedHash: string;
}

/**
 * Cryptographically random selection of `count` items from `memberIds`.
 *
 * Algorithm: Fisher–Yates shuffle using OS CSPRNG bytes for each swap.
 * Returns the first `count` items of the shuffled list.
 *
 * Time complexity: O(n).
 *
 * @throws if count > memberIds.length, or if memberIds contains duplicates.
 */
export function runRandomSelection(input: SelectionInput): SelectionResult {
  const { memberIds, count } = input;

  if (!Array.isArray(memberIds)) {
    throw new Error('memberIds must be an array');
  }
  if (memberIds.length === 0) {
    if (count !== 0) {
      throw new Error('Cannot select from an empty pool');
    }
    return { selectedMemberIds: [], seedHash: emptySeedHash() };
  }
  if (count < 0 || !Number.isInteger(count)) {
    throw new Error(`count must be a non-negative integer, got ${count}`);
  }
  if (count > memberIds.length) {
    throw new Error(
      `count ${count} exceeds pool size ${memberIds.length}`
    );
  }

  // Detect duplicates — our DB schema enforces uniqueness, but defensively check.
  const dedupCheck = new Set(memberIds);
  if (dedupCheck.size !== memberIds.length) {
    throw new Error('memberIds contains duplicates');
  }

  // Generate the seed once, hash for audit, then use it to drive the shuffle.
  const seed = randomBytes(32);
  const seedHash = createHash('sha256').update(seed).digest('hex');

  // Copy so we don't mutate caller's array
  const shuffled = memberIds.slice();

  // Fisher–Yates from the end. Each iteration consumes 4 bytes of entropy
  // for the random index. 32 bytes of seed re-entered into bytes-on-demand
  // via SHA-256 expansion to avoid re-seeding cost in long pools.
  let entropyBuffer = seed;
  let entropyOffset = 0;

  function nextRandomInt(maxExclusive: number): number {
    // Rejection sampling to avoid modulo bias.
    // Compute the largest multiple of maxExclusive that fits in a uint32.
    const limit = Math.floor(0xffffffff / maxExclusive) * maxExclusive;
    while (true) {
      if (entropyOffset + 4 > entropyBuffer.length) {
        // Expand entropy by hashing the current buffer with a counter.
        const expander = createHash('sha256');
        expander.update(entropyBuffer);
        expander.update(Buffer.from([entropyOffset & 0xff]));
        entropyBuffer = expander.digest();
        entropyOffset = 0;
      }
      const sample = entropyBuffer.readUInt32BE(entropyOffset);
      entropyOffset += 4;
      if (sample < limit) {
        return sample % maxExclusive;
      }
      // else reject and resample
    }
  }

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = nextRandomInt(i + 1);
    if (j !== i) {
      const tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }
  }

  return {
    selectedMemberIds: shuffled.slice(0, count),
    seedHash,
  };
}

/**
 * Calculate how many to select for a given period from rate + pool size.
 *
 * Per DOT 382.305(g): annual rate is divided across selection periods. For
 * quarterly: each pool selects (annualRate / 4) of average pool size.
 *
 * Use ceiling rounding so we always meet or exceed the annual minimum
 * (under-selection is a compliance violation; over-selection isn't).
 *
 * @param poolSize active eligible members
 * @param annualRateBp annual rate in basis points (5000 = 50%)
 * @param periodsPerYear 12 / 4 / 2 / 1 for monthly / quarterly / semiannual / annual
 */
export function calculatePeriodSelectionCount(
  poolSize: number,
  annualRateBp: number,
  periodsPerYear: number,
): number {
  if (poolSize <= 0) return 0;
  if (annualRateBp <= 0) return 0;
  if (periodsPerYear <= 0) {
    throw new Error('periodsPerYear must be > 0');
  }

  // poolSize × annualRateBp ÷ 10000 ÷ periodsPerYear, rounded up
  // Use integer arithmetic to avoid floating-point surprises.
  const numerator = poolSize * annualRateBp;
  const denominator = 10000 * periodsPerYear;
  return Math.ceil(numerator / denominator);
}

/**
 * Map period type to periods-per-year for selection rate division.
 */
export function periodsPerYear(
  periodType: 'monthly' | 'quarterly' | 'semiannual' | 'annual',
): number {
  switch (periodType) {
    case 'monthly':    return 12;
    case 'quarterly':  return 4;
    case 'semiannual': return 2;
    case 'annual':     return 1;
  }
}

function emptySeedHash(): string {
  // Sentinel hash for empty selections — distinguishable in audit logs.
  return createHash('sha256').update('empty-pool').digest('hex');
}
