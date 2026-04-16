import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { events, orders } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { sendCollectorEventPush } from '@/lib/push-notifications';

export const dynamic = 'force-dynamic';

const updateEventSchema = z.object({
  status: z.enum(['scheduled', 'in_progress', 'partially_complete', 'complete', 'cancelled']).optional(),
  totalCompleted: z.number().int().optional(),
  totalPending: z.number().int().optional(),
  collectorId: z.string().uuid().optional(),
  location: z.string().optional(),
  scheduledDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  kitMailedAt: z.string().datetime().optional(),
  collectorConfirmedAt: z.string().datetime().optional(),
  pendingFollowUpUntil: z.string().datetime().optional(),
});

// GET /api/events/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  const event = await db.query.events.findFirst({
    where: tpaOrgId
      ? and(eq(events.id, id), eq(events.tpaOrgId, tpaOrgId))
      : eq(events.id, id),
    with: {
      clientOrg: { columns: { id: true, name: true } },
      collector: true,
      orders: {
        with: {
          person: true,
        },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  return NextResponse.json({ event });
}

// PATCH /api/events/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canUpdate = user.role?.startsWith('tpa_') || user.role === 'platform_admin';
  if (!canUpdate) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  const existing = await db.query.events.findFirst({
    where: tpaOrgId
      ? and(eq(events.id, id), eq(events.tpaOrgId, tpaOrgId))
      : eq(events.id, id),
  });

  if (!existing) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = updateEventSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;
  const updateData: any = { updatedAt: new Date() };

  if (data.status) updateData.status = data.status;
  if (data.totalCompleted !== undefined) updateData.totalCompleted = data.totalCompleted;
  if (data.totalPending !== undefined) updateData.totalPending = data.totalPending;
  if (data.collectorId) updateData.collectorId = data.collectorId;
  if (data.location) updateData.location = data.location;
  if (data.scheduledDate) updateData.scheduledDate = new Date(data.scheduledDate);
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.internalNotes !== undefined) updateData.internalNotes = data.internalNotes;
  if (data.kitMailedAt) updateData.kitMailedAt = new Date(data.kitMailedAt);
  if (data.collectorConfirmedAt) updateData.collectorConfirmedAt = new Date(data.collectorConfirmedAt);
  if (data.pendingFollowUpUntil) updateData.pendingFollowUpUntil = new Date(data.pendingFollowUpUntil);

  await db.update(events).set(updateData).where(eq(events.id, id));

  // If a collector was newly assigned, send push notification
  if (data.collectorId && data.collectorId !== existing.collectorId) {
    const scheduledDate = data.scheduledDate
      ? new Date(data.scheduledDate).toLocaleDateString()
      : existing.scheduledDate.toLocaleDateString();

    sendCollectorEventPush(
      data.collectorId,
      existing.eventNumber,
      data.location || existing.location,
      scheduledDate
    ).catch((err) => console.error('[push] Failed to send event assignment push:', err));
  }

  const updated = await db.query.events.findFirst({
    where: eq(events.id, id),
    with: {
      clientOrg: { columns: { id: true, name: true } },
      collector: { columns: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({ event: updated, message: 'Event updated successfully' });
}
