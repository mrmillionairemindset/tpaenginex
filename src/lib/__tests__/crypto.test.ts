import { describe, it, expect } from 'vitest';
import { encryptAtRest, decryptAtRest, isEncrypted } from '../crypto';

describe('encryptAtRest / decryptAtRest', () => {
  it('roundtrips a plaintext string', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP'; // sample TOTP secret format
    const ciphertext = encryptAtRest(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decryptAtRest(ciphertext)).toBe(plaintext);
  });

  it('produces different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'same-input';
    const ct1 = encryptAtRest(plaintext);
    const ct2 = encryptAtRest(plaintext);
    expect(ct1).not.toBe(ct2);
    expect(decryptAtRest(ct1)).toBe(plaintext);
    expect(decryptAtRest(ct2)).toBe(plaintext);
  });

  it('passes through null and undefined unchanged', () => {
    expect(encryptAtRest(null)).toBe(null);
    expect(encryptAtRest(undefined)).toBe(undefined);
    expect(decryptAtRest(null)).toBe(null);
    expect(decryptAtRest(undefined)).toBe(undefined);
  });

  it('passes through empty strings unchanged', () => {
    expect(encryptAtRest('')).toBe('');
    expect(decryptAtRest('')).toBe('');
  });

  it('returns legacy plaintext unchanged when given non-ciphertext', () => {
    // A value not in our ciphertext format should pass through (migration support)
    expect(decryptAtRest('legacy-plaintext-no-dots')).toBe('legacy-plaintext-no-dots');
  });

  it('throws on tampered ciphertext', () => {
    const plaintext = 'sensitive-data';
    const ciphertext = encryptAtRest(plaintext);
    const parts = ciphertext.split('.');
    // Flip one character in the ciphertext portion
    const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -1)}X`;
    expect(() => decryptAtRest(tampered)).toThrow();
  });

  it('throws on tampered auth tag', () => {
    const plaintext = 'sensitive-data';
    const ciphertext = encryptAtRest(plaintext);
    const parts = ciphertext.split('.');
    const tampered = `${parts[0]}.${parts[1].slice(0, -2)}AA.${parts[2]}`;
    expect(() => decryptAtRest(tampered)).toThrow();
  });

  it('handles unicode / multi-byte characters', () => {
    const plaintext = '日本語 — 🔒 secret';
    expect(decryptAtRest(encryptAtRest(plaintext))).toBe(plaintext);
  });

  it('handles large plaintexts', () => {
    const plaintext = 'x'.repeat(10_000);
    expect(decryptAtRest(encryptAtRest(plaintext))).toBe(plaintext);
  });
});

describe('isEncrypted', () => {
  it('detects ciphertext format', () => {
    expect(isEncrypted(encryptAtRest('hello'))).toBe(true);
  });

  it('rejects plaintext', () => {
    expect(isEncrypted('plain-value')).toBe(false);
    expect(isEncrypted('a.b.c')).toBe(false); // 3 parts but wrong sizes
  });

  it('rejects null / empty', () => {
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(undefined)).toBe(false);
    expect(isEncrypted('')).toBe(false);
  });
});
