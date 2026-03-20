import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { clientDocuments, organizations, auditLogs } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import { getDownloadUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// GET /api/clients/[id]/documents/[docId] — get signed download URL
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, docId } = params;

  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  const isClientAdmin = user.role === 'client_admin';

  if (!isTpaUser && !isClientAdmin) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Client admins can only access their own org's documents
  if (isClientAdmin && user.orgId !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch the document, verifying it belongs to this client
  const doc = await db.query.clientDocuments.findFirst({
    where: and(
      eq(clientDocuments.id, docId),
      eq(clientDocuments.clientOrgId, id),
    ),
  });

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // TPA users: verify TPA scope
  if (isTpaUser && user.tpaOrgId && doc.tpaOrgId !== user.tpaOrgId) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Client admins should not see archived documents
  if (isClientAdmin && doc.isArchived) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  try {
    const url = await getDownloadUrl(doc.storageUrl);
    return NextResponse.json({ url, fileName: doc.fileName });
  } catch (err) {
    console.error('Failed to generate download URL:', err);
    return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 });
  }
}

// DELETE /api/clients/[id]/documents/[docId] — soft delete (archive)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only tpa_admin can archive client documents
  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'Only admins can archive documents' }, { status: 403 });
  }

  const { id, docId } = params;

  // Fetch the document
  const doc = await db.query.clientDocuments.findFirst({
    where: and(
      eq(clientDocuments.id, docId),
      eq(clientDocuments.clientOrgId, id),
    ),
  });

  if (!doc) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Verify TPA scope
  if (user.tpaOrgId && doc.tpaOrgId !== user.tpaOrgId) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Soft delete
  await db
    .update(clientDocuments)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(clientDocuments.id, docId));

  // Write audit log
  try {
    await db.insert(auditLogs).values({
      tpaOrgId: user.tpaOrgId,
      actorUserId: user.id,
      actorEmail: user.email,
      entityType: 'client_document',
      entityId: docId,
      action: 'archived',
      diffJson: { fileName: doc.fileName, clientOrgId: id, kind: doc.kind },
    });
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }

  return NextResponse.json({ message: 'Document archived' });
}
