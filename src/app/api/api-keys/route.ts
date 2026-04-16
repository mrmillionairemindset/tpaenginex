import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { apiKeys } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { generateApiKey, ALL_API_SCOPES, type ApiKeyScope } from '@/lib/api-keys';
import { validateAllowlistEntry } from '@/lib/ip-allowlist';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const scopeEnum = z.enum(ALL_API_SCOPES as [ApiKeyScope, ...ApiKeyScope[]]);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  scopes: z.array(scopeEnum).min(1, 'Select at least one scope'),
  expiresInDays: z.number().int().positive().max(3650).nullable().optional(),
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

export const GET = withAuth(async (_req, user) => {
  if (!canManage(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user.tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const rows = await db.query.apiKeys.findMany({
    where: eq(apiKeys.tpaOrgId, user.tpaOrgId),
    orderBy: [desc(apiKeys.createdAt)],
  });

  return NextResponse.json({ apiKeys: rows.map(sanitize) });
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

  const { name, scopes, expiresInDays, ipAllowlist } = parsed.data;
  const { rawKey, keyHash, keyPrefix } = generateApiKey();

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const [inserted] = await db
    .insert(apiKeys)
    .values({
      tpaOrgId: user.tpaOrgId,
      createdBy: user.id,
      name,
      keyHash,
      keyPrefix,
      scopes,
      ipAllowlist: ipAllowlist ?? [],
      expiresAt,
    })
    .returning();

  await createAuditLog({
    tpaOrgId: user.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email,
    entityType: 'api_key',
    entityId: inserted.id,
    action: 'created',
    diffJson: { name, scopes, keyPrefix, expiresAt, ipAllowlist: ipAllowlist ?? [] },
  });

  return NextResponse.json(
    {
      ...sanitize(inserted),
      key: rawKey, // returned ONCE — client must save
      message: 'Save this key — you will not be able to view it again.',
    },
    { status: 201 }
  );
});
