import { describe, it, expect } from 'vitest';
import { generateApiKey, hashApiKey, hasScope, ALL_API_SCOPES } from '../api-keys';

describe('generateApiKey', () => {
  it('returns a raw key with tpa_live_ prefix', () => {
    const { rawKey } = generateApiKey();
    expect(rawKey).toMatch(/^tpa_live_/);
    expect(rawKey.length).toBeGreaterThanOrEqual(30);
  });

  it('produces unique keys on each call', () => {
    const keys = new Set<string>();
    for (let i = 0; i < 50; i++) {
      keys.add(generateApiKey().rawKey);
    }
    expect(keys.size).toBe(50);
  });

  it('returns a SHA-256 hex hash', () => {
    const { keyHash } = generateApiKey();
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns a consistent 16-character prefix', () => {
    const { rawKey, keyPrefix } = generateApiKey();
    expect(keyPrefix).toBe(rawKey.slice(0, 16));
    expect(keyPrefix).toMatch(/^tpa_live_/);
  });

  it('hash matches hashApiKey of the raw key', () => {
    const { rawKey, keyHash } = generateApiKey();
    expect(hashApiKey(rawKey)).toBe(keyHash);
  });
});

describe('hashApiKey', () => {
  it('is deterministic', () => {
    const key = 'tpa_live_abc123';
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashApiKey('tpa_live_a')).not.toBe(hashApiKey('tpa_live_b'));
  });

  it('returns 64-char hex', () => {
    expect(hashApiKey('whatever')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('hasScope', () => {
  it('matches exact scopes', () => {
    expect(hasScope(['orders:read', 'persons:read'], 'orders:read')).toBe(true);
    expect(hasScope(['orders:read'], 'orders:write')).toBe(false);
  });

  it('supports resource wildcards (orders:*)', () => {
    expect(hasScope(['orders:*'], 'orders:read')).toBe(true);
    expect(hasScope(['orders:*'], 'orders:write')).toBe(true);
    expect(hasScope(['orders:*'], 'persons:read')).toBe(false);
  });

  it('supports global wildcard (*)', () => {
    expect(hasScope(['*'], 'orders:read')).toBe(true);
    expect(hasScope(['*'], 'dqf:write')).toBe(true);
  });

  it('returns false for empty grants', () => {
    expect(hasScope([], 'orders:read')).toBe(false);
  });

  it('does NOT grant write when only read is granted', () => {
    expect(hasScope(['orders:read'], 'orders:write')).toBe(false);
  });
});

describe('ALL_API_SCOPES', () => {
  it('contains all expected resource permissions', () => {
    expect(ALL_API_SCOPES).toContain('orders:read');
    expect(ALL_API_SCOPES).toContain('orders:write');
    expect(ALL_API_SCOPES).toContain('dqf:read');
    expect(ALL_API_SCOPES).toContain('dqf:write');
  });

  it('each scope follows resource:action format', () => {
    for (const scope of ALL_API_SCOPES) {
      expect(scope).toMatch(/^[a-z]+:(read|write)$/);
    }
  });
});
