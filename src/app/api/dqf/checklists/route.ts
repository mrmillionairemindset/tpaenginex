import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { dqfChecklists, dqfChecklistItems } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const createChecklistSchema = z.object({
  name: z.string().min(1, 'Checklist name is required').max(200),
  description: z.string().optional(),
  clientOrgId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
  items: z.array(z.object({
    label: z.string().min(1, 'Item label is required').max(255),
    isRequired: z.boolean().default(true),
    qualificationType: z.string().max(50).optional(),
    sortOrder: z.number().int().default(0),
  })).optional(),
});

// ============================================================================
// GET /api/dqf/checklists - List checklists
// ============================================================================

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = user.role === 'tpa_admin' || user.role === 'platform_admin';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Admin access only' }, { status: 403 });
  }

  const tpaOrgId = user.tpaOrgId;
  const { searchParams } = new URL(req.url);
  const clientOrgId = searchParams.get('clientOrgId');

  let whereClause;
  if (tpaOrgId) {
    whereClause = clientOrgId
      ? and(eq(dqfChecklists.tpaOrgId, tpaOrgId), eq(dqfChecklists.clientOrgId, clientOrgId))
      : eq(dqfChecklists.tpaOrgId, tpaOrgId);
  } else if (clientOrgId) {
    whereClause = eq(dqfChecklists.clientOrgId, clientOrgId);
  }

  const checklists = await db.query.dqfChecklists.findMany({
    where: whereClause,
    with: {
      items: true,
      clientOrg: { columns: { id: true, name: true } },
    },
    orderBy: [desc(dqfChecklists.createdAt)],
  });

  return NextResponse.json({ checklists });
}

// ============================================================================
// POST /api/dqf/checklists - Create checklist with items
// ============================================================================

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = user.role === 'tpa_admin' || user.role === 'platform_admin';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Admin access only' }, { status: 403 });
  }

  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  const body = await req.json();
  const validation = createChecklistSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Create the checklist
  const [checklist] = await db.insert(dqfChecklists).values({
    tpaOrgId,
    name: data.name,
    description: data.description || null,
    clientOrgId: data.clientOrgId || null,
    isActive: data.isActive,
  }).returning();

  // Create checklist items if provided
  if (data.items && data.items.length > 0) {
    await db.insert(dqfChecklistItems).values(
      data.items.map((item, index) => ({
        checklistId: checklist.id,
        tpaOrgId,
        label: item.label,
        isRequired: item.isRequired,
        qualificationType: item.qualificationType || null,
        sortOrder: item.sortOrder ?? index,
      }))
    );
  }

  // Fetch full checklist with items
  const fullChecklist = await db.query.dqfChecklists.findFirst({
    where: eq(dqfChecklists.id, checklist.id),
    with: {
      items: true,
      clientOrg: { columns: { id: true, name: true } },
    },
  });

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'dqf_checklist',
    entityId: checklist.id,
    action: 'created',
    diffJson: { name: data.name, clientOrgId: data.clientOrgId, itemCount: data.items?.length || 0 },
  });

  return NextResponse.json(
    { checklist: fullChecklist, message: 'Checklist created successfully' },
    { status: 201 }
  );
}
