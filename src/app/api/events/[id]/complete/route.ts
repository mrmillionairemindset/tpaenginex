import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { events } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import { enqueueNotification } from '@/jobs/queue';

export const dynamic = 'force-dynamic';

// POST /api/events/[id]/complete — mark event as complete
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const canComplete = user.role === 'tpa_admin' || user.role === 'tpa_staff' || user.role === 'platform_admin';
  if (!canComplete) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
  }

  const { id } = params;
  const tpaOrgId = user.tpaOrgId;

  const event = await db.query.events.findFirst({
    where: tpaOrgId
      ? and(eq(events.id, id), eq(events.tpaOrgId, tpaOrgId))
      : eq(events.id, id),
  });

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  if (event.status === 'complete') {
    return NextResponse.json({ error: 'Event is already complete' }, { status: 400 });
  }

  await db.update(events).set({
    status: 'complete',
    completionEmailSentAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(events.id, id));

  // Queue completion email and billing entry
  await enqueueNotification('event_completion_email', {
    eventId: id,
    tpaOrgId: event.tpaOrgId,
  });

  await enqueueNotification('billing_queue_entry', {
    eventId: id,
    tpaOrgId: event.tpaOrgId,
  });

  const updated = await db.query.events.findFirst({
    where: eq(events.id, id),
    with: {
      clientOrg: { columns: { id: true, name: true } },
      collector: { columns: { id: true, firstName: true, lastName: true } },
    },
  });

  return NextResponse.json({
    event: updated,
    message: 'Event marked as complete',
  });
}
