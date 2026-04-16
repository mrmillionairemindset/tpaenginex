import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { orders, documents } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getUploadUrl, generateStorageKey, isStorageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/collector-portal/assignments/[id]/upload-url
// Returns a signed S3 PUT URL for direct mobile upload
// ============================================================================

const querySchema = z.object({
  fileName: z.string().min(1, 'fileName is required'),
  contentType: z.string().min(1, 'contentType is required'),
  kind: z.enum(['result', 'chain_of_custody', 'consent', 'authorization', 'other']),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    if (!user.collectorId || !user.tpaOrgId) {
      return NextResponse.json(
        { error: 'No collector profile linked to this account' },
        { status: 400 }
      );
    }

    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: 'Storage is not configured' },
        { status: 503 }
      );
    }

    const { id: orderId } = await params;

    // Parse query params
    const searchParams = req.nextUrl.searchParams;
    const validation = querySchema.safeParse({
      fileName: searchParams.get('fileName'),
      contentType: searchParams.get('contentType'),
      kind: searchParams.get('kind'),
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { fileName, contentType, kind } = validation.data;

    // Verify order belongs to this collector and TPA
    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, orderId),
        eq(orders.collectorId, user.collectorId),
        eq(orders.tpaOrgId, user.tpaOrgId)
      ),
      columns: { id: true, tpaOrgId: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found or not assigned to you' },
        { status: 404 }
      );
    }

    // Generate storage key and signed URL
    const storageKey = generateStorageKey(orderId, kind, fileName);
    const uploadUrl = await getUploadUrl(storageKey, contentType);

    // Pre-create the document record so it's ready when the upload completes
    const [document] = await db
      .insert(documents)
      .values({
        orderId,
        tpaOrgId: user.tpaOrgId,
        kind,
        fileName,
        storageUrl: storageKey,
        mimeType: contentType,
        uploadedBy: user.id,
      })
      .returning();

    return NextResponse.json({
      uploadUrl,
      documentId: document.id,
      storageKey,
    });
  } catch (error) {
    console.error('Failed to generate upload URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
