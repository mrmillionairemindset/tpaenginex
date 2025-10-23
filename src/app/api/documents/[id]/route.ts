import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { documents } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * DELETE /api/documents/[id]
 * Delete a document (providers only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only providers can delete documents
    if (!user.role?.startsWith('provider')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const documentId = params.id;

    // Fetch document to verify it exists
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
      with: {
        order: true,
      },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Don't allow deletion if order is already complete
    if (doc.order.status === 'complete') {
      return NextResponse.json(
        { error: 'Cannot delete documents from completed orders' },
        { status: 400 }
      );
    }

    // Delete the document
    // Note: We're not deleting from storage for safety - files remain as backup
    // In production, you might want to add S3 deletion or implement soft deletes
    await db.delete(documents).where(eq(documents.id, documentId));

    return NextResponse.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Failed to delete document:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
