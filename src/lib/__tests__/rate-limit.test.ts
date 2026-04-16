import { describe, it, expect } from 'vitest';
import { checkRateLimit } from '../rate-limit';

describe('checkRateLimit', () => {
  it('allows the first request', () => {
    const result = checkRateLimit('test-ip-1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it('tracks count per IP', () => {
    const ip = `test-ip-count-${Date.now()}`;
    const first = checkRateLimit(ip);
    const second = checkRateLimit(ip);
    expect(first.remaining - second.remaining).toBe(1);
  });

  it('different IPs have independent counters', () => {
    const ipA = `test-ip-a-${Date.now()}`;
    const ipB = `test-ip-b-${Date.now()}`;
    checkRateLimit(ipA);
    checkRateLimit(ipA);
    const resultB = checkRateLimit(ipB);
    // B should still have full quota
    expect(resultB.remaining).toBeGreaterThan(0);
  });

  it('denies after exceeding the limit', () => {
    const ip = `test-ip-exceed-${Date.now()}`;
    // Exhaust the limit (10 requests per minute per the implementation)
    for (let i = 0; i < 10; i++) {
      checkRateLimit(ip);
    }
    const blocked = checkRateLimit(ip);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAt).toBeGreaterThan(Date.now());
  });
});
