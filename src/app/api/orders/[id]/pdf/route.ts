import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq } from 'drizzle-orm';
import { generateOrderSummaryPDF } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

// GET /api/orders/[id]/pdf — generate and download order summary PDF
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canView =
    user.role === 'platform_admin' ||
    user.role === 'tpa_admin' ||
    user.role === 'tpa_staff' ||
    user.role === 'tpa_records';

  if (!canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = params;

  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
    columns: { id: true, tpaOrgId: true, orderNumber: true },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Verify tpaOrgId ownership (platform_admin bypasses)
  if (user.role !== 'platform_admin' && order.tpaOrgId !== user.tpaOrgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const pdfBuffer = await generateOrderSummaryPDF(id);

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="order-${order.orderNumber}.pdf"`,
    },
  });
}
