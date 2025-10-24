import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { documents, orders } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only providers can upload documents
    if (!user.role?.startsWith('provider')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const orderId = params.id;

    // Verify order exists
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, orderId),
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const kind = formData.get('kind') as string;
    const notes = formData.get('notes') as string | null;

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

    // For now, we'll just store metadata without actual file storage
    // In Module 8, this will be enhanced to upload to S3/R2
    const [document] = await db
      .insert(documents)
      .values({
        orderId: orderId,
        kind: kind,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        notes: notes || undefined,
        uploadedBy: user.id,
        uploadedAt: new Date(),
      })
      .returning();

    // If this is a result document, update order status to complete
    if (kind === 'result') {
      await db
        .update(orders)
        .set({
          status: 'complete',
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId));
    }

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
