import { NextResponse } from 'next/server';
import { db } from '@/db';
import { batTests, persons } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, desc, eq, count } from 'drizzle-orm';
import { parsePagination } from '@/lib/pagination';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  personId: z.string().uuid(),
  orderId: z.string().uuid().optional(),
  examId: z.string().uuid().optional(),
  deviceMake: z.string().max(100).optional(),
  deviceSerial: z.string().max(100).optional(),
  deviceCalibrationDate: z.string().datetime().optional(),
  testDate: z.string().datetime().optional(),
  screeningResult: z.string().max(10).optional(),
  confirmationResult: z.string().max(10).optional(),
  status: z.enum(['negative', 'positive', 'refused', 'invalid', 'pending']).optional(),
  reasonForTest: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
});

export const GET = withPermission('view_bat', async (req, user) => {
  const { searchParams } = new URL(req.url);
  const tpaOrgId = user.tpaOrgId;
  const { page, limit, offset } = parsePagination(searchParams);
  const personId = searchParams.get('personId');
  const statusParam = searchParams.get('status');

  let where: any = tpaOrgId ? eq(batTests.tpaOrgId, tpaOrgId) : undefined;
  if (personId) where = where ? and(where, eq(batTests.personId, personId)) : eq(batTests.personId, personId);
  if (statusParam)
    where = where ? and(where, eq(batTests.status, statusParam as any)) : eq(batTests.status, statusParam as any);

  const [rows, totalRows] = await Promise.all([
    db.query.batTests.findMany({
      where,
      with: {
        person: { columns: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [desc(batTests.testDate)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(batTests).where(where),
  ]);

  const total = Number(totalRows[0]?.count ?? 0);
  return NextResponse.json({
    batTests: rows,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasMore: offset + rows.length < total },
  });
});

export const POST = withPermission('manage_bat', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) return NextResponse.json({ error: 'TPA context required' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.errors }, { status: 400 });
  }

  // Verify person belongs to tenant
  const person = await db.query.persons.findFirst({
    where: and(eq(persons.id, parsed.data.personId), eq(persons.tpaOrgId, tpaOrgId)),
  });
  if (!person) return NextResponse.json({ error: 'Person not found' }, { status: 404 });

  const [row] = await db
    .insert(batTests)
    .values({
      tpaOrgId,
      personId: parsed.data.personId,
      orderId: parsed.data.orderId || null,
      examId: parsed.data.examId || null,
      batTechnicianId: user.id,
      deviceMake: parsed.data.deviceMake || null,
      deviceSerial: parsed.data.deviceSerial || null,
      deviceCalibrationDate: parsed.data.deviceCalibrationDate
        ? new Date(parsed.data.deviceCalibrationDate)
        : null,
      testDate: parsed.data.testDate ? new Date(parsed.data.testDate) : new Date(),
      screeningResult: parsed.data.screeningResult || null,
      confirmationResult: parsed.data.confirmationResult || null,
      status: parsed.data.status || 'pending',
      reasonForTest: parsed.data.reasonForTest || null,
      notes: parsed.data.notes || null,
    })
    .returning();

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'bat_test',
    entityId: row.id,
    action: 'created',
    diffJson: { personId: parsed.data.personId, status: parsed.data.status },
  });

  return NextResponse.json({ batTest: row }, { status: 201 });
});
