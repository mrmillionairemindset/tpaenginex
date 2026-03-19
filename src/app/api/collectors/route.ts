import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { collectors } from '@/db/schema';
import { withAuth, withPermission } from '@/auth/api-middleware';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createCollectorSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(1, 'Phone is required'),
  certifications: z.array(z.string()).optional(),
  serviceArea: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/collectors — list collectors for this TPA
export const GET = withAuth(async (req, user) => {
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const whereClause = tpaOrgId ? eq(collectors.tpaOrgId, tpaOrgId) : undefined;

  const collectorList = await db.query.collectors.findMany({
    where: whereClause ? and(whereClause, eq(collectors.isActive, true)) : eq(collectors.isActive, true),
    orderBy: [desc(collectors.createdAt)],
  });

  return NextResponse.json({ collectors: collectorList });
});

// POST /api/collectors — create a new collector (tpa_admin only)
export const POST = withPermission('manage_collectors', async (req, user) => {
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const body = await req.json();
  const validation = createCollectorSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  const [newCollector] = await db.insert(collectors).values({
    tpaOrgId,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    phone: data.phone,
    certifications: data.certifications || null,
    serviceArea: data.serviceArea || null,
    notes: data.notes || null,
  }).returning();

  return NextResponse.json(
    { collector: newCollector, message: 'Collector created successfully' },
    { status: 201 }
  );
});
