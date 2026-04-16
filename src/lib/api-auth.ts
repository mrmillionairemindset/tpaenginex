/**
 * API-key authentication middleware for M2M integrations.
 *
 * Usage:
 *   export const GET = withApiKey('orders:read', async (req, ctx) => { ... });
 *   // or low-level:
 *   const auth = await authenticateApiRequest(req);
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiKeyDetailed,
  hasScope,
  logApiKeyUsage,
  type ApiKeyScope,
} from './api-keys';

export type ApiKeyContext = {
  tpaOrgId: string;
  scopes: string[];
  apiKeyId: string;
};

function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  );
}

/**
 * Extract and validate an API key from the `Authorization: Bearer <key>` header.
 * Returns the TPA context + granted scopes, or null if missing/invalid.
 *
 * For detailed failure reasons (ip_blocked vs expired vs not_found), use
 * {@link authenticateApiRequestDetailed}.
 */
export async function authenticateApiRequest(req: NextRequest): Promise<ApiKeyContext | null> {
  const result = await authenticateApiRequestDetailed(req);
  return result.ok
    ? { tpaOrgId: result.tpaOrgId, scopes: result.scopes, apiKeyId: result.id }
    : null;
}

export async function authenticateApiRequestDetailed(req: NextRequest) {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header) return { ok: false as const, reason: 'invalid_format' as const };

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return { ok: false as const, reason: 'invalid_format' as const };

  const rawKey = match[1].trim();
  if (!rawKey) return { ok: false as const, reason: 'invalid_format' as const };

  const ip = getClientIp(req);
  return authenticateApiKeyDetailed(rawKey, ip);
}

/**
 * Wrap a route handler to require a valid API key with a specific scope.
 * Logs every authenticated request (status, duration, IP, UA) for analytics.
 */
export function withApiKey(
  requiredScope: ApiKeyScope,
  handler: (req: NextRequest, ctx: ApiKeyContext, routeCtx?: any) => Promise<Response>
) {
  return async (req: NextRequest, routeCtx?: any) => {
    const startedAt = Date.now();
    const auth = await authenticateApiRequestDetailed(req);

    const ip = getClientIp(req);
    const userAgent = req.headers.get('user-agent');
    const path = new URL(req.url).pathname;

    if (!auth.ok) {
      const status =
        auth.reason === 'ip_blocked' ? 403 :
        auth.reason === 'expired' || auth.reason === 'revoked' ? 401 :
        401;
      const message =
        auth.reason === 'ip_blocked' ? 'Forbidden: request IP not in allowlist' :
        auth.reason === 'expired' ? 'Unauthorized: API key expired' :
        auth.reason === 'revoked' ? 'Unauthorized: API key revoked' :
        'Unauthorized: valid API key required in Authorization: Bearer header';

      // Log failed auth attempt if we know which key it was (for abuse detection)
      if (auth.keyId && auth.tpaOrgId) {
        logApiKeyUsage({
          apiKeyId: auth.keyId,
          tpaOrgId: auth.tpaOrgId,
          method: req.method,
          path,
          statusCode: status,
          ipAddress: ip,
          userAgent,
          durationMs: Date.now() - startedAt,
          errorMessage: auth.reason,
        }).catch(() => {});
      }

      return NextResponse.json({ error: message }, { status });
    }

    if (!hasScope(auth.scopes, requiredScope)) {
      logApiKeyUsage({
        apiKeyId: auth.id,
        tpaOrgId: auth.tpaOrgId,
        method: req.method,
        path,
        statusCode: 403,
        ipAddress: ip,
        userAgent,
        durationMs: Date.now() - startedAt,
        errorMessage: `missing_scope:${requiredScope}`,
      }).catch(() => {});

      return NextResponse.json(
        { error: 'Forbidden: API key missing required scope', required: requiredScope },
        { status: 403 }
      );
    }

    // Execute handler, then log outcome
    let response: Response;
    let errorMessage: string | undefined;
    try {
      response = await handler(
        req,
        { tpaOrgId: auth.tpaOrgId, scopes: auth.scopes, apiKeyId: auth.id },
        routeCtx
      );
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Unknown error';
      response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    logApiKeyUsage({
      apiKeyId: auth.id,
      tpaOrgId: auth.tpaOrgId,
      method: req.method,
      path,
      statusCode: response.status,
      ipAddress: ip,
      userAgent,
      durationMs: Date.now() - startedAt,
      errorMessage,
    }).catch(() => {});

    return response;
  };
}
