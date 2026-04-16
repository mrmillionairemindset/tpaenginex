import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/auth/api-middleware';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import {
  clearCheckrCredentials,
  getCheckrCredentialsStatus,
  saveCheckrCredentials,
} from '@/lib/checkr-credentials';

export const dynamic = 'force-dynamic';

const saveSchema = z.object({
  apiKey: z.string().min(1),
  webhookSecret: z.string().min(1),
  defaultNode: z.string().optional(),
});

// GET — status only. NEVER returns secret values.
export const GET = withAdminAuth(async (_req, user) => {
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }
  const status = await getCheckrCredentialsStatus(user.tpaOrgId);
  return NextResponse.json(status);
});

// POST — save encrypted credentials
export const POST = withAdminAuth(async (req, user) => {
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 },
    );
  }

  try {
    await saveCheckrCredentials(user.tpaOrgId, parsed.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save credentials';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  await createAuditLog({
    tpaOrgId: user.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'tenant_module_config',
    entityId: 'background_screening',
    action: 'checkr_credentials_saved',
    // Do NOT include secret values in diffJson.
    diffJson: { defaultNode: parsed.data.defaultNode ?? null, hasApiKey: true, hasWebhookSecret: true },
  });

  return NextResponse.json({ ok: true });
});

// DELETE — clear credentials
export const DELETE = withAdminAuth(async (_req, user) => {
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }
  await clearCheckrCredentials(user.tpaOrgId);

  await createAuditLog({
    tpaOrgId: user.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'tenant_module_config',
    entityId: 'background_screening',
    action: 'checkr_credentials_cleared',
    diffJson: {},
  });

  return NextResponse.json({ ok: true });
});
