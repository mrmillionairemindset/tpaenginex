import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { signatures, orders } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createSignatureSchema = z.object({
  signerName: z.string().min(1).max(200),
  signerRole: z.string().min(1).max(50), // "donor", "collector", "employer_rep"
  signatureDataUrl: z.string().min(1), // base64 PNG data URL
  documentId: z.string().uuid().optional(),
});

// GET /api/orders/[id]/signatures — list signatures for an order
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowedRoles = ['platform_admin', 'tpa_admin', 'tpa_staff', 'tpa_records', 'collector'];
  if (!allowedRoles.includes(user.role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: orderId } = await params;
  const tpaOrgId = user.tpaOrgId ?? undefined;

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

  const orderSignatures = await db.query.signatures.findMany({
    where: tpaOrgId
      ? and(eq(signatures.orderId, orderId), eq(signatures.tpaOrgId, tpaOrgId))
      : eq(signatures.orderId, orderId),
    orderBy: (signatures, { asc }) => [asc(signatures.signedAt)],
  });

  return NextResponse.json(orderSignatures);
}

// POST /api/orders/[id]/signatures — create a signature for an order
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowedRoles = ['platform_admin', 'tpa_admin', 'tpa_staff', 'tpa_records', 'collector'];
  if (!allowedRoles.includes(user.role || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: orderId } = await params;
  const tpaOrgId = user.tpaOrgId ?? undefined;

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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createSignatureSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  const { signerName, signerRole, signatureDataUrl, documentId } = parsed.data;

  // Capture IP and User-Agent from request headers
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || null;
  const userAgent = req.headers.get('user-agent') || null;

  const [signature] = await db.insert(signatures).values({
    tpaOrgId: order.tpaOrgId,
    orderId,
    documentId: documentId || null,
    signerName,
    signerRole,
    signatureDataUrl,
    ipAddress,
    userAgent,
  }).returning();

  return NextResponse.json(signature, { status: 201 });
}
