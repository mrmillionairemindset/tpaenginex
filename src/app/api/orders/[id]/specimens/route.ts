import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { specimens, orders } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createSpecimenSchema = z.object({
  specimenType: z.enum(['primary', 'split']).default('primary'),
  ccfNumber: z.string().max(50).optional(),
  collectorId: z.string().uuid().optional(),
  collectedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

// GET /api/orders/[id]/specimens — list specimens for an order
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: orderId } = await params;
  const tpaOrgId = user.tpaOrgId;

  // Verify order exists and belongs to this TPA
  const order = await db.query.orders.findFirst({
    where: tpaOrgId
      ? and(eq(orders.id, orderId), eq(orders.tpaOrgId, tpaOrgId))
      : eq(orders.id, orderId),
    columns: { id: true },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const orderSpecimens = await db.query.specimens.findMany({
    where: eq(specimens.orderId, orderId),
    with: {
      collector: {
        columns: { id: true, firstName: true, lastName: true },
      },
      results: true,
    },
    orderBy: (specimens, { asc }) => [asc(specimens.createdAt)],
  });

  return NextResponse.json({ specimens: orderSpecimens });
}

// POST /api/orders/[id]/specimens — create a specimen record
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only TPA admin, staff, records can create specimens
  const allowedRoles = ['platform_admin', 'tpa_admin', 'tpa_staff', 'tpa_records'];
  if (!allowedRoles.includes(user.role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: orderId } = await params;
  const tpaOrgId = user.tpaOrgId;

  // Verify order exists and belongs to this TPA
  const order = await db.query.orders.findFirst({
    where: tpaOrgId
      ? and(eq(orders.id, orderId), eq(orders.tpaOrgId, tpaOrgId))
      : eq(orders.id, orderId),
    columns: { id: true, tpaOrgId: true },
  });

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = createSpecimenSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  const [newSpecimen] = await db.insert(specimens).values({
    orderId,
    tpaOrgId: order.tpaOrgId,
    specimenType: data.specimenType,
    ccfNumber: data.ccfNumber,
    collectorId: data.collectorId,
    collectedAt: data.collectedAt ? new Date(data.collectedAt) : undefined,
    notes: data.notes,
  }).returning();

  return NextResponse.json({ specimen: newSpecimen }, { status: 201 });
}
