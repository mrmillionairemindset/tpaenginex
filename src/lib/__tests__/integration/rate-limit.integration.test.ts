/**
 * Integration-style tests for the rate limiter using the in-memory path.
 *
 * We're specifically verifying:
 *  - Sliding/fixed window rolls correctly across the boundary
 *  - Limit enforcement holds across many concurrent calls
 *  - Two separate call sites sharing the same identifier share the counter
 *    (simulating two "instances" coordinating through the in-memory store)
 *
 * Redis-backed behaviour is not exercised here — that would need a second
 * container and is covered by unit tests with a mocked redis client.
 */

import { describe, it, expect } from 'vitest';
import { randomBytes } from 'crypto';
import { checkRateLimit } from '@/lib/rate-limit';

describe('rate-limit integration (in-memory)', () => {
  // Each test uses a unique identifier to avoid cross-test contamination
  // (the in-memory store is module-global and persists across tests).
  const nextId = () => `rl-int-${randomBytes(8).toString('hex')}`;

  it('allows up to `max` requests then blocks', () => {
    const id = nextId();
    const max = 5;
    const results = [];
    for (let i = 0; i < max + 3; i++) {
      results.push(checkRateLimit(id, { max, windowMs: 60_000 }));
    }
    const allowed = results.filter((r) => r.allowed).length;
    const blocked = results.filter((r) => !r.allowed).length;
    expect(allowed).toBe(max);
    expect(blocked).toBe(3);
  });

  it('decrements `remaining` on each call', () => {
    const id = nextId();
    const max = 4;
    const r1 = checkRateLimit(id, { max, windowMs: 60_000 });
    const r2 = checkRateLimit(id, { max, windowMs: 60_000 });
    const r3 = checkRateLimit(id, { max, windowMs: 60_000 });
    expect(r1.remaining).toBe(3);
    expect(r2.remaining).toBe(2);
    expect(r3.remaining).toBe(1);
  });

  it('rolls the window after resetAt passes', async () => {
    const id = nextId();
    const max = 2;
    const windowMs = 150;

    expect(checkRateLimit(id, { max, windowMs }).allowed).toBe(true);
    expect(checkRateLimit(id, { max, windowMs }).allowed).toBe(true);
    expect(checkRateLimit(id, { max, windowMs }).allowed).toBe(false);

    // Wait for window to expire
    await new Promise((r) => setTimeout(r, windowMs + 50));

    const next = checkRateLimit(id, { max, windowMs });
    expect(next.allowed).toBe(true);
    expect(next.remaining).toBe(max - 1);
  });

  it('enforces the limit across many concurrent calls (simulated two-instance)', async () => {
    const id = nextId();
    const max = 10;
    const totalCalls = 40;

    // Two "instances" firing 20 concurrent calls each, sharing the same identifier.
    const instanceA = Promise.all(
      Array.from({ length: totalCalls / 2 }, () =>
        Promise.resolve().then(() => checkRateLimit(id, { max, windowMs: 60_000 })),
      ),
    );
    const instanceB = Promise.all(
      Array.from({ length: totalCalls / 2 }, () =>
        Promise.resolve().then(() => checkRateLimit(id, { max, windowMs: 60_000 })),
      ),
    );

    const [a, b] = await Promise.all([instanceA, instanceB]);
    const allResults = [...a, ...b];
    const allowed = allResults.filter((r) => r.allowed).length;
    expect(allowed).toBe(max);
    expect(allResults.length - allowed).toBe(totalCalls - max);
  });

  it('isolates limits per identifier', () => {
    const idA = nextId();
    const idB = nextId();
    const max = 2;
    for (let i = 0; i < max; i++) checkRateLimit(idA, { max, windowMs: 60_000 });
    expect(checkRateLimit(idA, { max, windowMs: 60_000 }).allowed).toBe(false);
    // Different identifier is unaffected
    expect(checkRateLimit(idB, { max, windowMs: 60_000 }).allowed).toBe(true);
  });
});
