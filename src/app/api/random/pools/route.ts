import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { randomPools, randomPrograms } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, and, desc, or, lt, gt, ne } from 'drizzle-orm';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const createPoolSchema = z.object({
  programId: z.string().uuid(),
  periodStartsAt: z.string().datetime(),
  periodEndsAt: z.string().datetime(),
});

// GET /api/random/pools — list pools
export const GET = withPermission('view_random', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;
  const { searchParams } = new URL(req.url);
  const programId = searchParams.get('programId');
  const status = searchParams.get('status');

  if (!tpaOrgId && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const filters: any[] = [];
  if (tpaOrgId) filters.push(eq(randomPools.tpaOrgId, tpaOrgId));
  if (programId) filters.push(eq(randomPools.programId, programId));
  if (status && ['open', 'selected', 'closed'].includes(status)) {
    filters.push(eq(randomPools.status, status as any));
  }

  const pools = await db.query.randomPools.findMany({
    where: filters.length ? and(...filters) : undefined,
    with: {
      program: {
        columns: {
          id: true,
          name: true,
          programType: true,
          drugTestRate: true,
          alcoholTestRate: true,
          periodType: true,
        },
      },
    },
    orderBy: [desc(randomPools.periodStartsAt)],
  });

  return NextResponse.json({ pools });
});

// POST /api/random/pools — create new pool for a program period
export const POST = withPermission('manage_random', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const body = await req.json();
  const parsed = createPoolSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 },
    );
  }

  const data = parsed.data;

  const startsAt = new Date(data.periodStartsAt);
  const endsAt = new Date(data.periodEndsAt);

  if (endsAt <= startsAt) {
    return NextResponse.json(
      { error: 'periodEndsAt must be after periodStartsAt' },
      { status: 400 },
    );
  }

  // Verify program belongs to this TPA
  const program = await db.query.randomPrograms.findFirst({
    where: and(
      eq(randomPrograms.id, data.programId),
      eq(randomPrograms.tpaOrgId, tpaOrgId),
    ),
  });

  if (!program) {
    return NextResponse.json({ error: 'Program not found' }, { status: 404 });
  }

  // Reject if there's already a non-closed pool in an overlapping period
  // Overlap rule: A.start < B.end AND A.end > B.start
  const overlapping = await db.query.randomPools.findFirst({
    where: and(
      eq(randomPools.programId, data.programId),
      ne(randomPools.status, 'closed'),
      lt(randomPools.periodStartsAt, endsAt),
      gt(randomPools.periodEndsAt, startsAt),
    ),
  });

  if (overlapping) {
    return NextResponse.json(
      {
        error: 'An open pool already exists overlapping this period',
        existingPoolId: overlapping.id,
      },
      { status: 409 },
    );
  }

  const [created] = await db
    .insert(randomPools)
    .values({
      programId: data.programId,
      tpaOrgId,
      periodStartsAt: startsAt,
      periodEndsAt: endsAt,
    })
    .returning();

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'random_pool',
    entityId: created.id,
    action: 'created',
    diffJson: {
      programId: data.programId,
      programName: program.name,
      periodStartsAt: startsAt.toISOString(),
      periodEndsAt: endsAt.toISOString(),
    },
  });

  return NextResponse.json({ pool: created }, { status: 201 });
});
