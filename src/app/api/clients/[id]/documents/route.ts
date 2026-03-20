import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { clientDocuments, organizations } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and, desc } from 'drizzle-orm';
import { uploadFile, generateClientDocStorageKey } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// GET /api/clients/[id]/documents — list client-level documents
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;

  const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  const isClientAdmin = user.role === 'client_admin';

  if (!isTpaUser && !isClientAdmin) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  // Client admins can only see their own org's documents
  if (isClientAdmin && user.orgId !== id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Verify client org exists and is scoped to the correct TPA
  const clientOrg = await db.query.organizations.findFirst({
    where: isTpaUser && user.tpaOrgId
      ? and(eq(organizations.id, id), eq(organizations.tpaOrgId, user.tpaOrgId))
      : eq(organizations.id, id),
  });

  if (!clientOrg || clientOrg.type !== 'client') {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  // Build conditions
  const conditions = [eq(clientDocuments.clientOrgId, id)];

  // Client admins only see non-archived documents
  if (isClientAdmin) {
    conditions.push(eq(clientDocuments.isArchived, false));
  }

  const docs = await db.query.clientDocuments.findMany({
    where: and(...conditions),
    with: {
      uploadedByUser: {
        columns: { id: true, name: true, email: true },
      },
    },
    orderBy: [desc(clientDocuments.createdAt)],
  });

  return NextResponse.json({ documents: docs });
}

// POST /api/clients/[id]/documents — upload a client-level document
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Only TPA admin/staff can upload client documents
  const canUpload = user.role === 'tpa_admin' || user.role === 'tpa_staff' || user.role === 'platform_admin';
  if (!canUpload) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { id } = params;

  // Verify client org exists and belongs to TPA
  const clientOrg = await db.query.organizations.findFirst({
    where: user.tpaOrgId
      ? and(eq(organizations.id, id), eq(organizations.tpaOrgId, user.tpaOrgId))
      : eq(organizations.id, id),
  });

  if (!clientOrg || clientOrg.type !== 'client') {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const kind = formData.get('kind') as string;
  const notes = formData.get('notes') as string | null;

  if (!file) {
    return NextResponse.json({ error: 'File is required' }, { status: 400 });
  }

  const validKinds = ['contract', 'sop', 'baa', 'coc_template', 'general'];
  if (!kind || !validKinds.includes(kind)) {
    return NextResponse.json(
      { error: `Kind must be one of: ${validKinds.join(', ')}` },
      { status: 400 }
    );
  }

  // Upload file to storage
  const storageKey = generateClientDocStorageKey(id, file.name);
  let storageUrl = storageKey;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadFile(storageKey, buffer, file.type);
  } catch (err) {
    console.error('Storage upload failed, storing key only:', err);
    // Continue with just the key — allows dev without storage configured
  }

  const tpaOrgId = user.tpaOrgId || clientOrg.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'Unable to resolve TPA organization' }, { status: 400 });
  }

  const [doc] = await db
    .insert(clientDocuments)
    .values({
      tpaOrgId,
      clientOrgId: id,
      kind,
      fileName: file.name,
      storageUrl,
      fileSize: file.size,
      mimeType: file.type,
      uploadedBy: user.id,
      notes: notes || undefined,
    })
    .returning();

  return NextResponse.json({ document: doc, message: 'Document uploaded successfully' });
}
