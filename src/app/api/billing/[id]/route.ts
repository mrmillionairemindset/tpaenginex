import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { invoices, users, tpaSettings } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and, or } from 'drizzle-orm';
import { z } from 'zod';
import { sendInvoiceEmail } from '@/lib/email';
import { createNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';

const updateInvoiceSchema = z.object({
  status: z.enum(['pending', 'sent', 'paid', 'overdue', 'voided']).optional(),
  amount: z.number().int().min(0).optional(),
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
    with: {
      clientOrg: { columns: { id: true, name: true } },
    },
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
  if (data.amount !== undefined) updateData.amount = data.amount;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.invoicedAt !== undefined) updateData.invoicedAt = new Date(data.invoicedAt);
  if (data.paidAt !== undefined) updateData.paidAt = new Date(data.paidAt);
  if (data.dueDate !== undefined) updateData.dueDate = new Date(data.dueDate);

  // Auto-set dates when marking as "sent"
  if (data.status === 'sent' && existing.status !== 'sent') {
    if (!existing.invoicedAt && !data.invoicedAt) {
      updateData.invoicedAt = new Date();
    }
    if (!existing.dueDate && !data.dueDate) {
      // Use TPA's configured payment terms, default 30 days
      const settings = await db.query.tpaSettings.findFirst({
        where: eq(tpaSettings.tpaOrgId, existing.tpaOrgId),
      });
      const termDays = settings?.defaultPaymentTermDays || 30;
      const due = new Date();
      due.setDate(due.getDate() + termDays);
      updateData.dueDate = due;
    }
  }

  // Auto-set paidAt when marking as "paid"
  if (data.status === 'paid' && existing.status !== 'paid') {
    if (!existing.paidAt && !data.paidAt) {
      updateData.paidAt = new Date();
    }
  }

  await db.update(invoices).set(updateData).where(eq(invoices.id, id));

  // Send invoice email to client when status transitions to "sent"
  if (data.status === 'sent' && existing.status !== 'sent') {
    try {
      const settings = await db.query.tpaSettings.findFirst({
        where: eq(tpaSettings.tpaOrgId, existing.tpaOrgId),
      });
      const brandName = settings?.brandName || 'Your TPA';
      const branding = {
        brandName: settings?.brandName,
        replyToEmail: settings?.replyToBilling || settings?.replyToEmail,
      };

      // Find client_admin users for this client org
      const clientAdmins = await db.query.users.findMany({
        where: and(
          eq(users.orgId, existing.clientOrgId),
          eq(users.role, 'client_admin'),
        ),
      });

      const dueDate = (updateData.dueDate as Date) || existing.dueDate;
      const dueDateStr = dueDate ? new Date(dueDate).toLocaleDateString() : 'See invoice';

      for (const admin of clientAdmins) {
        await sendInvoiceEmail({
          to: admin.email,
          invoiceNumber: existing.invoiceNumber,
          clientName: existing.clientOrg?.name || 'Client',
          amount: existing.amount || 0,
          dueDate: dueDateStr,
          tpaBrandName: brandName,
          branding,
        }).catch(err => console.error('[billing] Invoice email failed:', err));

        await createNotification({
          userId: admin.id,
          type: 'billing_queued',
          title: `Invoice ${existing.invoiceNumber}`,
          message: `An invoice has been sent for your review`,
          tpaOrgId: existing.tpaOrgId,
        });
      }
    } catch (err) {
      console.error('[billing] Failed to send invoice notifications:', err);
    }
  }

  const updated = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
    with: {
      clientOrg: { columns: { id: true, name: true } },
    },
  });

  return NextResponse.json({ invoice: updated, message: 'Invoice updated successfully' });
}
