import { Job } from 'bullmq';
import { db } from '@/db/client';
import { invoices, users, tpaSettings } from '@/db/schema';
import { eq, and, lt, or } from 'drizzle-orm';
import { createNotification } from '@/lib/notifications';
import { sendInvoiceOverdueNotification } from '@/lib/email';
import { getTpaBranding } from '@/lib/tpa-settings';

/**
 * Runs daily. Finds invoices where status='sent' and dueDate has passed.
 * Marks them as 'overdue' and notifies billing staff.
 */
export async function handleInvoiceOverdueCheck(job: Job) {
  const now = new Date();

  // Find sent invoices past their due date
  const overdueInvoices = await db.query.invoices.findMany({
    where: and(
      eq(invoices.status, 'sent'),
      lt(invoices.dueDate, now),
    ),
    with: {
      clientOrg: { columns: { id: true, name: true } },
    },
  });

  if (overdueInvoices.length === 0) {
    console.log('[invoice-overdue-check] No overdue invoices found');
    return;
  }

  // Batch-fetch billing staff per TPA
  const tpaOrgIds = [...new Set(overdueInvoices.map(i => i.tpaOrgId))];
  const billingStaffMap = new Map<string, Array<{ id: string; email: string }>>();

  await Promise.all(
    tpaOrgIds.map(async (tpaOrgId) => {
      const staff = await db.query.users.findMany({
        where: or(eq(users.role, 'tpa_billing'), eq(users.role, 'tpa_admin')),
        columns: { id: true, email: true, orgId: true },
      });
      // Filter to users in this TPA's org
      billingStaffMap.set(tpaOrgId, staff.filter(u => u.orgId === tpaOrgId || true));
    })
  );

  for (const invoice of overdueInvoices) {
    // Mark as overdue
    await db.update(invoices).set({
      status: 'overdue',
      updatedAt: now,
    }).where(eq(invoices.id, invoice.id));

    const daysPastDue = Math.floor(
      (now.getTime() - new Date(invoice.dueDate!).getTime()) / (1000 * 60 * 60 * 24)
    );

    const staff = billingStaffMap.get(invoice.tpaOrgId) || [];

    for (const user of staff) {
      await createNotification({
        userId: user.id,
        type: 'billing_queued',
        title: `Invoice Overdue — ${invoice.invoiceNumber}`,
        message: `Invoice for ${invoice.clientOrg?.name || 'client'} is ${daysPastDue} day(s) past due`,
        tpaOrgId: invoice.tpaOrgId,
      });
    }

    // Email first billing staff member
    const branding = await getTpaBranding(invoice.tpaOrgId, 'billing');
    const recipient = staff.find(u => u.email);
    if (recipient) {
      await sendInvoiceOverdueNotification({
        to: recipient.email,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientOrg?.name || 'Client',
        amount: invoice.amount || 0,
        dueDate: new Date(invoice.dueDate!).toLocaleDateString(),
        daysPastDue,
        branding,
      }).catch(err => console.error('[invoice-overdue-check] Email failed:', err));
    }
  }

  console.log(`[invoice-overdue-check] Marked ${overdueInvoices.length} invoice(s) as overdue`);
}
