import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { invoices } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateInvoiceSchema = z.object({
  status: z.enum(['pending', 'sent', 'paid', 'overdue', 'voided']).optional(),
  notes: z.string().optional(),
  invoicedAt: z.string().datetime().optional(),
  paidAt: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
});

// PATCH /api/billing/[id] — update invoice status/details
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canManage = user.role === 'platform_admin' || user.role === 'tpa_admin' || user.role === 'tpa_billing';
  if (!canManage) {
    return NextResponse.json({ error: 'Forbidden: Insufficient permissions', required: 'manage_billing' }, { status: 403 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  // Verify invoice belongs to user's TPA
  const existing = await db.query.invoices.findFirst({
    where: tpaOrgId
      ? and(eq(invoices.id, id), eq(invoices.tpaOrgId, tpaOrgId))
      : eq(invoices.id, id),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = updateInvoiceSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;
  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (data.status !== undefined) updateData.status = data.status;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.invoicedAt !== undefined) updateData.invoicedAt = new Date(data.invoicedAt);
  if (data.paidAt !== undefined) updateData.paidAt = new Date(data.paidAt);
  if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);

  await db.update(invoices).set(updateData).where(eq(invoices.id, id));

  const updated = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
    with: {
      clientOrg: { columns: { id: true, name: true } },
    },
  });

  return NextResponse.json({ invoice: updated, message: 'Invoice updated successfully' });
}
