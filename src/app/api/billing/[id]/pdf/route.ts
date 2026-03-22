import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { invoices, tpaSettings } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import { generateInvoicePDF } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

// GET /api/billing/[id]/pdf — generate and download invoice PDF
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canView = user.role === 'platform_admin' || user.role === 'tpa_admin' || user.role === 'tpa_billing';
  if (!canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  const invoice = await db.query.invoices.findFirst({
    where: tpaOrgId
      ? and(eq(invoices.id, id), eq(invoices.tpaOrgId, tpaOrgId))
      : eq(invoices.id, id),
    with: {
      clientOrg: { columns: { id: true, name: true } },
      order: { columns: { id: true, orderNumber: true, serviceType: true, testType: true } },
      event: { columns: { id: true, eventNumber: true, serviceType: true, totalOrdered: true } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const settings = await db.query.tpaSettings.findFirst({
    where: eq(tpaSettings.tpaOrgId, invoice.tpaOrgId),
  });

  // Build service description
  let serviceDescription = 'Professional services';
  if (invoice.order) {
    const type = invoice.order.serviceType || invoice.order.testType || 'Service';
    serviceDescription = `Order ${invoice.order.orderNumber} — ${type.replace(/_/g, ' ')}`;
  } else if (invoice.event) {
    const type = invoice.event.serviceType || 'Collection event';
    serviceDescription = `Event ${invoice.event.eventNumber} — ${type.replace(/_/g, ' ')} (${invoice.event.totalOrdered} ordered)`;
  }

  const pdfBuffer = await generateInvoicePDF({
    invoiceNumber: invoice.invoiceNumber,
    tpaBrandName: settings?.brandName || 'TPA',
    clientName: invoice.clientOrg?.name || 'Client',
    serviceDescription,
    amount: invoice.amount || 0,
    invoicedAt: invoice.invoicedAt
      ? new Date(invoice.invoicedAt).toLocaleDateString()
      : new Date(invoice.createdAt).toLocaleDateString(),
    dueDate: invoice.dueDate
      ? new Date(invoice.dueDate).toLocaleDateString()
      : 'Not set',
    status: invoice.status,
    notes: invoice.notes,
  });

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}
