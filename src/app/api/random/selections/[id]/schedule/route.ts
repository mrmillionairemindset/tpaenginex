import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { randomSelections, orders, persons } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const scheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
  orderId: z.string().uuid().optional(),
  // If creating a new draft order, the jobsite location is required
  jobsiteLocation: z.string().optional(),
  notes: z.string().optional(),
});

// POST /api/random/selections/[id]/schedule
// Marks selection as scheduled. Optionally links existing order, or creates a draft.
export const POST = withPermission('manage_random', async (req, user, context) => {
  const { id } = context.params as { id: string };
  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const selection = await db.query.randomSelections.findFirst({
    where: and(
      eq(randomSelections.id, id),
      eq(randomSelections.tpaOrgId, tpaOrgId),
    ),
    with: {
      person: true,
    },
  });

  if (!selection) {
    return NextResponse.json({ error: 'Selection not found' }, { status: 404 });
  }

  const body = await req.json();
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 },
    );
  }

  const data = parsed.data;
  const scheduledAt = new Date(data.scheduledAt);
  let orderId: string | null = null;

  if (data.orderId) {
    // Verify order belongs to this TPA
    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, data.orderId),
        eq(orders.tpaOrgId, tpaOrgId),
      ),
    });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    orderId = order.id;
  } else {
    // Create a draft order derived from the selection
    const testType =
      selection.selectionType === 'alcohol'
        ? 'Alcohol Breath Test'
        : selection.selectionType === 'both'
          ? 'Drug Panel + Alcohol'
          : 'DOT 5-panel Drug Screen';

    const orderNumber = `RND-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const [newOrder] = await db
      .insert(orders)
      .values({
        orgId: selection.person.orgId,
        tpaOrgId,
        personId: selection.person.id,
        orderNumber,
        testType,
        serviceType: 'random',
        isDOT: true,
        reasonForService: 'Random Selection',
        jobsiteLocation: data.jobsiteLocation || 'TBD',
        requestedBy: user.id,
        scheduledFor: scheduledAt,
        status: 'new',
        notes: data.notes || `Auto-created from random selection ${selection.id}`,
      })
      .returning();

    orderId = newOrder.id;
  }

  await db
    .update(randomSelections)
    .set({
      scheduledAt,
      orderId,
      notes: data.notes || selection.notes,
    })
    .where(eq(randomSelections.id, id));

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'random_selection',
    entityId: id,
    action: 'scheduled',
    diffJson: {
      scheduledAt: scheduledAt.toISOString(),
      orderId,
      createdNewOrder: !data.orderId,
    },
  });

  return NextResponse.json({ success: true, orderId, scheduledAt });
});
