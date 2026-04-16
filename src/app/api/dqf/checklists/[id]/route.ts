import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { dqfChecklists, dqfChecklistItems } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// ============================================================================
// Validation Schemas
// ============================================================================

const updateChecklistSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  clientOrgId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
  items: z.array(z.object({
    id: z.string().uuid().optional(), // existing item to update
    label: z.string().min(1).max(255),
    isRequired: z.boolean().default(true),
    qualificationType: z.string().max(50).optional(),
    sortOrder: z.number().int().default(0),
  })).optional(),
});

// ============================================================================
// GET /api/dqf/checklists/[id] - Single checklist with items
// ============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = user.role === 'tpa_admin' || user.role === 'platform_admin';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Admin access only' }, { status: 403 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  const checklist = await db.query.dqfChecklists.findFirst({
    where: tpaOrgId
      ? and(eq(dqfChecklists.id, id), eq(dqfChecklists.tpaOrgId, tpaOrgId))
      : eq(dqfChecklists.id, id),
    with: {
      items: true,
      clientOrg: { columns: { id: true, name: true } },
    },
  });

  if (!checklist) {
    return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
  }

  return NextResponse.json({ checklist });
}

// ============================================================================
// PATCH /api/dqf/checklists/[id] - Update checklist
// ============================================================================

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isAdmin = user.role === 'tpa_admin' || user.role === 'platform_admin';
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden: Admin access only' }, { status: 403 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  const existing = await db.query.dqfChecklists.findFirst({
    where: tpaOrgId
      ? and(eq(dqfChecklists.id, id), eq(dqfChecklists.tpaOrgId, tpaOrgId))
      : eq(dqfChecklists.id, id),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = updateChecklistSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;
  const updateData: any = { updatedAt: new Date() };

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.clientOrgId !== undefined) updateData.clientOrgId = data.clientOrgId;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  await db.update(dqfChecklists).set(updateData).where(eq(dqfChecklists.id, id));

  // Replace items if provided (delete existing, insert new)
  if (data.items !== undefined) {
    await db.delete(dqfChecklistItems).where(eq(dqfChecklistItems.checklistId, id));

    if (data.items.length > 0) {
      await db.insert(dqfChecklistItems).values(
        data.items.map((item, index) => ({
          checklistId: id,
          tpaOrgId: existing.tpaOrgId,
          label: item.label,
          isRequired: item.isRequired,
          qualificationType: item.qualificationType || null,
          sortOrder: item.sortOrder ?? index,
        }))
      );
    }
  }

  const updated = await db.query.dqfChecklists.findFirst({
    where: eq(dqfChecklists.id, id),
    with: {
      items: true,
      clientOrg: { columns: { id: true, name: true } },
    },
  });

  await createAuditLog({
    tpaOrgId: existing.tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'dqf_checklist',
    entityId: id,
    action: 'updated',
    diffJson: { ...data, itemCount: data.items?.length },
  });

  return NextResponse.json({ checklist: updated, message: 'Checklist updated successfully' });
}
