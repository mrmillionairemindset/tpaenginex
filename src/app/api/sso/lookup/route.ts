import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { ssoConnections } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Public lookup — given an email address, return whether an active SSO
 * connection exists whose allowed-domain list matches the email's domain.
 * Used by the signin page to route users to their IdP.
 *
 * This endpoint returns the tenant key but no PII — safe to call unauthenticated.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@')) {
    return NextResponse.json({ found: false });
  }
  const domain = email.split('@')[1];
  if (!domain) return NextResponse.json({ found: false });

  const active = await db.query.ssoConnections.findMany({
    where: eq(ssoConnections.isActive, true),
  });

  const match = active.find((c) =>
    (c.allowedEmailDomains ?? []).some((d) => d.toLowerCase() === domain)
  );

  if (!match) return NextResponse.json({ found: false });

  return NextResponse.json({
    found: true,
    tenant: match.jacksonTenant,
    name: match.name,
  });
}
