import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { publicTicketForms } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const createFormSchema = z.object({
  formName: z.string().min(1, 'Form name is required').max(200),
  formConfig: z.record(z.unknown()).optional(), // JSON field definitions, branding, etc.
  isActive: z.boolean().default(true),
  clientOrgId: z.string().uuid().optional(),
});

// ============================================================================
// GET /api/dqf/tickets - List public ticket forms
// ============================================================================

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowedRoles = ['tpa_admin', 'tpa_staff', 'platform_admin'];
  if (!allowedRoles.includes(user.role || '')) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  const tpaOrgId = user.tpaOrgId;
  const { searchParams } = new URL(req.url);
  const clientOrgId = searchParams.get('clientOrgId');

  const conditions = [];
  if (tpaOrgId) conditions.push(eq(publicTicketForms.tpaOrgId, tpaOrgId));
  if (clientOrgId) conditions.push(eq(publicTicketForms.clientOrgId, clientOrgId));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const forms = await db.query.publicTicketForms.findMany({
    where: whereClause,
    with: {
      clientOrg: { columns: { id: true, name: true } },
    },
    orderBy: [desc(publicTicketForms.createdAt)],
  });

  return NextResponse.json({ forms });
}

// ============================================================================
// POST /api/dqf/tickets - Create new form
// ============================================================================

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowedRoles = ['tpa_admin', 'tpa_staff', 'platform_admin'];
  if (!allowedRoles.includes(user.role || '')) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  const body = await req.json();
  const validation = createFormSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Generate a public URL slug
  const slug = `${data.formName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString(36)}`;

  const [form] = await db.insert(publicTicketForms).values({
    tpaOrgId,
    formName: data.formName,
    formConfig: data.formConfig || null,
    isActive: data.isActive,
    clientOrgId: data.clientOrgId || null,
    publicUrl: `/apply/${slug}`,
    submissionCount: 0,
  }).returning();

  return NextResponse.json(
    { form, message: 'Ticket form created successfully' },
    { status: 201 }
  );
}
