import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { orders, auditLogs } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ============================================================================
// POST /api/collector-portal/assignments/[id]/location
// GPS check-in — appends to order.meta.locationCheckins[]
// ============================================================================

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().positive().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'collector') {
      return NextResponse.json(
        { error: 'Forbidden: Collector access only' },
        { status: 403 }
      );
    }

    if (!user.collectorId || !user.tpaOrgId) {
      return NextResponse.json(
        { error: 'No collector profile linked to this account' },
        { status: 400 }
      );
    }

    const { id } = await params;
    const body = await req.json();
    const validation = locationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { latitude, longitude, accuracy } = validation.data;

    // Verify order belongs to this collector and TPA
    const order = await db.query.orders.findFirst({
      where: and(
        eq(orders.id, id),
        eq(orders.collectorId, user.collectorId),
        eq(orders.tpaOrgId, user.tpaOrgId)
      ),
    });

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found or not assigned to you' },
        { status: 404 }
      );
    }

    // Build the location checkin record
    const checkin = {
      latitude,
      longitude,
      accuracy: accuracy ?? null,
      timestamp: new Date().toISOString(),
    };

    // Append to existing locationCheckins array in meta
    const currentMeta = (order.meta as Record<string, unknown>) || {};
    const existingCheckins = Array.isArray(currentMeta.locationCheckins)
      ? currentMeta.locationCheckins
      : [];

    const updatedMeta = {
      ...currentMeta,
      locationCheckins: [...existingCheckins, checkin],
    };

    await db.update(orders).set({
      meta: updatedMeta,
      updatedAt: new Date(),
    }).where(eq(orders.id, id));

    // Audit log the location check-in
    await db.insert(auditLogs).values({
      tpaOrgId: user.tpaOrgId,
      actorUserId: user.id,
      actorEmail: user.email ?? '',
      entityType: 'order',
      entityId: id,
      action: 'location_checkin',
      diffJson: { latitude, longitude, accuracy },
    });

    return NextResponse.json({
      message: 'Location check-in recorded',
      checkin,
    });
  } catch (error) {
    console.error('Failed to record location check-in:', error);
    return NextResponse.json(
      { error: 'Failed to record location check-in' },
      { status: 500 }
    );
  }
}
