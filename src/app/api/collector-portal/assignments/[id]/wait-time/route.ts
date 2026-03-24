import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// POST /api/collector-portal/assignments/[id]/wait-time
// Collector logs shy bladder / extended wait time.
// Appends "Shy Bladder / Extended Wait (per hour)" to the order's testType
// with quantity stored in meta so billing picks it up as a line item.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'collector' || !user.collectorId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const hours = parseFloat(body.hours);

  if (!hours || hours <= 0) {
    return NextResponse.json({ error: 'Hours must be greater than 0' }, { status: 400 });
  }

  // Verify order belongs to this collector
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, id),
  });

  if (!order || order.collectorId !== user.collectorId) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  // Append shy bladder to testType so billing creates a line item
  const currentTestType = order.testType || '';
  const shyBladderEntry = `Shy Bladder / Extended Wait (${hours}hr)`;

  // Don't add duplicates
  if (currentTestType.includes('Shy Bladder')) {
    return NextResponse.json({ error: 'Wait time already logged for this order' }, { status: 409 });
  }

  const updatedTestType = currentTestType
    ? `${currentTestType}, ${shyBladderEntry}`
    : shyBladderEntry;

  // Store hours in meta for billing to calculate quantity
  const currentMeta = (order.meta as Record<string, unknown>) || {};
  const updatedMeta = { ...currentMeta, shyBladderHours: hours };

  await db.update(orders).set({
    testType: updatedTestType,
    meta: updatedMeta,
    updatedAt: new Date(),
  }).where(eq(orders.id, id));

  return NextResponse.json({ message: 'Wait time logged', hours });
}
