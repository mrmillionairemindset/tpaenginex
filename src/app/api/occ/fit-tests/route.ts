import { NextResponse } from 'next/server';
import { db } from '@/db';
import { respiratorFitTests, persons } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, desc, eq, count } from 'drizzle-orm';
import { parsePagination } from '@/lib/pagination';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  personId: z.string().uuid(),
  testType: z.enum(['qualitative', 'quantitative']),
  respiratorMake: z.string().max(100).optional(),
  respiratorModel: z.string().max(100).optional(),
  respiratorSize: z.string().max(20).optional(),
  fitFactor: z.number().int().min(0).max(100000).optional(),
  passed: z.boolean(),
  testedAt: z.string().datetime().optional(),
  nextTestDueBy: z.string().datetime().optional(),
  notes: z.string().max(5000).optional(),
});

export const GET = withPermission('view_fit_tests', async (req, user) => {
  const { searchParams } = new URL(req.url);
  const tpaOrgId = user.tpaOrgId;
  const { page, limit, offset } = parsePagination(searchParams);
  const personId = searchParams.get('personId');

  let where: any = tpaOrgId ? eq(respiratorFitTests.tpaOrgId, tpaOrgId) : undefined;
  if (personId)
    where = where
      ? and(where, eq(respiratorFitTests.personId, personId))
      : eq(respiratorFitTests.personId, personId);

  const [rows, totalRows] = await Promise.all([
    db.query.respiratorFitTests.findMany({
      where,
      with: { person: { columns: { id: true, firstName: true, lastName: true } } },
      orderBy: [desc(respiratorFitTests.testedAt)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(respiratorFitTests).where(where),
  ]);

  const total = Number(totalRows[0]?.count ?? 0);
  return NextResponse.json({
    fitTests: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: offset + rows.length < total },
  });
});

export const POST = withPermission('manage_fit_tests', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) return NextResponse.json({ error: 'TPA context required' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

  const person = await db.query.persons.findFirst({
    where: and(eq(persons.id, parsed.data.personId), eq(persons.tpaOrgId, tpaOrgId)),
  });
  if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 });

  const [row] = await db
    .insert(respiratorFitTests)
    .values({
      tpaOrgId,
      personId: parsed.data.personId,
      testType: parsed.data.testType,
      respiratorMake: parsed.data.respiratorMake || null,
      respiratorModel: parsed.data.respiratorModel || null,
      respiratorSize: parsed.data.respiratorSize || null,
      fitFactor: parsed.data.fitFactor ?? null,
      passed: parsed.data.passed,
      testedAt: parsed.data.testedAt ? new Date(parsed.data.testedAt) : new Date(),
      testedBy: user.id,
      nextTestDueBy: parsed.data.nextTestDueBy ? new Date(parsed.data.nextTestDueBy) : null,
      notes: parsed.data.notes || null,
    })
    .returning();

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'respirator_fit_test',
    entityId: row.id,
    action: 'created',
    diffJson: { personId: parsed.data.personId, passed: parsed.data.passed },
  });

  return NextResponse.json({ fitTest: row }, { status: 201 });
});
