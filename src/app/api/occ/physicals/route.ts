import { NextResponse } from 'next/server';
import { db } from '@/db';
import { physicalExams, persons } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, desc, eq, count } from 'drizzle-orm';
import { parsePagination } from '@/lib/pagination';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// ============================================================================
// Validation schemas
// ============================================================================

const examTypeEnum = z.enum([
  'dot',
  'non_dot',
  'pre_employment',
  'return_to_duty',
  'follow_up',
  'annual',
]);

const createExamSchema = z.object({
  personId: z.string().uuid().optional(),
  person: z
    .object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      dob: z.string().optional(),
      ssnLast4: z.string().max(4).optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      state: z.string().max(2).optional(),
      zip: z.string().optional(),
    })
    .optional(),
  clientOrgId: z.string().uuid().optional(),
  examType: examTypeEnum,
  scheduledFor: z.string().datetime().optional(),
  notes: z.string().max(5000).optional(),
});

// ============================================================================
// GET /api/occ/physicals — list exams for TPA
// ============================================================================

export const GET = withPermission('view_physicals', async (req, user) => {
  const { searchParams } = new URL(req.url);
  const tpaOrgId = user.tpaOrgId;
  const { page, limit, offset } = parsePagination(searchParams);

  const statusParam = searchParams.get('status');
  const personId = searchParams.get('personId');
  const clientOrgId = searchParams.get('clientOrgId');
  const examinerId = searchParams.get('examinerId');
  const examType = searchParams.get('examType');

  let whereClause: any;
  if (user.role === 'platform_admin' && !tpaOrgId) {
    whereClause = undefined;
  } else if (tpaOrgId) {
    whereClause = eq(physicalExams.tpaOrgId, tpaOrgId);
  } else {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  const addFilter = (filter: any) => {
    whereClause = whereClause ? and(whereClause, filter) : filter;
  };
  if (statusParam) addFilter(eq(physicalExams.status, statusParam as any));
  if (personId) addFilter(eq(physicalExams.personId, personId));
  if (clientOrgId) addFilter(eq(physicalExams.clientOrgId, clientOrgId));
  if (examinerId) addFilter(eq(physicalExams.examinerId, examinerId));
  if (examType) addFilter(eq(physicalExams.examType, examType as any));

  const [rows, totalRows] = await Promise.all([
    db.query.physicalExams.findMany({
      where: whereClause,
      with: {
        person: { columns: { id: true, firstName: true, lastName: true, email: true } },
        clientOrg: { columns: { id: true, name: true } },
        examiner: { columns: { id: true, name: true, email: true, nrcmeNumber: true } },
      },
      orderBy: [desc(physicalExams.createdAt)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(physicalExams).where(whereClause),
  ]);

  const total = Number(totalRows[0]?.count ?? 0);
  return NextResponse.json({
    exams: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + rows.length < total,
    },
  });
});

// ============================================================================
// POST /api/occ/physicals — schedule exam
// ============================================================================

export const POST = withPermission('manage_physicals', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createExamSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Resolve person
  let personId: string;
  if (data.personId) {
    const existing = await db.query.persons.findFirst({
      where: and(eq(persons.id, data.personId), eq(persons.tpaOrgId, tpaOrgId)),
    });
    if (!existing) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }
    personId = existing.id;
  } else if (data.person) {
    const [created] = await db
      .insert(persons)
      .values({
        orgId: user.organization!.id,
        tpaOrgId,
        personType: 'patient',
        firstName: data.person.firstName,
        lastName: data.person.lastName,
        dob: data.person.dob || '01/01/1900',
        ssnLast4: data.person.ssnLast4 || '0000',
        phone: data.person.phone || '',
        email: data.person.email || '',
        address: data.person.address,
        city: data.person.city,
        state: data.person.state,
        zip: data.person.zip,
      })
      .returning();
    personId = created.id;
  } else {
    return NextResponse.json(
      { error: 'Either personId or person data is required' },
      { status: 400 }
    );
  }

  const [exam] = await db
    .insert(physicalExams)
    .values({
      tpaOrgId,
      clientOrgId: data.clientOrgId || null,
      personId,
      examType: data.examType,
      scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : null,
      status: 'scheduled',
      fmcsaSubmissionStatus: data.examType === 'dot' ? 'pending' : 'not_required',
      notes: data.notes || null,
    })
    .returning();

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'physical_exam',
    entityId: exam.id,
    action: 'scheduled',
    diffJson: { examType: data.examType, personId, clientOrgId: data.clientOrgId },
  });

  const full = await db.query.physicalExams.findFirst({
    where: eq(physicalExams.id, exam.id),
    with: {
      person: { columns: { id: true, firstName: true, lastName: true, email: true } },
      clientOrg: { columns: { id: true, name: true } },
    },
  });

  return NextResponse.json({ exam: full, message: 'Physical exam scheduled' }, { status: 201 });
});
