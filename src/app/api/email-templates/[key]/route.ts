import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { emailTemplates } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { and, eq } from 'drizzle-orm';
import { AVAILABLE_TEMPLATE_KEYS } from '@/lib/email-template-keys';

export const dynamic = 'force-dynamic';

const VALID_KEYS = new Set(AVAILABLE_TEMPLATE_KEYS.map((t) => t.key));

async function requireTpaAdmin() {
  const user = await getCurrentUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    return { error: NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 }) };
  }
  if (!user.tpaOrgId) {
    return { error: NextResponse.json({ error: 'TPA context required' }, { status: 400 }) };
  }
  return { user, tpaOrgId: user.tpaOrgId };
}

// GET /api/email-templates/[key] — get template by key (null if not customized)
export async function GET(_req: NextRequest, { params }: { params: { key: string } }) {
  const auth = await requireTpaAdmin();
  if ('error' in auth) return auth.error;

  const { key } = params;
  if (!VALID_KEYS.has(key)) {
    return NextResponse.json({ error: 'Invalid templateKey' }, { status: 400 });
  }

  const template = await db.query.emailTemplates.findFirst({
    where: and(
      eq(emailTemplates.tpaOrgId, auth.tpaOrgId),
      eq(emailTemplates.templateKey, key),
    ),
  });

  const meta = AVAILABLE_TEMPLATE_KEYS.find((t) => t.key === key);

  return NextResponse.json({ template: template ?? null, meta });
}

// PATCH /api/email-templates/[key] — upsert template for this key
export async function PATCH(req: NextRequest, { params }: { params: { key: string } }) {
  const auth = await requireTpaAdmin();
  if ('error' in auth) return auth.error;

  const { key } = params;
  if (!VALID_KEYS.has(key)) {
    return NextResponse.json({ error: 'Invalid templateKey' }, { status: 400 });
  }

  const body = await req.json();
  const { subject, bodyHtml, isEnabled } = body as {
    subject?: string | null;
    bodyHtml?: string | null;
    isEnabled?: boolean;
  };

  const existing = await db.query.emailTemplates.findFirst({
    where: and(
      eq(emailTemplates.tpaOrgId, auth.tpaOrgId),
      eq(emailTemplates.templateKey, key),
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(emailTemplates)
      .set({
        subject: subject !== undefined ? subject : existing.subject,
        bodyHtml: bodyHtml !== undefined ? bodyHtml : existing.bodyHtml,
        isEnabled: typeof isEnabled === 'boolean' ? isEnabled : existing.isEnabled,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.id, existing.id))
      .returning();
    return NextResponse.json({ template: updated });
  }

  const [created] = await db
    .insert(emailTemplates)
    .values({
      tpaOrgId: auth.tpaOrgId,
      templateKey: key,
      subject: subject ?? null,
      bodyHtml: bodyHtml ?? null,
      isEnabled: typeof isEnabled === 'boolean' ? isEnabled : true,
    })
    .returning();

  return NextResponse.json({ template: created }, { status: 201 });
}
