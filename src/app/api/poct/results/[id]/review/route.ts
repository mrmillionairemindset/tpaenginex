import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { poctResults } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getCurrentUser } from '@/auth/get-user';
import { hasPermission } from '@/auth/rbac';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// ============================================================================
// POST /api/poct/results/[id]/review — TPA admin/records reviews a POCT result
// ============================================================================

const reviewSchema = z.object({
  reviewerNotes: z.string().max(2000).optional(),
  accepted: z.boolean(),
});

export async function POST(
  request: NextRequest,
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

    // Requires update_results permission
    const allowed = await hasPermission('update_results');
    if (!allowed) {
      return NextResponse.json(
        { error: 'Forbidden: Requires update_results permission' },
        { status: 403 },
      );
    }

    const { id } = await params;

    const body = await request.json();
    const validation = reviewSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validation.error.errors },
        { status: 400 },
      );
    }

    const { accepted, reviewerNotes } = validation.data;

    // Fetch the existing result
    const existing = await db.query.poctResults.findFirst({
      where: and(
        eq(poctResults.id, id),
        eq(poctResults.tpaOrgId, user.tpaOrgId),
      ),
      columns: { id: true, reviewedAt: true, orderId: true, overallResult: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'POCT result not found' }, { status: 404 });
    }

    if (existing.reviewedAt) {
      return NextResponse.json(
        { error: 'This POCT result has already been reviewed' },
        { status: 409 },
      );
    }

    // Update with review
    const [updated] = await db.update(poctResults)
      .set({
        reviewerUserId: user.id,
        reviewerNotes: reviewerNotes ?? null,
        reviewedAt: new Date(),
        reviewAccepted: accepted,
      })
      .where(eq(poctResults.id, id))
      .returning();

    // Audit log
    await createAuditLog({
      tpaOrgId: user.tpaOrgId,
      actorUserId: user.id,
      actorEmail: user.email ?? 'unknown',
      entityType: 'poct_result',
      entityId: id,
      action: accepted ? 'poct_result_accepted' : 'poct_result_rejected',
      diffJson: {
        orderId: existing.orderId,
        overallResult: existing.overallResult,
        accepted,
        reviewerNotes: reviewerNotes ?? null,
      },
    });

    return NextResponse.json({ poctResult: updated });
  } catch (error) {
    console.error('Failed to review POCT result:', error);
    return NextResponse.json(
      { error: 'Failed to review POCT result' },
      { status: 500 },
    );
  }
}
