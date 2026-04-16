import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getCurrentUser } from '@/auth/get-user';
import { getUploadUrl, isStorageConfigured } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// ============================================================================
// POST /api/poct/upload-image — Get signed upload URL for cassette image
// Collector auth required. Returns { uploadUrl, storageKey }.
// Key format: poct-images/{tpaOrgId}/{orderId}/{timestamp}-{hash}.jpg
// 7-year retention (HIPAA + DOT)
// ============================================================================

const bodySchema = z.object({
  orderId: z.string().uuid(),
  contentType: z.string().regex(/^image\/(jpeg|png|webp|heic)$/i).default('image/jpeg'),
  imageHash: z.string().max(64).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'collector') {
      return NextResponse.json(
        { error: 'Forbidden: Collector access only' },
        { status: 403 },
      );
    }

    if (!user.collectorId || !user.tpaOrgId) {
      return NextResponse.json(
        { error: 'No collector profile linked to this account' },
        { status: 400 },
      );
    }

    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: 'Storage is not configured' },
        { status: 503 },
      );
    }

    const body = await request.json();
    const validation = bodySchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.errors },
        { status: 400 },
      );
    }

    const { orderId, contentType, imageHash } = validation.data;

    // Verify order belongs to this collector's TPA
    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, orderId),
        eq(orders.tpaOrgId, user.tpaOrgId),
        eq(orders.collectorId, user.collectorId),
      ),
      columns: { id: true },
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found or not assigned to you' },
        { status: 404 },
      );
    }

    // Generate storage key
    const timestamp = Date.now();
    const extension = contentType.split('/')[1] === 'jpeg' ? 'jpg' : contentType.split('/')[1];
    const hashSuffix = imageHash ? `-${imageHash.substring(0, 12)}` : '';
    const storageKey = `poct-images/${user.tpaOrgId}/${orderId}/${timestamp}${hashSuffix}.${extension}`;

    // Generate signed upload URL
    const uploadUrl = await getUploadUrl(storageKey, contentType);

    return NextResponse.json({ uploadUrl, storageKey });
  } catch (error) {
    console.error('Failed to generate POCT upload URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 },
    );
  }
}
