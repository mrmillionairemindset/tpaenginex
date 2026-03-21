import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { events } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createEventSchema = z.object({
  clientOrgId: z.string().uuid('Client organization ID is required'),
  serviceType: z.enum(['random', 'post_accident', 'reasonable_suspicion']),
  location: z.string().min(1, 'Location is required'),
  scheduledDate: z.string().datetime('Scheduled date is required'),
  totalOrdered: z.number().int().min(1, 'At least 1 donor required'),
  collectorId: z.string().uuid().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
});

// GET /api/events — list events for this TPA
export const GET = withPermission('view_events', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const eventList = await db.query.events.findMany({
    where: tpaOrgId ? eq(events.tpaOrgId, tpaOrgId) : undefined,
    with: {
      clientOrg: {
        columns: { id: true, name: true },
      },
      collector: {
        columns: { id: true, firstName: true, lastName: true },
      },
    },
    orderBy: [desc(events.scheduledDate)],
  });

  return NextResponse.json({ events: eventList });
});

// POST /api/events — create a batch event
export const POST = withPermission('manage_events', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const body = await req.json();
  const validation = createEventSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;
  const eventNumber = `EVT-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const [newEvent] = await db.insert(events).values({
    tpaOrgId,
    clientOrgId: data.clientOrgId,
    eventNumber,
    serviceType: data.serviceType,
    location: data.location,
    scheduledDate: new Date(data.scheduledDate),
    totalOrdered: data.totalOrdered,
    totalPending: data.totalOrdered,
    collectorId: data.collectorId || null,
    notes: data.notes || null,
    internalNotes: data.internalNotes || null,
  }).returning();

  const fullEvent = await db.query.events.findFirst({
    where: eq(events.id, newEvent.id),
    with: {
      clientOrg: { columns: { id: true, name: true } },
      collector: { columns: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json(
    { event: fullEvent, message: 'Event created successfully' },
    { status: 201 }
  );
});
