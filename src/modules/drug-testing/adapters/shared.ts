/**
 * Shared utilities for drug testing lab adapters.
 *
 * All adapters use the same HMAC-SHA256 webhook verification pattern
 * with timing-safe comparison.
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';

const log = logger.child({ component: 'lab-adapter' });

/**
 * Verify an HMAC-SHA256 signature using timing-safe comparison.
 * Used by all lab adapter webhook handlers.
 *
 * @param rawBody  - The raw request body string
 * @param secret   - The webhook secret for this tenant+adapter
 * @param signature - The signature header value
 * @param prefix   - Optional prefix to strip (e.g., "sha256=")
 */
export function verifyHmacSignature(
  rawBody: string,
  secret: string,
  signature: string,
  prefix = '',
): boolean {
  if (!secret || !signature) return false;

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  let provided = signature.trim();

  // Strip prefix if present (e.g., "sha256=" or "v1=")
  if (prefix && provided.startsWith(prefix)) {
    provided = provided.slice(prefix.length);
  }

  if (expected.length !== provided.length) return false;

  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
  } catch {
    return false;
  }
}

/**
 * Standard HTTP request helper for adapter live clients.
 * Handles timeout, error classification, and structured logging.
 */
export interface AdapterRequestResult<T> {
  ok: boolean;
  data?: T;
  status?: number;
  errorCode?: 'auth' | 'not_found' | 'rate_limited' | 'validation' | 'server' | 'network' | 'timeout';
  errorMessage?: string;
}

export async function adapterRequest<T>(params: {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  adapterId: string;
}): Promise<AdapterRequestResult<T>> {
  const { url, method, headers, body, adapterId } = params;
  const timeoutMs = params.timeoutMs ?? 30_000;

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...headers,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ac.signal,
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, errorCode: 'auth', errorMessage: `${adapterId}: authentication rejected (HTTP ${res.status})` };
    }
    if (res.status === 404) {
      return { ok: false, status: 404, errorCode: 'not_found', errorMessage: `${adapterId}: not found` };
    }
    if (res.status === 429) {
      return { ok: false, status: 429, errorCode: 'rate_limited', errorMessage: `${adapterId}: rate limited` };
    }
    if (res.status >= 500) {
      return { ok: false, status: res.status, errorCode: 'server', errorMessage: `${adapterId}: server error (HTTP ${res.status})` };
    }
    if (res.status >= 400) {
      const text = await res.text();
      return { ok: false, status: res.status, errorCode: 'validation', errorMessage: `${adapterId}: validation error — ${text.slice(0, 500)}` };
    }

    const data = (await res.json()) as T;
    return { ok: true, data, status: res.status };
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      return { ok: false, errorCode: 'timeout', errorMessage: `${adapterId}: timeout after ${timeoutMs}ms` };
    }
    const message = err instanceof Error ? err.message : String(err);
    log.error({ err: message, adapterId, url: url.replace(/\/\/.*@/, '//***@') }, 'adapter request failed');
    return { ok: false, errorCode: 'network', errorMessage: `${adapterId}: ${message}` };
  } finally {
    clearTimeout(timer);
  }
}
