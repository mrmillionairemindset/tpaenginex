import { NextResponse } from 'next/server';
import { db } from '@/db';
import {
  backgroundChecks,
  backgroundCheckPackages,
  persons,
  organizations,
} from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, count, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { parsePagination } from '@/lib/pagination';
import { z } from 'zod';
import { createAuditLog } from '@/lib/audit';
import { getDefaultCheckrClient } from '@/lib/checkr-client';
import { loadCheckrCredentials } from '@/lib/checkr-credentials';
import { enqueueWebhookEvent } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

const createCheckSchema = z
  .object({
    personId: z.string().uuid().optional(),
    person: z
      .object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        middleName: z.string().optional(),
        dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        email: z.string().email(),
        phone: z.string().optional(),
        ssn: z.string().optional(),
        zipcode: z.string().optional(),
        driverLicenseNumber: z.string().optional(),
        driverLicenseState: z.string().length(2).optional(),
      })
      .optional(),
    clientOrgId: z.string().uuid().optional(),
    packageId: z.string().uuid(),
    notes: z.string().max(5000).optional(),
  })
  .refine((v) => v.personId || v.person, {
    message: 'Either personId or person data is required',
  });

// GET /api/background/checks — list checks scoped by role
export const GET = withPermission('view_background_checks', async (req, user) => {
  const { searchParams } = new URL(req.url);
  const tpaOrgId = user.tpaOrgId;
  const { page, limit, offset } = parsePagination(searchParams);

  if (!tpaOrgId && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  const statusParam = searchParams.get('status');
  const clientOrgId = searchParams.get('clientOrgId');
  const personId = searchParams.get('personId');
  const search = searchParams.get('search');

  let where: any;
  if (user.role === 'platform_admin' && !tpaOrgId) {
    where = undefined;
  } else {
    where = eq(backgroundChecks.tpaOrgId, tpaOrgId!);
  }

  // client_admin: further scope to their own client org's checks
  if (user.role === 'client_admin') {
    if (!user.orgId) {
      return NextResponse.json({ checks: [], pagination: { page, limit, total: 0, totalPages: 0, hasMore: false } });
    }
    where = where
      ? and(where, eq(backgroundChecks.clientOrgId, user.orgId))
      : eq(backgroundChecks.clientOrgId, user.orgId);
  }

  const addFilter = (filter: any) => {
    where = where ? and(where, filter) : filter;
  };
  if (statusParam) addFilter(eq(backgroundChecks.status, statusParam as any));
  if (clientOrgId) addFilter(eq(backgroundChecks.clientOrgId, clientOrgId));
  if (personId) addFilter(eq(backgroundChecks.personId, personId));

  // Search on person name/email via join — handled by filtering in memory after the join is too
  // expensive; we instead filter person rows first and include their IDs.
  if (search && search.trim() && tpaOrgId) {
    const pattern = `%${search.trim()}%`;
    const matching = await db
      .select({ id: persons.id })
      .from(persons)
      .where(
        and(
          eq(persons.tpaOrgId, tpaOrgId),
          or(
            ilike(persons.firstName, pattern),
            ilike(persons.lastName, pattern),
            ilike(persons.email, pattern),
          ),
        ),
      );
    const ids = matching.map((r) => r.id);
    if (ids.length === 0) {
      return NextResponse.json({
        checks: [],
        pagination: { page, limit, total: 0, totalPages: 0, hasMore: false },
      });
    }
    addFilter(inArray(backgroundChecks.personId, ids));
  }

  const [rows, totalRows] = await Promise.all([
    db.query.backgroundChecks.findMany({
      where,
      with: {
        person: { columns: { id: true, firstName: true, lastName: true, email: true } },
        clientOrg: { columns: { id: true, name: true } },
        package: { columns: { id: true, name: true, providerPackageSlug: true, retailPriceCents: true } },
      },
      orderBy: [desc(backgroundChecks.createdAt)],
      limit,
      offset,
    }),
    db.select({ count: count() }).from(backgroundChecks).where(where),
  ]);

  // Strip internalNotes from client_admin response
  const checks = rows.map((r) => {
    if (user.role === 'client_admin') {
      const { internalNotes: _omit, ...safe } = r as any;
      return safe;
    }
    return r;
  });

  const total = Number(totalRows[0]?.count ?? 0);
  return NextResponse.json({
    checks,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: offset + rows.length < total,
    },
  });
});

// POST /api/background/checks — create a check (calls Checkr)
export const POST = withPermission('manage_background_checks', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createCheckSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: parsed.error.errors },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // Resolve package
  const pkg = await db.query.backgroundCheckPackages.findFirst({
    where: and(
      eq(backgroundCheckPackages.id, data.packageId),
      eq(backgroundCheckPackages.tpaOrgId, tpaOrgId),
      eq(backgroundCheckPackages.isActive, true),
    ),
  });
  if (!pkg) {
    return NextResponse.json({ error: 'Package not found or inactive' }, { status: 404 });
  }

  // Resolve optional client
  if (data.clientOrgId) {
    const client = await db.query.organizations.findFirst({
      where: and(eq(organizations.id, data.clientOrgId), eq(organizations.tpaOrgId, tpaOrgId)),
    });
    if (!client) {
      return NextResponse.json({ error: 'Client organization not found' }, { status: 404 });
    }
  }

  // Resolve person (existing or new)
  let personRow: typeof persons.$inferSelect | null = null;
  if (data.personId) {
    personRow = (await db.query.persons.findFirst({
      where: and(eq(persons.id, data.personId), eq(persons.tpaOrgId, tpaOrgId)),
    })) ?? null;
    if (!personRow) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }
  } else if (data.person) {
    const [created] = await db
      .insert(persons)
      .values({
        orgId: data.clientOrgId ?? user.organization!.id,
        tpaOrgId,
        personType: 'candidate',
        firstName: data.person.firstName,
        lastName: data.person.lastName,
        dob: data.person.dob,
        ssnLast4: data.person.ssn ? data.person.ssn.slice(-4) : '0000',
        phone: data.person.phone || '',
        email: data.person.email,
        zip: data.person.zipcode,
      })
      .returning();
    personRow = created;
  }
  if (!personRow) {
    return NextResponse.json({ error: 'Could not resolve person' }, { status: 400 });
  }

  // Create the background_checks row in 'pending' first so we have an ID to use
  // as Checkr's custom_id. If the Checkr call fails we delete the row.
  const [check] = await db
    .insert(backgroundChecks)
    .values({
      tpaOrgId,
      clientOrgId: data.clientOrgId ?? null,
      personId: personRow.id,
      packageId: pkg.id,
      provider: pkg.provider,
      status: 'pending',
      notes: data.notes ?? null,
      requestedBy: user.id,
    })
    .returning();

  // Call Checkr
  const checkrClient = getDefaultCheckrClient(loadCheckrCredentials);

  const candidateInput = {
    firstName: data.person?.firstName ?? personRow.firstName,
    lastName: data.person?.lastName ?? personRow.lastName,
    middleName: data.person?.middleName,
    email: data.person?.email ?? personRow.email,
    phone: data.person?.phone ?? personRow.phone ?? undefined,
    dob: data.person?.dob ?? personRow.dob,
    ssn: data.person?.ssn,
    zipcode: data.person?.zipcode ?? personRow.zip ?? undefined,
    driverLicenseNumber: data.person?.driverLicenseNumber,
    driverLicenseState: data.person?.driverLicenseState,
    externalPersonId: personRow.id,
  };

  const candResult = await checkrClient.createCandidate(tpaOrgId, candidateInput);
  if (!candResult.ok) {
    // Rollback
    await db.delete(backgroundChecks).where(eq(backgroundChecks.id, check.id));
    return NextResponse.json(
      { error: 'Checkr createCandidate failed', errorCode: candResult.errorCode, errorMessage: candResult.errorMessage },
      { status: 502 },
    );
  }

  const reportResult = await checkrClient.createReport(tpaOrgId, {
    candidateId: candResult.data.id,
    packageSlug: pkg.providerPackageSlug,
    externalCheckId: check.id,
  });
  if (!reportResult.ok) {
    await db.delete(backgroundChecks).where(eq(backgroundChecks.id, check.id));
    return NextResponse.json(
      { error: 'Checkr createReport failed', errorCode: reportResult.errorCode, errorMessage: reportResult.errorMessage },
      { status: 502 },
    );
  }

  const now = new Date();
  await db
    .update(backgroundChecks)
    .set({
      externalCandidateId: candResult.data.id,
      candidateInviteUrl: candResult.data.inviteUrl,
      externalId: reportResult.data.id,
      status: reportResult.data.status,
      hostedReportUrl: reportResult.data.hostedUrl,
      submittedAt: now,
      updatedAt: now,
    })
    .where(eq(backgroundChecks.id, check.id));

  await createAuditLog({
    tpaOrgId,
    actorUserId: user.id,
    actorEmail: user.email!,
    entityType: 'background_check',
    entityId: check.id,
    action: 'created',
    diffJson: {
      personId: personRow.id,
      packageId: pkg.id,
      externalId: reportResult.data.id,
      clientOrgId: data.clientOrgId ?? null,
    },
  });

  await enqueueWebhookEvent({
    tpaOrgId,
    event: 'background_check.created',
    payload: {
      id: check.id,
      personId: personRow.id,
      clientOrgId: data.clientOrgId ?? null,
      packageId: pkg.id,
      status: reportResult.data.status,
      externalId: reportResult.data.id,
    },
  });

  const full = await db.query.backgroundChecks.findFirst({
    where: eq(backgroundChecks.id, check.id),
    with: {
      person: { columns: { id: true, firstName: true, lastName: true, email: true } },
      clientOrg: { columns: { id: true, name: true } },
      package: { columns: { id: true, name: true, providerPackageSlug: true, retailPriceCents: true } },
    },
  });

  return NextResponse.json(
    { check: full, candidateInviteUrl: candResult.data.inviteUrl, message: 'Background check created' },
    { status: 201 },
  );
});
