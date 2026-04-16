import { describe, it, expect } from 'vitest';
import {
  runRandomSelection,
  calculatePeriodSelectionCount,
  periodsPerYear,
} from '../random-selection';

describe('runRandomSelection', () => {
  it('selects the requested count', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`);
    const result = runRandomSelection({ memberIds: ids, count: 25 });
    expect(result.selectedMemberIds).toHaveLength(25);
  });

  it('returns unique selections (no duplicates within result)', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `id-${i}`);
    const result = runRandomSelection({ memberIds: ids, count: 30 });
    const set = new Set(result.selectedMemberIds);
    expect(set.size).toBe(30);
  });

  it('returns a valid SHA-256 hex seed hash (audit trail)', () => {
    const result = runRandomSelection({ memberIds: ['a', 'b', 'c'], count: 1 });
    expect(result.seedHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different selections on each call (randomness)', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`);
    const r1 = runRandomSelection({ memberIds: ids, count: 10 });
    const r2 = runRandomSelection({ memberIds: ids, count: 10 });
    // Astronomically unlikely to be identical with cryptographic RNG
    expect(r1.selectedMemberIds).not.toEqual(r2.selectedMemberIds);
    expect(r1.seedHash).not.toBe(r2.seedHash);
  });

  it('handles count=0 correctly', () => {
    const result = runRandomSelection({ memberIds: ['a', 'b'], count: 0 });
    expect(result.selectedMemberIds).toEqual([]);
  });

  it('handles empty pool with count=0', () => {
    const result = runRandomSelection({ memberIds: [], count: 0 });
    expect(result.selectedMemberIds).toEqual([]);
    expect(result.seedHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles count = pool size (selects everyone)', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const result = runRandomSelection({ memberIds: ids, count: 5 });
    expect(result.selectedMemberIds.sort()).toEqual([...ids].sort());
  });

  it('throws when count exceeds pool size', () => {
    expect(() =>
      runRandomSelection({ memberIds: ['a', 'b'], count: 5 })
    ).toThrow(/exceeds pool size/);
  });

  it('throws on empty pool with non-zero count', () => {
    expect(() => runRandomSelection({ memberIds: [], count: 1 })).toThrow(
      /empty pool/
    );
  });

  it('throws on negative count', () => {
    expect(() =>
      runRandomSelection({ memberIds: ['a'], count: -1 })
    ).toThrow(/non-negative integer/);
  });

  it('throws on non-integer count', () => {
    expect(() =>
      runRandomSelection({ memberIds: ['a', 'b'], count: 1.5 })
    ).toThrow(/non-negative integer/);
  });

  it('throws on duplicate member IDs (defense in depth)', () => {
    expect(() =>
      runRandomSelection({ memberIds: ['a', 'b', 'a'], count: 1 })
    ).toThrow(/duplicates/);
  });

  it('does not mutate the input array', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const copy = [...ids];
    runRandomSelection({ memberIds: ids, count: 2 });
    expect(ids).toEqual(copy);
  });

  it('selections are subset of input', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `id-${i}`);
    const result = runRandomSelection({ memberIds: ids, count: 5 });
    for (const selected of result.selectedMemberIds) {
      expect(ids).toContain(selected);
    }
  });

  // Statistical fairness: over many trials, every member should be selected
  // approximately the expected number of times. 2-sigma tolerance.
  it('produces statistically uniform selection over many trials', () => {
    const POOL_SIZE = 20;
    const SELECT = 5;
    const TRIALS = 5000;
    const ids = Array.from({ length: POOL_SIZE }, (_, i) => `id-${i}`);
    const counts = new Map<string, number>(ids.map((id) => [id, 0]));

    for (let t = 0; t < TRIALS; t++) {
      const result = runRandomSelection({ memberIds: ids, count: SELECT });
      for (const id of result.selectedMemberIds) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }

    // Expected: each id selected (TRIALS × SELECT / POOL_SIZE) = 1250 times.
    // Standard deviation: sqrt(TRIALS × p × (1-p)) where p = SELECT/POOL_SIZE = 0.25
    //   = sqrt(5000 × 0.25 × 0.75) ≈ 30.6
    // We require all counts within 4 sigma (~122) of expected — extremely
    // permissive, would only fail on truly biased RNG.
    const expected = (TRIALS * SELECT) / POOL_SIZE;
    const tolerance = 122;
    for (const [id, c] of counts) {
      expect(Math.abs(c - expected)).toBeLessThan(tolerance);
    }
  });
});

describe('calculatePeriodSelectionCount', () => {
  it('returns 0 for empty pool', () => {
    expect(calculatePeriodSelectionCount(0, 5000, 4)).toBe(0);
  });

  it('returns 0 for zero rate', () => {
    expect(calculatePeriodSelectionCount(100, 0, 4)).toBe(0);
  });

  it('calculates DOT FMCSA quarterly drug rate (50% annual)', () => {
    // 100 employees × 50% = 50/year ÷ 4 quarters = 12.5/quarter → 13 (ceil)
    expect(calculatePeriodSelectionCount(100, 5000, 4)).toBe(13);
  });

  it('calculates DOT FMCSA quarterly alcohol rate (10% annual)', () => {
    // 100 × 10% / 4 = 2.5 → 3 (ceil)
    expect(calculatePeriodSelectionCount(100, 1000, 4)).toBe(3);
  });

  it('calculates monthly selection (annual / 12)', () => {
    // 1200 × 50% / 12 = 50/month
    expect(calculatePeriodSelectionCount(1200, 5000, 12)).toBe(50);
  });

  it('always rounds up (ceiling) to never under-select', () => {
    // 1 × 50% / 4 = 0.125 → MUST be 1, not 0
    expect(calculatePeriodSelectionCount(1, 5000, 4)).toBe(1);
  });

  it('annual period selects full annual count', () => {
    expect(calculatePeriodSelectionCount(200, 5000, 1)).toBe(100);
  });

  it('handles rates above 100% (unusual but valid for catch-up)', () => {
    expect(calculatePeriodSelectionCount(100, 12000, 4)).toBe(30); // 100 × 120% / 4
  });

  it('throws on zero or negative periodsPerYear', () => {
    expect(() => calculatePeriodSelectionCount(100, 5000, 0)).toThrow();
    expect(() => calculatePeriodSelectionCount(100, 5000, -1)).toThrow();
  });
});

describe('periodsPerYear', () => {
  it('maps each period type correctly', () => {
    expect(periodsPerYear('monthly')).toBe(12);
    expect(periodsPerYear('quarterly')).toBe(4);
    expect(periodsPerYear('semiannual')).toBe(2);
    expect(periodsPerYear('annual')).toBe(1);
  });
});
