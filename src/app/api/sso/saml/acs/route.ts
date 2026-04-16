import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { ssoConnections } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getJackson, getExternalUrl } from '@/lib/saml-jackson';
import { issueSsoLoginToken, cleanupStaleSsoLoginTokens } from '@/lib/sso-login-token';
import { logLoginEvent, getClientIp, getClientUserAgent } from '@/lib/auth-security';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * SAML Assertion Consumer Service (ACS) endpoint.
 *
 * The IdP POSTs a base64-encoded SAMLResponse here after the user authenticates.
 * Jackson validates the signature and certificate, then returns a redirect URL
 * to a code-exchange endpoint. We intercept that code, exchange it for a user
 * profile, issue our own one-time login token, and redirect the browser to the
 * SSO callback page which finalizes the NextAuth session.
 */
export async function POST(req: Request) {
  const ipAddress = getClientIp(req.headers);
  const userAgent = getClientUserAgent(req.headers);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected form-encoded SAMLResponse' }, { status: 400 });
  }

  const SAMLResponse = formData.get('SAMLResponse');
  const RelayState = (formData.get('RelayState') as string | null) ?? '';

  if (typeof SAMLResponse !== 'string' || !SAMLResponse) {
    return NextResponse.json({ error: 'Missing SAMLResponse' }, { status: 400 });
  }

  const { oauthController } = await getJackson();

  let samlRes: Awaited<ReturnType<typeof oauthController.samlResponse>>;
  try {
    samlRes = await oauthController.samlResponse({
      SAMLResponse,
      RelayState,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid SAML response';
    await logLoginEvent({
      email: 'unknown',
      event: 'sso_login_failed',
      ipAddress,
      userAgent,
      metadata: { reason: 'saml_verification_failed', detail: msg.slice(0, 200) },
    });
    return NextResponse.json({ error: 'SAML verification failed' }, { status: 400 });
  }

  if (samlRes.error) {
    return NextResponse.json({ error: samlRes.error }, { status: 400 });
  }

  const redirectUrl = samlRes.redirect_url;
  if (!redirectUrl) {
    return NextResponse.json({ error: 'Jackson did not return a redirect URL' }, { status: 500 });
  }

  // The redirect URL Jackson hands back is the `redirect_uri` we registered,
  // with ?code=...&state=... appended. Parse out the code and exchange for profile.
  const u = new URL(redirectUrl);
  const code = u.searchParams.get('code');
  if (!code) {
    // Jackson is telling the browser to finish elsewhere — honor it.
    return NextResponse.redirect(redirectUrl, 302);
  }

  let tokenRes;
  try {
    tokenRes = await oauthController.token({
      code,
      grant_type: 'authorization_code',
      redirect_uri: `${getExternalUrl()}/auth/sso-callback`,
      client_id: 'dummy',
      client_secret: 'dummy',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Code exchange failed';
    await logLoginEvent({
      email: 'unknown',
      event: 'sso_login_failed',
      ipAddress,
      userAgent,
      metadata: { reason: 'token_exchange_failed', detail: msg.slice(0, 200) },
    });
    return NextResponse.json({ error: 'SSO code exchange failed' }, { status: 400 });
  }

  let profile;
  try {
    profile = await oauthController.userInfo(tokenRes.access_token);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'userInfo failed';
    await logLoginEvent({
      email: 'unknown',
      event: 'sso_login_failed',
      ipAddress,
      userAgent,
      metadata: { reason: 'userinfo_failed', detail: msg.slice(0, 200) },
    });
    return NextResponse.json({ error: 'Failed to load user profile' }, { status: 400 });
  }

  if (!profile?.email) {
    return NextResponse.json({ error: 'IdP did not return an email address' }, { status: 400 });
  }

  // Look up our SSO connection record via the tenant + product encoded in the profile.
  // Jackson exposes these on `profile.requested` (the authorize() params it received).
  const requested = (profile.requested ?? {}) as Record<string, string>;
  const jTenant = requested.tenant;
  const jProduct = requested.product;

  if (!jTenant || !jProduct) {
    return NextResponse.json({ error: 'Missing tenant context in profile' }, { status: 400 });
  }

  const connection = await db.query.ssoConnections.findFirst({
    where: and(
      eq(ssoConnections.jacksonTenant, jTenant),
      eq(ssoConnections.jacksonProduct, jProduct)
    ),
  });

  if (!connection || !connection.isActive) {
    await logLoginEvent({
      email: profile.email,
      event: 'sso_login_failed',
      ipAddress,
      userAgent,
      metadata: { reason: 'connection_not_found_or_inactive' },
    });
    return NextResponse.json({ error: 'SSO connection not found or inactive' }, { status: 400 });
  }

  const oneTimeToken = await issueSsoLoginToken({
    tpaOrgId: connection.tpaOrgId,
    connectionId: connection.id,
    email: profile.email,
    firstName: profile.firstName ?? null,
    lastName: profile.lastName ?? null,
  });

  // Opportunistic cleanup — cheap and keeps the table small.
  cleanupStaleSsoLoginTokens().catch(() => {});

  const callbackUrl = new URL('/auth/sso-callback', getExternalUrl());
  callbackUrl.searchParams.set('token', oneTimeToken);
  const redirectTarget = connection.defaultRedirectUrl || '/dashboard';
  callbackUrl.searchParams.set('callbackUrl', redirectTarget);

  return NextResponse.redirect(callbackUrl.toString(), 302);
}

// Some IdPs send an HTTP-Redirect binding on GET for test probes. Reject clearly.
export function GET() {
  return NextResponse.json(
    { error: 'ACS endpoint accepts POST only (HTTP-POST binding)' },
    { status: 405 }
  );
}
