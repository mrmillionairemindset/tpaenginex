import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { ssoConnections } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { getJackson, SSO_PRODUCT, getExternalUrl } from '@/lib/saml-jackson';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const roleEnum = z.enum(['tpa_admin', 'tpa_staff', 'tpa_records', 'tpa_billing', 'client_admin']);

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  idpMetadataXml: z.string().min(1).nullable().optional(),
  idpMetadataUrl: z.string().url().nullable().optional(),
  defaultRedirectUrl: z.string().url().max(500).nullable().optional(),
  jitProvisioningEnabled: z.boolean().optional(),
  defaultRoleForJit: roleEnum.optional(),
  allowedEmailDomains: z.array(z.string().min(1).max(253)).optional(),
  isActive: z.boolean().optional(),
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
    acsUrl: `${externalUrl}/api/sso/saml/acs`,
    spEntityId: externalUrl,
    loginUrl: `${externalUrl}/api/sso/authorize?tenant=${row.jacksonTenant}`,
  };
}

export const GET = withAuth(async (_req, user, ctx: { params: Promise<{ id: string }> }) => {
  if (!canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }
  const { id } = await ctx.params;
  const row = await db.query.ssoConnections.findFirst({
    where: and(eq(ssoConnections.id, id), eq(ssoConnections.tpaOrgId, user.tpaOrgId)),
  });
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(sanitize(row));
});

export const PATCH = withAuth(async (req, user, ctx: { params: Promise<{ id: string }> }) => {
  if (!canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

  const existing = await db.query.ssoConnections.findFirst({
    where: and(eq(ssoConnections.id, id), eq(ssoConnections.tpaOrgId, user.tpaOrgId)),
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // If metadata is being replaced, re-register with Jackson.
  if (parsed.data.idpMetadataXml || parsed.data.idpMetadataUrl) {
    const { apiController } = await getJackson();
    try {
      if (parsed.data.idpMetadataXml) {
        await apiController.createSAMLConnection({
          tenant: existing.jacksonTenant,
          product: existing.jacksonProduct,
          rawMetadata: parsed.data.idpMetadataXml,
          defaultRedirectUrl:
            parsed.data.defaultRedirectUrl || existing.defaultRedirectUrl || `${getExternalUrl()}/dashboard`,
          redirectUrl: JSON.stringify([`${getExternalUrl()}/auth/sso-callback`]),
        });
      } else if (parsed.data.idpMetadataUrl) {
        await apiController.createSAMLConnection({
          tenant: existing.jacksonTenant,
          product: existing.jacksonProduct,
          metadataUrl: parsed.data.idpMetadataUrl,
          defaultRedirectUrl:
            parsed.data.defaultRedirectUrl || existing.defaultRedirectUrl || `${getExternalUrl()}/dashboard`,
          redirectUrl: JSON.stringify([`${getExternalUrl()}/auth/sso-callback`]),
        } as any);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid IdP metadata';
      return NextResponse.json(
        { error: 'Failed to update SAML connection', detail: msg },
        { status: 400 }
      );
    }
  }

  const updates: Partial<typeof ssoConnections.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.idpMetadataXml !== undefined) updates.idpMetadataXml = parsed.data.idpMetadataXml;
  if (parsed.data.idpMetadataUrl !== undefined) updates.idpMetadataUrl = parsed.data.idpMetadataUrl;
  if (parsed.data.defaultRedirectUrl !== undefined) updates.defaultRedirectUrl = parsed.data.defaultRedirectUrl;
  if (parsed.data.jitProvisioningEnabled !== undefined) updates.jitProvisioningEnabled = parsed.data.jitProvisioningEnabled;
  if (parsed.data.defaultRoleForJit !== undefined) updates.defaultRoleForJit = parsed.data.defaultRoleForJit;
  if (parsed.data.allowedEmailDomains !== undefined) updates.allowedEmailDomains = parsed.data.allowedEmailDomains;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  const [updated] = await db
    .update(ssoConnections)
    .set(updates)
    .where(and(eq(ssoConnections.id, id), eq(ssoConnections.tpaOrgId, user.tpaOrgId)))
    .returning();

  await createAuditLog({
    tpaOrgId: user.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email,
    entityType: 'sso_connection',
    entityId: id,
    action: 'updated',
    diffJson: { fields: Object.keys(parsed.data) },
  });

  return NextResponse.json(sanitize(updated));
});

export const DELETE = withAuth(async (_req, user, ctx: { params: Promise<{ id: string }> }) => {
  if (!canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const { id } = await ctx.params;
  const existing = await db.query.ssoConnections.findFirst({
    where: and(eq(ssoConnections.id, id), eq(ssoConnections.tpaOrgId, user.tpaOrgId)),
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Tell Jackson to remove its connection records.
  try {
    const { apiController } = await getJackson();
    await apiController.deleteConnections({
      tenant: existing.jacksonTenant,
      product: existing.jacksonProduct,
    });
  } catch (err) {
    // Not fatal — we still want to remove our own record.
    console.error('Jackson deleteConnections failed:', err);
  }

  await db
    .delete(ssoConnections)
    .where(and(eq(ssoConnections.id, id), eq(ssoConnections.tpaOrgId, user.tpaOrgId)));

  await createAuditLog({
    tpaOrgId: user.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email,
    entityType: 'sso_connection',
    entityId: id,
    action: 'deleted',
    diffJson: { name: existing.name },
  });

  return NextResponse.json({ ok: true });
});
