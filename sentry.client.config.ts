/**
 * Sentry client-side config (runs in the browser).
 *
 * Tunnels through /monitoring to avoid ad-blockers blocking direct Sentry traffic.
 */

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,

    // Performance monitoring — lower sample rate in prod to keep costs in check
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

    // Session replay for error debugging — only capture on error in prod
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,

    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,         // HIPAA: never capture text content
        blockAllMedia: true,       // HIPAA: never capture images / PHI
        maskAllInputs: true,       // HIPAA: never capture form inputs
      }),
    ],

    // Scrub PII from events before sending
    beforeSend(event) {
      // Remove cookies and auth headers from request data
      if (event.request) {
        delete event.request.cookies;
        if (event.request.headers) {
          delete (event.request.headers as Record<string, unknown>).authorization;
          delete (event.request.headers as Record<string, unknown>).cookie;
        }
      }
      return event;
    },

    // Tag environment
    initialScope: {
      tags: {
        component: 'client',
      },
    },
  });
}
