import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { leads } from '@/db/schema';
import { withPermission } from '@/auth/api-middleware';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createLeadSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  source: z.string().optional(),
  need: z.string().optional(),
  address: z.string().optional(),
  city: z.string().max(120).optional(),
  state: z.string().max(2).optional(),
  zip: z.string().max(10).optional(),
  employeeCount: z.number().int().optional(),
  notes: z.string().optional(),
});

// GET /api/leads — list leads for this TPA
export const GET = withPermission('view_leads', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const leadList = await db.query.leads.findMany({
    where: tpaOrgId ? eq(leads.tpaOrgId, tpaOrgId) : undefined,
    with: {
      owner: {
        columns: { id: true, name: true, email: true },
      },
    },
    orderBy: [desc(leads.createdAt)],
  });

  return NextResponse.json({ leads: leadList });
});

// POST /api/leads — create a new lead
export const POST = withPermission('manage_leads', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const body = await req.json();
  const validation = createLeadSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  const [newLead] = await db.insert(leads).values({
    tpaOrgId,
    companyName: data.companyName,
    contactName: data.contactName || null,
    contactEmail: data.contactEmail || null,
    contactPhone: data.contactPhone || null,
    source: data.source || null,
    need: data.need || null,
    address: data.address || null,
    city: data.city || null,
    state: data.state || null,
    zip: data.zip || null,
    employeeCount: data.employeeCount || null,
    notes: data.notes || null,
    ownedBy: user.id,
  }).returning();

  const fullLead = await db.query.leads.findFirst({
    where: eq(leads.id, newLead.id),
    with: {
      owner: { columns: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(
    { lead: fullLead, message: 'Lead created successfully' },
    { status: 201 }
  );
});
