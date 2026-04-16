import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { poctResults } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentUser } from '@/auth/get-user';
import { getDownloadUrl } from '@/lib/storage';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/poct/results/[id] — Single POCT result detail with signed image URL
// ============================================================================

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!user.tpaOrgId) {
      return NextResponse.json(
        { error: 'No TPA org associated with this account' },
        { status: 400 },
      );
    }

    const allowedRoles = ['platform_admin', 'tpa_admin', 'tpa_staff', 'tpa_records', 'client_admin'];
    if (!allowedRoles.includes(user.role ?? '')) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient permissions' },
        { status: 403 },
      );
    }

    const { id } = await params;

    const result = await db.query.poctResults.findFirst({
      where: and(
        eq(poctResults.id, id),
        eq(poctResults.tpaOrgId, user.tpaOrgId),
      ),
      with: {
        order: {
          columns: { id: true, orderNumber: true, status: true },
        },
        collector: {
          columns: { id: true, firstName: true, lastName: true },
        },
        specimen: {
          columns: { id: true, ccfNumber: true, specimenType: true },
        },
      },
    });

    if (!result) {
      return NextResponse.json({ error: 'POCT result not found' }, { status: 404 });
    }

    // Generate signed download URL for the cassette image
    let imageUrl: string | null = null;
    try {
      imageUrl = await getDownloadUrl(result.capturedImageKey);
    } catch {
      // Storage may not be configured in dev — return null
    }

    // Strip internal fields for client_admin
    if (user.role === 'client_admin') {
      const { collectorOverride, reviewerNotes, reviewerUserId, ...sanitized } = result;
      return NextResponse.json({ poctResult: { ...sanitized, imageUrl } });
    }

    return NextResponse.json({ poctResult: { ...result, imageUrl } });
  } catch (error) {
    console.error('Failed to fetch POCT result:', error);
    return NextResponse.json(
      { error: 'Failed to fetch POCT result' },
      { status: 500 },
    );
  }
}
