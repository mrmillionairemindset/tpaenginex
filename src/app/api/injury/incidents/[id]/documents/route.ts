import { NextResponse } from 'next/server';
import { db } from '@/db';
import { injuries, injuryDocuments } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, desc, eq } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';
import { uploadFile } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const VALID_DOC_TYPES = new Set([
  'incident_report',
  'medical_record',
  'wc_claim_form',
  'osha_301',
  'rtw_note',
  'imaging',
  'witness_statement',
  'photo',
  'other',
]);

function scopeInjury(tpaOrgId: string | null | undefined, id: string) {
  return tpaOrgId
    ? and(eq(injuries.id, id), eq(injuries.tpaOrgId, tpaOrgId))
    : eq(injuries.id, id);
}

function generateInjuryDocStorageKey(injuryId: string, filename: string): string {
  const ts = Date.now();
  const safe = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `injuries/${injuryId}/${ts}-${safe}`;
}

export const GET = withPermission('view_injuries', async (_req, user, context) => {
  const { id } = context.params;
  const injury = await db.query.injuries.findFirst({
    where: scopeInjury(user.tpaOrgId, id),
    columns: { id: true, clientOrgId: true },
  });
  if (!injury) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });

  if (user.role === 'client_admin') {
    if (!user.orgId || injury.clientOrgId !== user.orgId) {
      return NextResponse.json({ error: 'Incident not found' }, { status: 404 });
    }
  }

  const docs = await db.query.injuryDocuments.findMany({
    where: eq(injuryDocuments.injuryId, id),
    with: {
      uploadedByUser: { columns: { id: true, name: true, email: true } },
    },
    orderBy: [desc(injuryDocuments.createdAt)],
  });

  return NextResponse.json({ documents: docs });
});

export const POST = withPermission('manage_injuries', async (req, user, context) => {
  const { id } = context.params;
  const injury = await db.query.injuries.findFirst({
    where: scopeInjury(user.tpaOrgId, id),
  });
  if (!injury) return NextResponse.json({ error: 'Incident not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const documentType = (formData.get('documentType') as string | null) || '';
  const notes = (formData.get('notes') as string | null) || null;

  if (!file) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 });
  }
  if (!VALID_DOC_TYPES.has(documentType)) {
    return NextResponse.json(
      { error: `documentType must be one of: ${[...VALID_DOC_TYPES].join(', ')}` },
      { status: 400 },
    );
  }

  const storageKey = generateInjuryDocStorageKey(id, file.name);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadFile(storageKey, buffer, file.type);
  } catch (err) {
    console.error('[injury/documents] storage upload failed:', err);
    return NextResponse.json({ error: 'Storage upload failed' }, { status: 500 });
  }

  const [doc] = await db
    .insert(injuryDocuments)
    .values({
      injuryId: id,
      tpaOrgId: injury.tpaOrgId,
      documentType,
      fileName: file.name,
      storageKey,
      fileSize: file.size,
      mimeType: file.type,
      uploadedBy: user.id,
      notes,
    })
    .returning();

  await createAuditLog({
    tpaOrgId: injury.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'injury_document',
    entityId: doc.id,
    action: 'uploaded',
    diffJson: {
      injuryId: id,
      documentType,
      fileName: file.name,
      fileSize: file.size,
    },
  });

  return NextResponse.json({ document: doc, message: 'Document uploaded' }, { status: 201 });
});
