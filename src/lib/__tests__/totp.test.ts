import { describe, it, expect } from 'vitest';
import {
  generateTotpSecret,
  buildTotpUri,
  verifyTotpToken,
  generateBackupCodes,
  verifyBackupCode,
} from '../totp';
import { encryptAtRest } from '../crypto';
import * as OTPAuth from 'otpauth';

function generateCurrentToken(secret: string): string {
  const totp = new OTPAuth.TOTP({
    secret: OTPAuth.Secret.fromBase32(secret),
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  });
  return totp.generate();
}

describe('generateTotpSecret', () => {
  it('returns a base32 string', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+=*$/);
    expect(secret.length).toBeGreaterThan(16);
  });

  it('returns different secrets each call', () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });
});

describe('buildTotpUri', () => {
  it('builds a valid otpauth:// URI', () => {
    const secret = generateTotpSecret();
    const uri = buildTotpUri(secret, 'user@example.com');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('user%40example.com');
    expect(uri).toContain(secret);
  });
});

describe('verifyTotpToken', () => {
  it('accepts a valid current token', () => {
    const secret = generateTotpSecret();
    const token = generateCurrentToken(secret);
    expect(verifyTotpToken(secret, token)).toBe(true);
  });

  it('rejects an incorrect token', () => {
    const secret = generateTotpSecret();
    expect(verifyTotpToken(secret, '000000')).toBe(false);
  });

  it('rejects non-6-digit input', () => {
    const secret = generateTotpSecret();
    expect(verifyTotpToken(secret, '12345')).toBe(false);
    expect(verifyTotpToken(secret, 'abcdef')).toBe(false);
    expect(verifyTotpToken(secret, '1234567')).toBe(false);
    expect(verifyTotpToken(secret, '')).toBe(false);
  });

  it('accepts an encrypted-at-rest secret (integration with crypto)', () => {
    const secret = generateTotpSecret();
    const encrypted = encryptAtRest(secret);
    const token = generateCurrentToken(secret);
    // verifyTotpToken auto-detects and decrypts
    expect(verifyTotpToken(encrypted, token)).toBe(true);
  });

  it('returns false when ciphertext cannot be decrypted', () => {
    // Ciphertext format but with garbage content
    const fakeCipher = 'AAAAAAAAAAAAAAAAAA==.BBBBBBBBBBBBBBBBBBBBBB==.CCCC';
    expect(verifyTotpToken(fakeCipher, '123456')).toBe(false);
  });
});

describe('generateBackupCodes', () => {
  it('returns 10 codes and 10 hashes', async () => {
    const { codes, hashes } = await generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(hashes).toHaveLength(10);
  });

  it('returns formatted codes like XXXXX-XXXXX', async () => {
    const { codes } = await generateBackupCodes();
    for (const code of codes) {
      expect(code).toMatch(/^[0-9A-F]{5}-[0-9A-F]{5}$/);
    }
  });

  it('returns unique codes', async () => {
    const { codes } = await generateBackupCodes();
    const unique = new Set(codes);
    expect(unique.size).toBe(10);
  });

  it('returns bcrypt hashes (starts with $2)', async () => {
    const { hashes } = await generateBackupCodes();
    for (const h of hashes) {
      expect(h).toMatch(/^\$2[ab]\$/);
    }
  });
});

describe('verifyBackupCode', () => {
  it('returns the matching index for a valid code', async () => {
    const { codes, hashes } = await generateBackupCodes();
    const idx = await verifyBackupCode(codes[3], hashes);
    expect(idx).toBe(3);
  });

  it('returns -1 for an unknown code', async () => {
    const { hashes } = await generateBackupCodes();
    const idx = await verifyBackupCode('AAAAA-BBBBB', hashes);
    expect(idx).toBe(-1);
  });

  it('is case-insensitive for user input (normalizes to uppercase)', async () => {
    const { codes, hashes } = await generateBackupCodes();
    const lower = codes[0].toLowerCase();
    const idx = await verifyBackupCode(lower, hashes);
    expect(idx).toBe(0);
  });

  it('trims whitespace from user input', async () => {
    const { codes, hashes } = await generateBackupCodes();
    const padded = `  ${codes[2]}  `;
    const idx = await verifyBackupCode(padded, hashes);
    expect(idx).toBe(2);
  });
});
