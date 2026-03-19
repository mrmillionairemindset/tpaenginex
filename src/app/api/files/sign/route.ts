import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { documents, orders } from '@/db/schema';
import { getUploadUrl, generateStorageKey, isStorageConfigured } from '@/lib/storage';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

const signRequestSchema = z.object({
  orderId: z.string().uuid(),
  kind: z.enum(['result', 'chain_of_custody', 'consent', 'authorization', 'other']),
  filename: z.string().min(1),
  contentType: z.string().min(1),
  fileSize: z.number().optional(),
});

/**
 * POST /api/files/sign
 * Generate a signed upload URL for a document
 * Returns: uploadUrl, documentId, expiresIn
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only providers can upload documents
    if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if storage is configured
    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: 'File storage is not configured' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const validation = signRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { orderId, kind, filename, contentType, fileSize } = validation.data;

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Generate storage key and signed URL
    const storageKey = generateStorageKey(orderId, kind, filename);
    const uploadUrl = await getUploadUrl(storageKey, contentType);

    // Pre-create document record
    const [doc] = await db
      .insert(documents)
      .values({
        orderId,
        kind,
        fileName: filename,
        storageUrl: storageKey,
        mimeType: contentType,
        fileSize: fileSize || null,
        uploadedBy: user.id,
        uploadedAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      uploadUrl,
      documentId: doc.id,
      storageKey,
      expiresIn: 300, // 5 minutes
    });
  } catch (error: any) {
    console.error('Failed to generate upload URL:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
