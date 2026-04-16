/**
 * Application-level encryption for sensitive data at rest.
 *
 * Uses AES-256-GCM (authenticated encryption) with a key derived from
 * APP_ENCRYPTION_KEY via scrypt. Each encryption operation uses a fresh
 * random IV, and the auth tag is appended to detect tampering.
 *
 * Ciphertext format (all base64):
 *   {iv(12)}.{authTag(16)}.{ciphertext}
 *
 * Env:
 *   APP_ENCRYPTION_KEY — 32+ character secret. In production this MUST be set
 *     and MUST NOT change (changing it makes existing ciphertexts unreadable).
 *     Rotate by double-encrypting: decrypt with old key, encrypt with new.
 */

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // GCM recommended IV size
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits
const SCRYPT_SALT = 'tpaengx-at-rest-v1'; // salt for KDF — tied to this app's encryption scheme

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const secret = process.env.APP_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error(
      'APP_ENCRYPTION_KEY env var must be set to at least 32 characters. ' +
        'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }

  // Derive a 32-byte key from the secret using scrypt. Cached for reuse.
  cachedKey = scryptSync(secret, SCRYPT_SALT, KEY_LENGTH);
  return cachedKey;
}

/**
 * Encrypt a plaintext string. Returns the ciphertext in our custom format.
 * Safe to call with null/undefined — returns the same (useful for nullable columns).
 */
export function encryptAtRest(plaintext: string): string;
export function encryptAtRest(plaintext: null): null;
export function encryptAtRest(plaintext: undefined): undefined;
export function encryptAtRest(plaintext: string | null | undefined): string | null | undefined {
  if (plaintext === null) return null;
  if (plaintext === undefined) return undefined;
  if (plaintext === '') return '';

  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${authTag.toString('base64')}.${ciphertext.toString('base64')}`;
}

/**
 * Decrypt a ciphertext produced by encryptAtRest. Throws if the ciphertext is
 * tampered or the key is wrong.
 */
export function decryptAtRest(ciphertext: string): string;
export function decryptAtRest(ciphertext: null): null;
export function decryptAtRest(ciphertext: undefined): undefined;
export function decryptAtRest(ciphertext: string | null | undefined): string | null | undefined {
  if (ciphertext === null) return null;
  if (ciphertext === undefined) return undefined;
  if (ciphertext === '') return '';

  const parts = ciphertext.split('.');
  if (parts.length !== 3) {
    // Not our format — likely legacy plaintext data. Return as-is to allow
    // gradual migration; callers can detect and re-encrypt.
    return ciphertext;
  }

  const [ivB64, authTagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error('Invalid ciphertext format');
  }

  const key = getKey();
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ct), decipher.final()]);
  return plaintext.toString('utf8');
}

/**
 * Detect whether a value looks like our ciphertext format.
 * Useful for migration scripts to identify legacy plaintext rows.
 */
export function isEncrypted(value: string | null | undefined): boolean {
  if (!value) return false;
  const parts = value.split('.');
  if (parts.length !== 3) return false;
  try {
    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    return iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}
