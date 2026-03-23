import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { orders } from '@/db/schema';
import { eq, and, ne, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/collector-portal/assignments — List orders assigned to this collector
// ============================================================================

export async function GET() {
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

    if (!user.tpaOrgId) {
      return NextResponse.json(
        { error: 'No TPA organization context' },
        { status: 400 }
      );
    }

    const assignments = await db.query.orders.findMany({
      where: and(
        eq(orders.collectorId, user.collectorId),
        eq(orders.tpaOrgId, user.tpaOrgId),
        ne(orders.status, 'cancelled')
      ),
      with: {
        candidate: {
          columns: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        clientOrg: {
          columns: {
            id: true,
            name: true,
          },
        },
        event: {
          columns: {
            id: true,
            eventNumber: true,
            serviceType: true,
            scheduledDate: true,
            totalOrdered: true,
          },
        },
        documents: {
          columns: {
            id: true,
            kind: true,
            fileName: true,
            createdAt: true,
          },
        },
      },
      orderBy: [desc(orders.createdAt)],
    });

    // Strip internalNotes from every order
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const sanitized = assignments.map(({ internalNotes, ...order }: any) => order);

    return NextResponse.json({ assignments: sanitized });
  } catch (error) {
    console.error('Failed to fetch collector assignments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch assignments' },
      { status: 500 }
    );
  }
}
