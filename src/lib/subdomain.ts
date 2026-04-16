/**
 * Subdomain resolution for white-label TPA tenants.
 *
 * Resolves subdomains like jmti.tpaplatform.com → TPA org branding.
 * Used in middleware and the branded login page.
 */

import { db } from '@/db/client';
import { tpaSettings, organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

function getBaseDomain(): string {
  return process.env.BASE_DOMAIN || 'localhost:3000';
}

// Subdomains that are reserved and not tenant subdomains
const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'admin', 'platform', 'mail', 'smtp',
  'staging', 'dev', 'test', 'demo',
]);

export interface TenantBranding {
  tpaOrgId: string;
  orgName: string;
  brandName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  loginMessage: string | null;
}

/**
 * Extract subdomain from a hostname.
 * Returns null if no subdomain or if it's a reserved subdomain.
 */
export function extractSubdomain(hostname: string): string | null {
  // Remove port
  const host = hostname.split(':')[0];

  // localhost doesn't have subdomains in local dev — use query param instead
  if (host === 'localhost' || host === '127.0.0.1') {
    return null;
  }

  const baseDomainHost = getBaseDomain().split(':')[0];
  if (!host.endsWith(baseDomainHost)) {
    return null;
  }

  const subdomain = host.slice(0, -(baseDomainHost.length + 1)); // +1 for the dot
  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) {
    return null;
  }

  return subdomain;
}

/**
 * Resolve a subdomain to TPA tenant branding.
 * Returns null if no matching tenant.
 */
export async function resolveTenantBySubdomain(subdomain: string): Promise<TenantBranding | null> {
  const settings = await db.query.tpaSettings.findFirst({
    where: eq(tpaSettings.customDomain, subdomain),
    with: {
      tpaOrg: {
        columns: { id: true, name: true },
      },
    },
  });

  if (!settings || !settings.tpaOrg) return null;

  return {
    tpaOrgId: settings.tpaOrg.id,
    orgName: settings.tpaOrg.name,
    brandName: settings.brandName,
    logoUrl: settings.logoUrl,
    faviconUrl: settings.faviconUrl,
    primaryColor: settings.primaryColor,
    loginMessage: settings.loginMessage,
  };
}

/**
 * Resolve tenant branding by tpaOrgId (for authenticated sessions).
 */
export async function getTenantBranding(tpaOrgId: string): Promise<TenantBranding | null> {
  const settings = await db.query.tpaSettings.findFirst({
    where: eq(tpaSettings.tpaOrgId, tpaOrgId),
    with: {
      tpaOrg: {
        columns: { id: true, name: true },
      },
    },
  });

  if (!settings || !settings.tpaOrg) return null;

  return {
    tpaOrgId: settings.tpaOrg.id,
    orgName: settings.tpaOrg.name,
    brandName: settings.brandName,
    logoUrl: settings.logoUrl,
    faviconUrl: settings.faviconUrl,
    primaryColor: settings.primaryColor,
    loginMessage: settings.loginMessage,
  };
}
