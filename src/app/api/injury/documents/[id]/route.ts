import { NextResponse } from 'next/server';
import { db } from '@/db';
import { injuries, injuryDocuments } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, eq } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';
import { getDownloadUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

function scope(tpaOrgId: string | null | undefined, id: string) {
  return tpaOrgId
    ? and(eq(injuryDocuments.id, id), eq(injuryDocuments.tpaOrgId, tpaOrgId))
    : eq(injuryDocuments.id, id);
}

export const GET = withPermission('view_injuries', async (_req, user, context) => {
  const { id } = context.params;

  const doc = await db.query.injuryDocuments.findFirst({
    where: scope(user.tpaOrgId, id),
  });
  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  // client_admin: verify parent injury belongs to their client org
  if (user.role === 'client_admin') {
    if (!user.orgId) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    const parent = await db.query.injuries.findFirst({
      where: eq(injuries.id, doc.injuryId),
      columns: { clientOrgId: true },
    });
    if (!parent || parent.clientOrgId !== user.orgId) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
  }

  let downloadUrl: string;
  try {
    downloadUrl = await getDownloadUrl(doc.storageKey);
  } catch (err) {
    console.error('[injury/documents/[id]] signed URL failed:', err);
    return NextResponse.json({ error: 'Could not generate download URL' }, { status: 500 });
  }

  return NextResponse.json({
    document: {
      id: doc.id,
      injuryId: doc.injuryId,
      documentType: doc.documentType,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      createdAt: doc.createdAt,
      downloadUrl,
    },
  });
});

export const DELETE = withPermission('manage_injuries', async (_req, user, context) => {
  const { id } = context.params;

  const existing = await db.query.injuryDocuments.findFirst({
    where: scope(user.tpaOrgId, id),
  });
  if (!existing) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

  await db.delete(injuryDocuments).where(eq(injuryDocuments.id, id));

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'injury_document',
    entityId: id,
    action: 'deleted',
    diffJson: { injuryId: existing.injuryId, fileName: existing.fileName },
  });

  return NextResponse.json({ ok: true });
});
