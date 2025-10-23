import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { getDownloadUrl, isStorageConfigured } from '@/lib/storage';
import { eq } from 'drizzle-orm';

/**
 * GET /api/files/[id]
 * Generate a signed download URL for a document
 * Returns: url, filename, expiresIn
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if storage is configured
    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: 'File storage is not configured' },
        { status: 503 }
      );
    }

    const documentId = params.id;

    // Fetch document with order relation
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
      with: {
        order: true,
      },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check access control
    // Employers can only see documents from their own orders
    if (user.role?.startsWith('employer')) {
      if (doc.order.orgId !== user.orgId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Providers can see all documents (no additional check needed)

    // Generate signed download URL
    const downloadUrl = await getDownloadUrl(doc.storageUrl);

    return NextResponse.json({
      url: downloadUrl,
      filename: doc.fileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      expiresIn: 3600, // 1 hour
    });
  } catch (error) {
    console.error('Failed to generate download URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate download URL' },
      { status: 500 }
    );
  }
}
