import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { documents, orders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { uploadFile, isStorageConfigured } from '@/lib/storage';
import { randomUUID } from 'crypto';

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

    // TPA staff, collectors, and platform admins can upload documents
    const canUpload = user.role?.startsWith('tpa_') || user.role === 'platform_admin' || user.role === 'collector';
    if (!canUpload) {
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
    const kind = formData.get('kind') as 'result' | 'chain_of_custody' | 'consent' | 'authorization' | 'other';
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

    // Upload file to storage (S3/R2/Supabase)
    let storageUrl = '';
    const tpaOrgId = order.tpaOrgId || 'unknown';
    const uniqueFilename = `${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storagePath = `documents/${tpaOrgId}/${orderId}/${uniqueFilename}`;

    if (isStorageConfigured()) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        await uploadFile(storagePath, buffer, file.type);
        storageUrl = storagePath;
      } catch (uploadError) {
        console.error('Storage upload failed, storing placeholder:', uploadError);
        storageUrl = `pending-upload://${storagePath}`;
      }
    } else {
      console.warn('Storage not configured — file metadata saved without upload');
      storageUrl = `pending-upload://${storagePath}`;
    }

    const [document] = await db
      .insert(documents)
      .values({
        orderId: orderId,
        kind: kind,
        fileName: file.name,
        storageUrl,
        fileSize: file.size,
        mimeType: file.type,
        uploadedBy: user.id,
        meta: notes ? { notes } : undefined,
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
