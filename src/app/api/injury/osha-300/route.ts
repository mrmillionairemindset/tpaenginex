import { NextResponse } from 'next/server';
import { db } from '@/db';
import { injuries, organizations } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { and, between, eq } from 'drizzle-orm';
import { createAuditLog } from '@/lib/audit';
import { generateOsha300Log } from '@/lib/pdf';

export const dynamic = 'force-dynamic';

export const GET = withPermission('view_injuries', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;
  if (!tpaOrgId && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'TPA organization context required' }, { status: 400 });
  }

  // client_admin: not allowed to generate a company-wide OSHA 300 log;
  // that is TPA-level recordkeeping.
  if (user.role === 'client_admin') {
    return NextResponse.json(
      { error: 'OSHA 300 log generation is not available to client accounts' },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get('year');
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getUTCFullYear();
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }

  const clientOrgIdFilter = searchParams.get('clientOrgId');

  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

  const whereParts: any[] = [
    eq(injuries.oshaRecordable, true),
    between(injuries.incidentDate, yearStart, yearEnd),
  ];
  if (tpaOrgId) whereParts.push(eq(injuries.tpaOrgId, tpaOrgId));
  if (clientOrgIdFilter) whereParts.push(eq(injuries.clientOrgId, clientOrgIdFilter));

  const rows = await db.query.injuries.findMany({
    where: and(...whereParts),
    with: {
      person: { columns: { firstName: true, lastName: true } },
      clientOrg: { columns: { id: true, name: true } },
    },
    orderBy: (i, { asc }) => [asc(i.incidentDate)],
  });

  // Resolve TPA / establishment name. If a clientOrg filter is applied, we
  // use the client's name; otherwise the TPA's. This matches the OSHA notion
  // that one 300 log belongs to one "establishment".
  let establishmentName = 'Establishment';
  if (clientOrgIdFilter) {
    const clientOrg = await db.query.organizations.findFirst({
      where: eq(organizations.id, clientOrgIdFilter),
      columns: { name: true },
    });
    establishmentName = clientOrg?.name ?? establishmentName;
  } else if (tpaOrgId) {
    const tpaOrg = await db.query.organizations.findFirst({
      where: eq(organizations.id, tpaOrgId),
      columns: { name: true },
    });
    establishmentName = tpaOrg?.name ?? establishmentName;
  }

  const pdf = await generateOsha300Log({
    year,
    establishmentName,
    injuries: rows.map((r) => ({
      incidentNumber: r.incidentNumber,
      employeeName: `${r.person.firstName} ${r.person.lastName}`,
      jobAtIncident: r.jobAtIncident ?? '',
      incidentDate: r.incidentDate,
      location: r.location,
      description: r.description,
      injuryType: r.injuryType,
      severity: r.severity as any,
      lostDaysCount: r.lostDaysCount,
      restrictedDaysCount: r.restrictedDaysCount,
    })),
  });

  if (tpaOrgId) {
    await createAuditLog({
      tpaOrgId,
      actorUserId: user.id,
      actorEmail: user.email!,
      entityType: 'osha_300',
      entityId: `${tpaOrgId}:${year}`,
      action: 'generated',
      diffJson: { year, rowCount: rows.length, clientOrgId: clientOrgIdFilter ?? null },
    });
  }

  return new NextResponse(pdf as any, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="osha-300-${year}.pdf"`,
      'Cache-Control': 'no-store',
    },
  });
});
