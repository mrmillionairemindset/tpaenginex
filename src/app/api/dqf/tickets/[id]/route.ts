import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { publicTicketForms } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const updateFormSchema = z.object({
  formName: z.string().min(1).max(200).optional(),
  formConfig: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
  clientOrgId: z.string().uuid().nullable().optional(),
});

// ============================================================================
// GET /api/dqf/tickets/[id] - Single form
// ============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowedRoles = ['tpa_admin', 'tpa_staff', 'platform_admin'];
  if (!allowedRoles.includes(user.role || '')) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  const form = await db.query.publicTicketForms.findFirst({
    where: tpaOrgId
      ? and(eq(publicTicketForms.id, id), eq(publicTicketForms.tpaOrgId, tpaOrgId))
      : eq(publicTicketForms.id, id),
    with: {
      clientOrg: { columns: { id: true, name: true } },
    },
  });

  if (!form) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  }

  return NextResponse.json({ form });
}

// ============================================================================
// PATCH /api/dqf/tickets/[id] - Update form (toggle active, update config)
// ============================================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowedRoles = ['tpa_admin', 'tpa_staff', 'platform_admin'];
  if (!allowedRoles.includes(user.role || '')) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  const existing = await db.query.publicTicketForms.findFirst({
    where: tpaOrgId
      ? and(eq(publicTicketForms.id, id), eq(publicTicketForms.tpaOrgId, tpaOrgId))
      : eq(publicTicketForms.id, id),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Form not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = updateFormSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;
  const updateData: any = { updatedAt: new Date() };

  if (data.formName !== undefined) updateData.formName = data.formName;
  if (data.formConfig !== undefined) updateData.formConfig = data.formConfig;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.clientOrgId !== undefined) updateData.clientOrgId = data.clientOrgId;

  await db.update(publicTicketForms).set(updateData).where(eq(publicTicketForms.id, id));

  const updated = await db.query.publicTicketForms.findFirst({
    where: eq(publicTicketForms.id, id),
    with: {
      clientOrg: { columns: { id: true, name: true } },
    },
  });

  return NextResponse.json({ form: updated, message: 'Form updated successfully' });
}
