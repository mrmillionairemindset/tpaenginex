import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { randomPools } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, and } from 'drizzle-orm';
import { generateRandomSelectionReport } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

// GET /api/random/pools/[id]/report.pdf — downloadable compliance report
export const GET = withPermission('view_random', async (req, user, context) => {
  const { id } = context.params as { id: string };
  const tpaOrgId = user.tpaOrgId;

  const pool = await db.query.randomPools.findFirst({
    where: tpaOrgId
      ? and(eq(randomPools.id, id), eq(randomPools.tpaOrgId, tpaOrgId))
      : eq(randomPools.id, id),
  });

  if (!pool) {
    return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
  }

  if (pool.status === 'open') {
    return NextResponse.json(
      { error: 'Pool has not been selected — nothing to report' },
      { status: 409 },
    );
  }

  const pdf = await generateRandomSelectionReport(id);

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="random-selection-${id}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
});
