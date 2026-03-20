import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, organizationMembers, orders } from '@/db/schema';
import { withAuth } from '@/auth/api-middleware';
import { eq, and, count, asc } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createClientSchema = z.object({
  name: z.string().min(1, 'Organization name is required'),
  contactEmail: z.string().email('Valid email is required'),
  contactPhone: z.string().min(1, 'Phone is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().length(2, 'State is required'),
  zip: z.string().min(5, 'ZIP code is required'),
});

// GET /api/clients — list client organizations for this TPA
export const GET = withAuth(async (req, user) => {
  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId && user.role !== 'platform_admin') {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  // Get client organizations
  const clients = await db.query.organizations.findMany({
    where: tpaOrgId
      ? and(eq(organizations.type, 'client'), eq(organizations.tpaOrgId, tpaOrgId))
      : eq(organizations.type, 'client'),
    orderBy: [asc(organizations.name)],
  });

  // Get member and order counts for each client
  const clientsWithCounts = await Promise.all(
    clients.map(async (client: typeof organizations.$inferSelect) => {
      const [memberResult] = await db
        .select({ count: count() })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, client.id));

      const [orderResult] = await db
        .select({ count: count() })
        .from(orders)
        .where(eq(orders.orgId, client.id));

      return {
        ...client,
        memberCount: memberResult.count,
        orderCount: orderResult.count,
      };
    })
  );

  return NextResponse.json({ clients: clientsWithCounts });
});

// POST /api/clients — create a new client organization
export const POST = withAuth(async (req, user) => {
  // Require tpa_admin role
  if (user.role !== 'tpa_admin' && user.role !== 'platform_admin') {
    return NextResponse.json(
      { error: 'Forbidden: tpa_admin role required' },
      { status: 403 }
    );
  }

  const tpaOrgId = user.tpaOrgId;

  if (!tpaOrgId) {
    return NextResponse.json({ error: 'TPA context required' }, { status: 400 });
  }

  const body = await req.json();
  const validation = createClientSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Auto-generate slug from name
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80)
    + '-' + Date.now().toString(36);

  const [newOrg] = await db.insert(organizations).values({
    name: data.name,
    slug,
    type: 'client',
    tpaOrgId,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,
    address: data.address,
    city: data.city,
    state: data.state,
    zip: data.zip,
  }).returning();

  return NextResponse.json(
    { client: newOrg, message: 'Client organization created successfully' },
    { status: 201 }
  );
});
