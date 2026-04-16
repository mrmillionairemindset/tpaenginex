import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { collectorPushTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// ============================================================================
// POST /api/collector-portal/push-token — Register / upsert push token
// ============================================================================

const registerTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  platform: z.enum(['ios', 'android', 'web']),
  deviceId: z.string().min(1, 'Device ID is required').max(255),
});

export async function POST(req: NextRequest) {
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

    const body = await req.json();
    const validation = registerTokenSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { token, platform, deviceId } = validation.data;

    // Upsert: on conflict (collectorId + deviceId), update token + lastUsedAt
    // Drizzle doesn't support ON CONFLICT with composite index easily,
    // so we check-then-upsert manually inside a transaction.
    await db.transaction(async (tx) => {
      const existing = await tx.query.collectorPushTokens.findFirst({
        where: and(
          eq(collectorPushTokens.collectorId, user.collectorId!),
          eq(collectorPushTokens.deviceId, deviceId)
        ),
      });

      if (existing) {
        await tx
          .update(collectorPushTokens)
          .set({
            token,
            platform,
            isActive: true,
            lastUsedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(collectorPushTokens.id, existing.id));
      } else {
        await tx.insert(collectorPushTokens).values({
          collectorId: user.collectorId!,
          tpaOrgId: user.tpaOrgId!,
          userId: user.id,
          token,
          platform,
          deviceId,
          isActive: true,
          lastUsedAt: new Date(),
        });
      }
    });

    return NextResponse.json({ message: 'Push token registered' });
  } catch (error) {
    console.error('Failed to register push token:', error);
    return NextResponse.json(
      { error: 'Failed to register push token' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/collector-portal/push-token — Deactivate push token (logout)
// ============================================================================

const deleteTokenSchema = z.object({
  deviceId: z.string().min(1, 'Device ID is required'),
});

export async function DELETE(req: NextRequest) {
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

    if (!user.collectorId) {
      return NextResponse.json(
        { error: 'No collector profile linked to this account' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const validation = deleteTokenSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { deviceId } = validation.data;

    // Soft delete — mark as inactive
    await db
      .update(collectorPushTokens)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(collectorPushTokens.collectorId, user.collectorId),
          eq(collectorPushTokens.deviceId, deviceId)
        )
      );

    return NextResponse.json({ message: 'Push token deactivated' });
  } catch (error) {
    console.error('Failed to deactivate push token:', error);
    return NextResponse.json(
      { error: 'Failed to deactivate push token' },
      { status: 500 }
    );
  }
}
