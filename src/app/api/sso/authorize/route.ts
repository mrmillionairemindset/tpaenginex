import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { ssoConnections, organizations } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getJackson, getExternalUrl } from '@/lib/saml-jackson';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Entry point to begin SSO login. Accepts a `tenant` query parameter that is
 * one of:
 *   - a TPA org id (uuid)
 *   - a TPA org slug
 *   - a subdomain configured in tpa_settings
 *
 * Redirects the browser to the IdP's SSO URL as computed by Jackson.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tenantParam = searchParams.get('tenant')?.trim();
  const emailParam = searchParams.get('email')?.trim().toLowerCase();

  if (!tenantParam && !emailParam) {
    return NextResponse.json(
      { error: 'Missing `tenant` or `email` query parameter' },
      { status: 400 }
    );
  }

  // Resolve tenant identifier → TPA org → SSO connection
  let connection: typeof ssoConnections.$inferSelect | undefined;

  if (tenantParam) {
    // First try direct match against jacksonTenant (which equals tpaOrgId)
    connection = await db.query.ssoConnections.findFirst({
      where: and(
        eq(ssoConnections.jacksonTenant, tenantParam),
        eq(ssoConnections.isActive, true)
      ),
    });

    // Fall back: treat param as org slug
    if (!connection) {
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.slug, tenantParam),
      });
      if (org) {
        connection = await db.query.ssoConnections.findFirst({
          where: and(
            eq(ssoConnections.tpaOrgId, org.id),
            eq(ssoConnections.isActive, true)
          ),
        });
      }
    }
  }

  if (!connection && emailParam) {
    // Resolve by email domain → any active connection whose allowlist contains it.
    const domain = emailParam.split('@')[1]?.toLowerCase();
    if (domain) {
      const allActive = await db.query.ssoConnections.findMany({
        where: eq(ssoConnections.isActive, true),
      });
      connection = allActive.find((c) =>
        (c.allowedEmailDomains ?? []).some((d) => d.toLowerCase() === domain)
      );
    }
  }

  if (!connection) {
    return NextResponse.json(
      { error: 'No active SSO connection found for this tenant' },
      { status: 404 }
    );
  }

  const { oauthController } = await getJackson();
  const externalUrl = getExternalUrl();

  // Jackson's authorize() returns the IdP redirect URL. We use the tenant+product
  // variant (no real client_id — Jackson treats 'dummy' as a sentinel).
  const resp = await oauthController.authorize({
    tenant: connection.jacksonTenant,
    product: connection.jacksonProduct,
    client_id: 'dummy',
    redirect_uri: `${externalUrl}/auth/sso-callback`,
    state: randomBytes(16).toString('base64url'),
    response_type: 'code',
    code_challenge: '',
    code_challenge_method: '',
  });

  if (resp.error) {
    return NextResponse.json({ error: resp.error }, { status: 400 });
  }

  if (resp.redirect_url) {
    return NextResponse.redirect(resp.redirect_url, 302);
  }
  if (resp.authorize_form) {
    // IdP requires an HTML auto-submit form (less common)
    return new NextResponse(resp.authorize_form, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return NextResponse.json({ error: 'Unexpected authorize response' }, { status: 500 });
}
