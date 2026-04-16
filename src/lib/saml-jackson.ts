/**
 * SAML / OIDC handled by @boxyhq/saml-jackson.
 *
 * Jackson is initialized once per process (singleton) and stores its own
 * connection records in Postgres (tables prefixed `jackson_*`). Our side
 * of the mapping — name, JIT settings, allowed domains — lives in our
 * `sso_connections` table.
 *
 * NOTE: This module is Node-only. Any route that imports it must declare
 * `export const runtime = 'nodejs'` to opt out of the Edge runtime.
 */

import type {
  IConnectionAPIController,
  IOAuthController,
  JacksonOption,
} from '@boxyhq/saml-jackson';

// Jackson's default export is an async factory. We require lazily so that
// edge-runtime bundles don't try to resolve the native bits transitively.
// eslint-disable-next-line @typescript-eslint/no-var-requires
type JacksonControllers = {
  apiController: IConnectionAPIController;
  oauthController: IOAuthController;
};

let jacksonPromise: Promise<JacksonControllers> | null = null;

export const SSO_PRODUCT = 'tpaenginex';

export function getExternalUrl(): string {
  // Jackson uses externalUrl to construct the ACS + metadata URLs presented
  // to IdPs. Must be a public, non-trailing-slash URL.
  const raw =
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

export async function getJackson(): Promise<JacksonControllers> {
  if (jacksonPromise) return jacksonPromise;

  jacksonPromise = (async () => {
    const externalUrl = getExternalUrl();

    const opts: JacksonOption = {
      externalUrl,
      samlAudience: externalUrl,
      samlPath: '/api/sso/saml/acs',
      oidcPath: '/api/sso/oidc/callback',
      idpEnabled: false, // We're always the SP, never the IdP.
      db: {
        engine: 'sql',
        type: 'postgres',
        url: process.env.DATABASE_URL!,
        ssl:
          process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=require')
            ? { rejectUnauthorized: false }
            : undefined,
      },
      noAnalytics: true,
    };

    // Dynamic import so webpack can split this out of edge bundles.
    const mod = await import('@boxyhq/saml-jackson');
    const factory = (mod as any).default as (o: JacksonOption) => Promise<any>;
    const ret = await factory(opts);

    return {
      apiController: ret.apiController as IConnectionAPIController,
      oauthController: ret.oauthController as IOAuthController,
    };
  })();

  return jacksonPromise;
}

/**
 * Reset the singleton — used in tests and after schema migrations.
 */
export function resetJackson() {
  jacksonPromise = null;
}
