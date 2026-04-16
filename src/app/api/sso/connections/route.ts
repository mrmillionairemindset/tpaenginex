import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { ssoConnections } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { getJackson, SSO_PRODUCT, getExternalUrl } from '@/lib/saml-jackson';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const roleEnum = z.enum(['tpa_admin', 'tpa_staff', 'tpa_records', 'tpa_billing', 'client_admin']);

const createSchema = z
  .object({
    name: z.string().min(1).max(200),
    provider: z.enum(['saml']).default('saml'),
    idpMetadataXml: z.string().min(1).optional(),
    idpMetadataUrl: z.string().url().optional(),
    defaultRedirectUrl: z.string().url().max(500).optional(),
    jitProvisioningEnabled: z.boolean().default(true),
    defaultRoleForJit: roleEnum.default('tpa_staff'),
    allowedEmailDomains: z.array(z.string().min(1).max(253)).default([]),
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.idpMetadataXml || d.idpMetadataUrl, {
    message: 'Either idpMetadataXml or idpMetadataUrl is required',
  });

function canManage(role: string | null): boolean {
  return role === 'tpa_admin' || role === 'platform_admin';
}

function sanitize(row: typeof ssoConnections.$inferSelect) {
  const externalUrl = getExternalUrl();
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    jitProvisioningEnabled: row.jitProvisioningEnabled,
    defaultRoleForJit: row.defaultRoleForJit,
    allowedEmailDomains: row.allowedEmailDomains,
    defaultRedirectUrl: row.defaultRedirectUrl,
    isActive: row.isActive,
    lastVerifiedAt: row.lastVerifiedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // Service-provider coordinates the TPA admin needs to hand to their IdP:
    acsUrl: `${externalUrl}/api/sso/saml/acs`,
    spEntityId: externalUrl,
    loginUrl: `${externalUrl}/api/sso/authorize?tenant=${row.jacksonTenant}`,
  };
}

export const GET = withAuth(async (_req, user) => {
  if (!canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const rows = await db.query.ssoConnections.findMany({
    where: eq(ssoConnections.tpaOrgId, user.tpaOrgId),
    orderBy: [desc(ssoConnections.createdAt)],
  });

  return NextResponse.json({ connections: rows.map(sanitize) });
});

export const POST = withAuth(async (req, user) => {
  if (!canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const tenantKey = user.tpaOrgId;

  // Register the connection with Jackson first — it validates the IdP metadata.
  const { apiController } = await getJackson();
  try {
    if (parsed.data.idpMetadataXml) {
      await apiController.createSAMLConnection({
        tenant: tenantKey,
        product: SSO_PRODUCT,
        rawMetadata: parsed.data.idpMetadataXml,
        defaultRedirectUrl:
          parsed.data.defaultRedirectUrl || `${getExternalUrl()}/dashboard`,
        redirectUrl: JSON.stringify([`${getExternalUrl()}/auth/sso-callback`]),
      });
    } else if (parsed.data.idpMetadataUrl) {
      await apiController.createSAMLConnection({
        tenant: tenantKey,
        product: SSO_PRODUCT,
        metadataUrl: parsed.data.idpMetadataUrl,
        defaultRedirectUrl:
          parsed.data.defaultRedirectUrl || `${getExternalUrl()}/dashboard`,
        redirectUrl: JSON.stringify([`${getExternalUrl()}/auth/sso-callback`]),
      } as any);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Invalid IdP metadata';
    return NextResponse.json(
      { error: 'Failed to register SAML connection', detail: msg },
      { status: 400 }
    );
  }

  const [inserted] = await db
    .insert(ssoConnections)
    .values({
      tpaOrgId: user.tpaOrgId,
      name: parsed.data.name,
      provider: parsed.data.provider,
      jacksonTenant: tenantKey,
      jacksonProduct: SSO_PRODUCT,
      idpMetadataXml: parsed.data.idpMetadataXml ?? null,
      idpMetadataUrl: parsed.data.idpMetadataUrl ?? null,
      defaultRedirectUrl: parsed.data.defaultRedirectUrl ?? null,
      jitProvisioningEnabled: parsed.data.jitProvisioningEnabled,
      defaultRoleForJit: parsed.data.defaultRoleForJit,
      allowedEmailDomains: parsed.data.allowedEmailDomains,
      isActive: parsed.data.isActive,
      createdBy: user.id,
    })
    .returning();

  await createAuditLog({
    tpaOrgId: user.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email,
    entityType: 'sso_connection',
    entityId: inserted.id,
    action: 'created',
    diffJson: {
      name: parsed.data.name,
      provider: parsed.data.provider,
      jitProvisioningEnabled: parsed.data.jitProvisioningEnabled,
      defaultRoleForJit: parsed.data.defaultRoleForJit,
      allowedEmailDomains: parsed.data.allowedEmailDomains,
    },
  });

  return NextResponse.json(sanitize(inserted), { status: 201 });
});
