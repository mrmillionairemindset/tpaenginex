/**
 * Next.js instrumentation hook — loads before any request is served.
 * Required for Sentry server/edge initialization in Next 14+.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}

export const onRequestError = async (
  err: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string>;
  },
  context: {
    routerKind: string;
    routePath: string;
    routeType: string;
  }
) => {
  // Report server/client errors to Sentry via the dynamic captureRequestError helper
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureRequestError(err, request, context);
  } catch {
    // Sentry not installed / DSN not set — swallow
  }
};
