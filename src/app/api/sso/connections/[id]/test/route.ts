import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { ssoConnections } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';
import { getJackson } from '@/lib/saml-jackson';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function canManage(role: string | null): boolean {
  return role === 'tpa_admin' || role === 'platform_admin';
}

export const POST = withAuth(async (_req, user, ctx: { params: Promise<{ id: string }> }) => {
  if (!canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const { id } = await ctx.params;
  const conn = await db.query.ssoConnections.findFirst({
    where: and(eq(ssoConnections.id, id), eq(ssoConnections.tpaOrgId, user.tpaOrgId)),
  });
  if (!conn) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Ask Jackson for the connection — confirms our record and Jackson's agree
  // and that the metadata is valid (Jackson parses/validates at lookup).
  try {
    const { apiController } = await getJackson();
    const existing = await apiController.getConnections({
      tenant: conn.jacksonTenant,
      product: conn.jacksonProduct,
    });

    if (!existing || existing.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No SAML connection registered with Jackson for this tenant.' },
        { status: 400 }
      );
    }

    await db
      .update(ssoConnections)
      .set({ lastVerifiedAt: new Date() })
      .where(eq(ssoConnections.id, id));

    await createAuditLog({
      tpaOrgId: user.tpaOrgId,
      actorUserId: user.id,
      actorEmail: user.email,
      entityType: 'sso_connection',
      entityId: id,
      action: 'tested',
    });

    return NextResponse.json({
      ok: true,
      verifiedAt: new Date().toISOString(),
      connectionCount: existing.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
});
