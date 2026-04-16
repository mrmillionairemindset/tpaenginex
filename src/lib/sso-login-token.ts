/**
 * Short-lived one-time login tokens used to bridge the SAML ACS endpoint
 * to the NextAuth Credentials-based `sso` provider.
 *
 * Flow:
 *   1. ACS endpoint verifies the SAML response via Jackson, extracts the
 *      user profile, calls `issueSsoLoginToken()` → raw token.
 *   2. Browser is redirected to `/auth/sso-callback?token=<raw>`.
 *   3. Client calls `signIn('sso', { token })`.
 *   4. NextAuth `authorize()` calls `consumeSsoLoginToken()` which atomically
 *      marks the row consumed and returns the profile.
 */

import { db } from '@/db/client';
import { ssoLoginTokens } from '@/db/schema';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';

const TOKEN_TTL_MS = 2 * 60 * 1000; // 2 minutes — enough for a redirect round-trip

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export interface IssueTokenParams {
  tpaOrgId: string;
  connectionId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export async function issueSsoLoginToken(params: IssueTokenParams): Promise<string> {
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db.insert(ssoLoginTokens).values({
    tokenHash,
    tpaOrgId: params.tpaOrgId,
    connectionId: params.connectionId,
    email: params.email.toLowerCase(),
    firstName: params.firstName ?? null,
    lastName: params.lastName ?? null,
    expiresAt,
  });

  return rawToken;
}

export interface ConsumedSsoToken {
  tpaOrgId: string;
  connectionId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

/**
 * Atomically consume a one-time login token. Returns null if not found,
 * already consumed, or expired.
 */
export async function consumeSsoLoginToken(rawToken: string): Promise<ConsumedSsoToken | null> {
  if (!rawToken) return null;
  const tokenHash = sha256Hex(rawToken);
  const now = new Date();

  // Use a conditional UPDATE ... RETURNING for atomicity.
  const [row] = await db
    .update(ssoLoginTokens)
    .set({ consumedAt: now })
    .where(
      and(
        eq(ssoLoginTokens.tokenHash, tokenHash),
        isNull(ssoLoginTokens.consumedAt),
        gt(ssoLoginTokens.expiresAt, now)
      )
    )
    .returning();

  if (!row) return null;

  return {
    tpaOrgId: row.tpaOrgId,
    connectionId: row.connectionId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
  };
}

/**
 * Garbage-collect expired/consumed tokens older than 24h.
 * Safe to call opportunistically from any route.
 */
export async function cleanupStaleSsoLoginTokens(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  try {
    await db.delete(ssoLoginTokens).where(lt(ssoLoginTokens.createdAt, cutoff));
  } catch (err) {
    console.error('cleanupStaleSsoLoginTokens failed:', err);
  }
}
