import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/auth/get-user';
import { db } from '@/db';
import { complianceScores } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET /api/dashboard/compliance-distribution — score bucket counts
// ============================================================================

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tpaOrgId = user.tpaOrgId;
    const isTpaUser =
      user.role?.startsWith('tpa_') || user.role === 'platform_admin';
    if (!isTpaUser) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!tpaOrgId && user.role !== 'platform_admin') {
      return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
    }

    const whereClause = tpaOrgId
      ? eq(complianceScores.tpaOrgId, tpaOrgId)
      : undefined;

    const rows = await db.query.complianceScores.findMany({
      where: whereClause,
      columns: { score: true },
    });

    let excellent = 0;
    let good = 0;
    let fair = 0;
    let poor = 0;

    for (const r of rows) {
      const s = Number(r.score) || 0;
      if (s >= 90) excellent++;
      else if (s >= 80) good++;
      else if (s >= 60) fair++;
      else poor++;
    }

    return NextResponse.json({ excellent, good, fair, poor });
  } catch (error) {
    console.error('Failed to fetch compliance distribution:', error);
    return NextResponse.json(
      { error: 'Failed to fetch compliance distribution' },
      { status: 500 }
    );
  }
}
