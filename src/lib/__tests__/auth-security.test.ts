import { describe, it, expect } from 'vitest';
import {
  generateSecureToken,
  verifyTokenHash,
  tokenExpiryDates,
  sha256Hex,
  getClientIp,
  getClientUserAgent,
} from '../auth-security';

describe('generateSecureToken', () => {
  it('returns a token and matching hash', async () => {
    const { token, hash } = await generateSecureToken();
    expect(token).toBeTruthy();
    expect(hash).toBeTruthy();
    expect(hash).toMatch(/^\$2[ab]\$/); // bcrypt format
  });

  it('produces unique tokens', async () => {
    const a = await generateSecureToken();
    const b = await generateSecureToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
  });

  it('tokens are URL-safe base64 (no + / =)', async () => {
    const { token } = await generateSecureToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('tokens have sufficient entropy (32 bytes = ~43 url-safe chars)', async () => {
    const { token } = await generateSecureToken();
    expect(token.length).toBeGreaterThanOrEqual(42);
  });
});

describe('verifyTokenHash', () => {
  it('matches a correct token', async () => {
    const { token, hash } = await generateSecureToken();
    expect(await verifyTokenHash(token, hash)).toBe(true);
  });

  it('rejects an incorrect token', async () => {
    const { hash } = await generateSecureToken();
    expect(await verifyTokenHash('wrong-token', hash)).toBe(false);
  });

  it('rejects empty input', async () => {
    const { hash } = await generateSecureToken();
    expect(await verifyTokenHash('', hash)).toBe(false);
  });
});

describe('tokenExpiryDates', () => {
  it('returns password reset expiry ~1 hour in the future', () => {
    const { passwordResetExpiresAt } = tokenExpiryDates();
    const diffMs = passwordResetExpiresAt.getTime() - Date.now();
    expect(diffMs).toBeGreaterThan(59 * 60 * 1000);
    expect(diffMs).toBeLessThan(61 * 60 * 1000);
  });

  it('returns email verification expiry ~24 hours in the future', () => {
    const { emailVerificationExpiresAt } = tokenExpiryDates();
    const diffMs = emailVerificationExpiresAt.getTime() - Date.now();
    expect(diffMs).toBeGreaterThan(23.9 * 60 * 60 * 1000);
    expect(diffMs).toBeLessThan(24.1 * 60 * 60 * 1000);
  });
});

describe('sha256Hex', () => {
  it('produces deterministic hex output', () => {
    expect(sha256Hex('hello')).toBe(sha256Hex('hello'));
  });

  it('produces different outputs for different inputs', () => {
    expect(sha256Hex('a')).not.toBe(sha256Hex('b'));
  });

  it('produces 64-character hex strings', () => {
    const hash = sha256Hex('test');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('getClientIp', () => {
  it('reads x-forwarded-for, first entry', () => {
    const h = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
    expect(getClientIp(h)).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip', () => {
    const h = new Headers({ 'x-real-ip': '10.0.0.1' });
    expect(getClientIp(h)).toBe('10.0.0.1');
  });

  it('prefers x-forwarded-for over x-real-ip', () => {
    const h = new Headers({
      'x-forwarded-for': '1.2.3.4',
      'x-real-ip': '5.6.7.8',
    });
    expect(getClientIp(h)).toBe('1.2.3.4');
  });

  it('returns null when no IP headers present', () => {
    expect(getClientIp(new Headers())).toBe(null);
  });

  it('trims whitespace from x-forwarded-for', () => {
    const h = new Headers({ 'x-forwarded-for': '  1.2.3.4  , 5.6.7.8' });
    expect(getClientIp(h)).toBe('1.2.3.4');
  });
});

describe('getClientUserAgent', () => {
  it('returns the user-agent header', () => {
    const h = new Headers({ 'user-agent': 'Mozilla/5.0' });
    expect(getClientUserAgent(h)).toBe('Mozilla/5.0');
  });

  it('returns null when header missing', () => {
    expect(getClientUserAgent(new Headers())).toBe(null);
  });
});
