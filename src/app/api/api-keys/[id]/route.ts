import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { apiKeys } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { ALL_API_SCOPES, type ApiKeyScope } from '@/lib/api-keys';
import { validateAllowlistEntry } from '@/lib/ip-allowlist';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const scopeEnum = z.enum(ALL_API_SCOPES as [ApiKeyScope, ...ApiKeyScope[]]);

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  scopes: z.array(scopeEnum).min(1).optional(),
  ipAllowlist: z
    .array(z.string().min(1))
    .max(50)
    .optional()
    .superRefine((list, ctx) => {
      if (!list) return;
      for (const entry of list) {
        if (!validateAllowlistEntry(entry)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Invalid IP or CIDR: ${entry}`,
          });
        }
      }
    }),
});

function canManage(role: string | null): boolean {
  return role === 'tpa_admin' || role === 'platform_admin';
}

function sanitize(row: typeof apiKeys.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: row.scopes,
    ipAllowlist: row.ipAllowlist,
    lastUsedAt: row.lastUsedAt,
    lastUsedIp: row.lastUsedIp,
    usageCount: row.usageCount,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}

export const PATCH = withAuth(async (req, user, ctx: { params: Promise<{ id: string }> }) => {
  if (!canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const { id } = await ctx.params;

  const existing = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.id, id), eq(apiKeys.tpaOrgId, user.tpaOrgId)),
  });
  if (!existing) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 });
  }
  if (existing.revokedAt) {
    return NextResponse.json(
      { error: 'Cannot modify a revoked key' },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 }
    );
  }

  const updateData: Partial<typeof apiKeys.$inferInsert> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.scopes !== undefined) updateData.scopes = parsed.data.scopes;
  if (parsed.data.ipAllowlist !== undefined) updateData.ipAllowlist = parsed.data.ipAllowlist;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ apiKey: sanitize(existing) });
  }

  const [updated] = await db
    .update(apiKeys)
    .set(updateData)
    .where(eq(apiKeys.id, id))
    .returning();

  await createAuditLog({
    tpaOrgId: user.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email,
    entityType: 'api_key',
    entityId: id,
    action: 'updated',
    diffJson: parsed.data,
  });

  return NextResponse.json({ apiKey: sanitize(updated) });
});

export const DELETE = withAuth(async (_req, user, ctx: { params: Promise<{ id: string }> }) => {
  if (!canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const { id } = await ctx.params;

  const existing = await db.query.apiKeys.findFirst({
    where: and(eq(apiKeys.id, id), eq(apiKeys.tpaOrgId, user.tpaOrgId)),
  });
  if (!existing) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 });
  }
  if (existing.revokedAt) {
    return NextResponse.json({ apiKey: sanitize(existing) });
  }

  const [updated] = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, id))
    .returning();

  await createAuditLog({
    tpaOrgId: user.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email,
    entityType: 'api_key',
    entityId: id,
    action: 'revoked',
    diffJson: { name: existing.name, keyPrefix: existing.keyPrefix },
  });

  return NextResponse.json({ apiKey: sanitize(updated) });
});
