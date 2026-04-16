import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { poctModelVersions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/auth/get-user';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// ============================================================================
// POST /api/poct/model-versions/[version]/activate
// Activate a model version (deactivates all others). Platform admin only.
// ============================================================================

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ version: string }> },
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'platform_admin') {
      return NextResponse.json(
        { error: 'Forbidden: Platform admin access only' },
        { status: 403 },
      );
    }

    const { version } = await params;

    // Find the target version
    const target = await db.query.poctModelVersions.findFirst({
      where: eq(poctModelVersions.version, version),
    });

    if (!target) {
      return NextResponse.json(
        { error: `Model version "${version}" not found` },
        { status: 404 },
      );
    }

    if (target.isActive) {
      return NextResponse.json(
        { error: `Model version "${version}" is already active` },
        { status: 409 },
      );
    }

    // Deactivate all versions, then activate the target
    await db.transaction(async (tx) => {
      // Deactivate all
      await tx.update(poctModelVersions)
        .set({ isActive: false, activatedAt: null });

      // Activate the target
      await tx.update(poctModelVersions)
        .set({ isActive: true, activatedAt: new Date() })
        .where(eq(poctModelVersions.id, target.id));
    });

    // Fetch updated record
    const updated = await db.query.poctModelVersions.findFirst({
      where: eq(poctModelVersions.id, target.id),
    });

    // Audit log
    await createAuditLog({
      tpaOrgId: user.orgId ?? 'platform',
      actorUserId: user.id,
      actorEmail: user.email ?? 'unknown',
      entityType: 'poct_model_version',
      entityId: target.id,
      action: 'poct_model_version_activated',
      diffJson: {
        version,
        previouslyActive: false,
      },
    });

    return NextResponse.json({ modelVersion: updated });
  } catch (error) {
    console.error('Failed to activate POCT model version:', error);
    return NextResponse.json(
      { error: 'Failed to activate POCT model version' },
      { status: 500 },
    );
  }
}
