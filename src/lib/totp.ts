/**
 * Two-factor authentication utilities using TOTP (RFC 6238).
 *
 * Uses:
 * - `otpauth` for TOTP secret generation/verification
 * - `qrcode` for QR code image generation (data URL)
 * - `bcrypt` for backup code hashing
 * - Node's `crypto.randomBytes` for backup code generation
 */

import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { decryptAtRest } from './crypto';

const TOTP_ISSUER = process.env.TOTP_ISSUER || 'TPAEngineX';
const TOTP_DIGITS = 6;
const TOTP_PERIOD = 30; // seconds
const TOTP_ALGORITHM = 'SHA1' as const; // RFC 6238 default, widely supported
const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_BYTES = 5; // 10-char hex strings

/**
 * Generate a new TOTP secret (base32 encoded).
 */
export function generateTotpSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

/**
 * Build the otpauth:// URI for QR code generation.
 * Scanned by Google Authenticator, 1Password, Authy, etc.
 */
export function buildTotpUri(secret: string, accountName: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label: accountName,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

/**
 * Generate a QR code as a data URL (PNG) from a TOTP secret.
 */
export async function generateTotpQrCode(secret: string, accountName: string): Promise<string> {
  const uri = buildTotpUri(secret, accountName);
  return QRCode.toDataURL(uri, {
    errorCorrectionLevel: 'M',
    width: 240,
    margin: 2,
  });
}

/**
 * Verify a user-submitted TOTP token against a stored secret.
 * Accepts tokens from the current period OR the adjacent ±1 period (clock skew tolerance).
 *
 * Accepts EITHER a plaintext base32 secret (from new setup flow before persistence)
 * OR a ciphertext from the encrypted-at-rest format (loaded from DB).
 */
export function verifyTotpToken(secretOrCiphertext: string, token: string): boolean {
  if (!/^\d{6}$/.test(token)) return false;

  // If the input looks like our ciphertext format, decrypt it first.
  // Otherwise treat as raw base32 secret (e.g., during initial setup verify).
  let secret: string;
  try {
    secret = secretOrCiphertext.includes('.')
      ? decryptAtRest(secretOrCiphertext)
      : secretOrCiphertext;
  } catch {
    // Tampered or corrupt ciphertext — fail closed
    return false;
  }

  if (!secret) return false;

  let totp: OTPAuth.TOTP;
  try {
    totp = new OTPAuth.TOTP({
      issuer: TOTP_ISSUER,
      algorithm: TOTP_ALGORITHM,
      digits: TOTP_DIGITS,
      period: TOTP_PERIOD,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
  } catch {
    // Invalid base32 — likely a decryption failure or corrupted secret
    return false;
  }

  // `window: 1` allows ±1 period of clock drift (30s before/after)
  const delta = totp.validate({ token, window: 1 });
  return delta !== null;
}

/**
 * Generate a new set of backup codes.
 * Returns the plaintext codes (to show the user ONCE) and their bcrypt hashes (to store).
 */
export async function generateBackupCodes(): Promise<{ codes: string[]; hashes: string[] }> {
  const codes: string[] = [];
  const hashes: string[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    // 10-char hex code, formatted as XXXXX-XXXXX for readability
    const raw = randomBytes(BACKUP_CODE_BYTES).toString('hex').toUpperCase();
    const formatted = `${raw.slice(0, 5)}-${raw.slice(5)}`;
    codes.push(formatted);

    // Hash each code individually (bcrypt is deliberately slow; 10 rounds is fine for backup codes)
    const hash = await bcrypt.hash(formatted, 10);
    hashes.push(hash);
  }

  return { codes, hashes };
}

/**
 * Check if a user-submitted backup code matches any of the provided hashes.
 * Returns the index of the matching hash, or -1 if no match.
 *
 * Callers are responsible for marking the matched code as used.
 */
export async function verifyBackupCode(submitted: string, hashes: string[]): Promise<number> {
  const normalized = submitted.trim().toUpperCase();
  for (let i = 0; i < hashes.length; i++) {
    if (await bcrypt.compare(normalized, hashes[i])) {
      return i;
    }
  }
  return -1;
}
