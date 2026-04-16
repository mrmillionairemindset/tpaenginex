import { NextResponse } from 'next/server';
import { db } from '@/db';
import { injuries, persons } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, count, desc, eq } from 'drizzle-orm';
import { parsePagination } from '@/lib/pagination';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import {
  generateIncidentNumber,
  isOshaRecordableBySeverity,
  type InjurySeverity,
} from '@/lib/injury';

export const dynamic = 'force-dynamic';

const severityEnum = z.enum([
  'first_aid',
  'medical',
  'lost_time',
  'restricted_duty',
  'fatality',
]);

const statusEnum = z.enum([
  'open',
  'in_treatment',
  'rtw_eval_pending',
  'rtw_full_duty',
  'rtw_restricted',
  'closed',
  'litigation',
]);

const createIncidentSchema = z
  .object({
    personId: z.string().uuid().optional(),
    person: z
      .object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        dob: z.string().optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
      })
      .optional(),
    clientOrgId: z.string().uuid().optional(),
    incidentDate: z.string().datetime(),
    location: z.string().min(1).max(500),
    jobAtIncident: z.string().max(200).optional(),
    bodyPartsAffected: z.array(z.string()).default([]),
    injuryType: z.string().min(1).max(50),
    description: z.string().min(1).max(5000),
    witnessIds: z.array(z.string().uuid()).optional(),
    severity: severityEnum,
    oshaRecordable: z.boolean().optional(), // override; else derived from severity
    workersCompClaimNumber: z.string().max(50).optional(),
    workersCompCarrier: z.string().max(200).optional(),
    notes: z.string().max(5000).optional(),
    internalNotes: z.string().max(5000).optional(),
  })
  .refine((v) => v.personId || v.person, {
    message: 'Either personId or person data is required',
  });

// ============================================================================
// GET /api/injury/incidents
// ============================================================================

export const GET = withPermission('view_injuries', async (req, user) => {
  const { searchParams } = new URL(req.url);
  const tpaOrgId = user.tpaOrgId;
  const { page, limit, offset } = parsePagination(searchParams);

  if (!tpaOrgId && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  let where: any;
  if (user.role === 'platform_admin' && !tpaOrgId) {
    where = undefined;
  } else {
    where = eq(injuries.tpaOrgId, tpaOrgId!);
  }

  // client_admin only sees their own client org's incidents
  if (user.role === 'client_admin') {
    if (!user.orgId) {
      return NextResponse.json({
        incidents: [],
        pagination: { page, limit, total: 0, totalPages: 0, hasMore: false },
      });
    }
    where = where
      ? and(where, eq(injuries.clientOrgId, user.orgId))
      : eq(injuries.clientOrgId, user.orgId);
  }

  const addFilter = (filter: any) => {
    where = where ? and(where, filter) : filter;
  };

  const statusParam = searchParams.get('status');
  const severityParam = searchParams.get('severity');
  const clientOrgId = searchParams.get('clientOrgId');
  const personId = searchParams.get('personId');
  const oshaRecordable = searchParams.get('oshaRecordable');

  if (statusParam) addFilter(eq(injuries.status, statusParam as any));
  if (severityParam) addFilter(eq(injuries.severity, severityParam as any));
  if (clientOrgId) addFilter(eq(injuries.clientOrgId, clientOrgId));
  if (personId) addFilter(eq(injuries.personId, personId));
  if (oshaRecordable === 'true') addFilter(eq(injuries.oshaRecordable, true));
  if (oshaRecordable === 'false') addFilter(eq(injuries.oshaRecordable, false));

  const [rows, totalRows] = await Promise.all([
    db.query.injuries.findMany({
      where,
      with: {
        person: { columns: { id: true, firstName: true, lastName: true, email: true } },
        clientOrg: { columns: { id: true, name: true } },
      },
      orderBy: [desc(injuries.incidentDate)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(injuries).where(where),
  ]);

  // Strip internalNotes for client_admin
  const incidents = rows.map((r) => {
    if (user.role === 'client_admin') {
      const { internalNotes: _omit, ...safe } = r as any;
      return safe;
    }
    return r;
  });

  const total = Number(totalRows[0]?.count ?? 0);
  return NextResponse.json({
    incidents,
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
// POST /api/injury/incidents
// ============================================================================

export const POST = withPermission('manage_injuries', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createIncidentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 },
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
  } else {
    const p = data.person!;
    const [created] = await db
      .insert(persons)
      .values({
        orgId: data.clientOrgId ?? user.organization!.id,
        tpaOrgId,
        personType: 'employee',
        firstName: p.firstName,
        lastName: p.lastName,
        dob: p.dob || '01/01/1900',
        ssnLast4: '0000',
        phone: p.phone || '',
        email: p.email || '',
      })
      .returning();
    personId = created.id;
  }

  // Determine OSHA recordability (severity default, optional override).
  const oshaRecordable =
    data.oshaRecordable ?? isOshaRecordableBySeverity(data.severity as InjurySeverity);

  // Generate a fresh incident number. Retry up to 3 times on unique-violation
  // to handle rare races (another concurrent insert grabbed the same seq).
  let injury: typeof injuries.$inferSelect | null = null;
  let lastErr: unknown = null;
  const year = new Date(data.incidentDate).getUTCFullYear();
  for (let attempt = 0; attempt < 3; attempt++) {
    const incidentNumber = await generateIncidentNumber({ tpaOrgId, year });
    try {
      const [row] = await db
        .insert(injuries)
        .values({
          tpaOrgId,
          clientOrgId: data.clientOrgId ?? null,
          personId,
          incidentNumber,
          incidentDate: new Date(data.incidentDate),
          reportedBy: user.id,
          location: data.location,
          jobAtIncident: data.jobAtIncident || null,
          bodyPartsAffected: data.bodyPartsAffected,
          injuryType: data.injuryType,
          description: data.description,
          witnessIds: data.witnessIds ?? [],
          severity: data.severity,
          oshaRecordable,
          workersCompClaimNumber: data.workersCompClaimNumber || null,
          workersCompCarrier: data.workersCompCarrier || null,
          notes: data.notes || null,
          internalNotes: data.internalNotes || null,
        })
        .returning();
      injury = row;
      break;
    } catch (err: any) {
      lastErr = err;
      // Postgres unique-violation error code = '23505'
      if (err?.code !== '23505') throw err;
    }
  }
  if (!injury) {
    console.error('[injury/incidents] failed after retries:', lastErr);
    return NextResponse.json(
      { error: 'Could not generate a unique incident number; please retry' },
      { status: 500 },
    );
  }

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'injury',
    entityId: injury.id,
    action: 'created',
    diffJson: {
      incidentNumber: injury.incidentNumber,
      personId,
      clientOrgId: data.clientOrgId ?? null,
      severity: data.severity,
      oshaRecordable,
    },
  });

  const full = await db.query.injuries.findFirst({
    where: eq(injuries.id, injury.id),
    with: {
      person: { columns: { id: true, firstName: true, lastName: true, email: true } },
      clientOrg: { columns: { id: true, name: true } },
    },
  });

  return NextResponse.json({ incident: full, message: 'Incident recorded' }, { status: 201 });
});
