/**
 * Sentry server-side config (Node.js runtime — API routes + server components).
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Scrub sensitive data from events
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete (event.request.headers as Record<string, unknown>).authorization;
          delete (event.request.headers as Record<string, unknown>).cookie;
          delete (event.request.headers as Record<string, unknown>)['x-api-key'];
        }
        // Redact request body fields that may contain secrets
        if (event.request.data && typeof event.request.data === 'object') {
          const data = event.request.data as Record<string, unknown>;
          for (const key of ['password', 'newPassword', 'token', 'totpToken', 'backupCode', 'secret', 'apiKey']) {
            if (key in data) data[key] = '[REDACTED]';
          }
        }
      }
      return event;
    },

    initialScope: {
      tags: {
        component: 'server',
      },
    },
  });
}
