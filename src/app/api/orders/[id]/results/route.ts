import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { results, specimens, orders } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createResultSchema = z.object({
  specimenId: z.string().uuid(),
  panelType: z.string().min(1).max(50),
  resultValue: z.enum(['negative', 'positive', 'inconclusive', 'cancelled', 'refused', 'pending']).default('pending'),
  mroDecision: z.enum(['verified_negative', 'verified_positive', 'test_cancelled', 'refusal_to_test', 'pending_review']).optional(),
  mroReviewedAt: z.string().datetime().optional(),
  reportedAt: z.string().datetime().optional(),
  source: z.string().max(50).optional(),
  notes: z.string().optional(),
});

// GET /api/orders/[id]/results — list results for an order
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

  const orderResults = await db.query.results.findMany({
    where: eq(results.orderId, orderId),
    with: {
      specimen: {
        columns: { id: true, specimenType: true, ccfNumber: true },
      },
    },
    orderBy: (results, { asc }) => [asc(results.createdAt)],
  });

  return NextResponse.json({ results: orderResults });
}

// POST /api/orders/[id]/results — record a result
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only TPA admin and records can create results
  const allowedRoles = ['platform_admin', 'tpa_admin', 'tpa_records'];
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
  const validation = createResultSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Verify specimen belongs to this order
  const specimen = await db.query.specimens.findFirst({
    where: and(
      eq(specimens.id, data.specimenId),
      eq(specimens.orderId, orderId),
    ),
    columns: { id: true },
  });

  if (!specimen) {
    return NextResponse.json(
      { error: 'Specimen not found for this order' },
      { status: 404 }
    );
  }

  const [newResult] = await db.insert(results).values({
    specimenId: data.specimenId,
    orderId,
    tpaOrgId: order.tpaOrgId,
    panelType: data.panelType,
    resultValue: data.resultValue,
    mroDecision: data.mroDecision,
    mroReviewedAt: data.mroReviewedAt ? new Date(data.mroReviewedAt) : undefined,
    reportedAt: data.reportedAt ? new Date(data.reportedAt) : undefined,
    source: data.source || 'manual',
    notes: data.notes,
  }).returning();

  return NextResponse.json({ result: newResult }, { status: 201 });
}
