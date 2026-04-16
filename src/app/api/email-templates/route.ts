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

// GET /api/email-templates — list templates for TPA + available defaults
export async function GET() {
  const auth = await requireTpaAdmin();
  if ('error' in auth) return auth.error;

  const templates = await db.query.emailTemplates.findMany({
    where: eq(emailTemplates.tpaOrgId, auth.tpaOrgId),
  });

  return NextResponse.json({
    templates,
    available: AVAILABLE_TEMPLATE_KEYS,
  });
}

// POST /api/email-templates — create or upsert a template
export async function POST(req: NextRequest) {
  const auth = await requireTpaAdmin();
  if ('error' in auth) return auth.error;

  const body = await req.json();
  const { templateKey, subject, bodyHtml, isEnabled } = body as {
    templateKey?: string;
    subject?: string;
    bodyHtml?: string;
    isEnabled?: boolean;
  };

  if (!templateKey || !VALID_KEYS.has(templateKey)) {
    return NextResponse.json({ error: 'Invalid templateKey' }, { status: 400 });
  }

  const existing = await db.query.emailTemplates.findFirst({
    where: and(
      eq(emailTemplates.tpaOrgId, auth.tpaOrgId),
      eq(emailTemplates.templateKey, templateKey),
    ),
  });

  if (existing) {
    const [updated] = await db
      .update(emailTemplates)
      .set({
        subject: subject ?? existing.subject,
        bodyHtml: bodyHtml ?? existing.bodyHtml,
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
      templateKey,
      subject: subject ?? null,
      bodyHtml: bodyHtml ?? null,
      isEnabled: typeof isEnabled === 'boolean' ? isEnabled : true,
    })
    .returning();

  return NextResponse.json({ template: created }, { status: 201 });
}

// PATCH /api/email-templates — alias for upsert
export async function PATCH(req: NextRequest) {
  return POST(req);
}
