import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { documents, orders } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/collector-portal/assignments/[id]/documents
// List documents for an order assigned to this collector
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'collector') {
      return NextResponse.json(
        { error: 'Forbidden: Collector access only' },
        { status: 403 }
      );
    }

    if (!user.collectorId) {
      return NextResponse.json(
        { error: 'No collector profile linked to this account' },
        { status: 400 }
      );
    }

    const orderId = params.id;

    // Verify order belongs to this collector
    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, orderId),
        eq(orders.collectorId, user.collectorId)
      ),
      columns: { id: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found or not assigned to you' },
        { status: 404 }
      );
    }

    const docs = await db.query.documents.findMany({
      where: eq(documents.orderId, orderId),
      with: {
        uploadedByUser: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ documents: docs });
  } catch (error) {
    console.error('Failed to fetch documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/collector-portal/assignments/[id]/documents
// Upload a document for an order assigned to this collector
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'collector') {
      return NextResponse.json(
        { error: 'Forbidden: Collector access only' },
        { status: 403 }
      );
    }

    if (!user.collectorId) {
      return NextResponse.json(
        { error: 'No collector profile linked to this account' },
        { status: 400 }
      );
    }

    const orderId = params.id;

    // Verify order belongs to this collector
    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, orderId),
        eq(orders.collectorId, user.collectorId)
      ),
      columns: { id: true, tpaOrgId: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found or not assigned to you' },
        { status: 404 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const kind = formData.get('kind') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'File is required' },
        { status: 400 }
      );
    }

    if (!kind) {
      return NextResponse.json(
        { error: 'Document kind is required' },
        { status: 400 }
      );
    }

    // Store metadata with a placeholder storageUrl
    // In production, this would upload to S3/R2 first and use the real URL
    const storageUrl = `pending-upload/${orderId}/${file.name}`;

    const [document] = await db
      .insert(documents)
      .values({
        orderId,
        tpaOrgId: order.tpaOrgId,
        kind: kind as 'result' | 'chain_of_custody' | 'consent' | 'authorization' | 'other',
        fileName: file.name,
        storageUrl,
        fileSize: file.size,
        mimeType: file.type,
        uploadedBy: user.id,
      })
      .returning();

    return NextResponse.json({
      document,
      message: 'Document uploaded successfully',
    });
  } catch (error) {
    console.error('Failed to upload document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
