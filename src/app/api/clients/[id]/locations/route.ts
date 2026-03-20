import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, organizationLocations } from '@/db/schema';
import { getCurrentUser } from '@/auth/get-user';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const locationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(2, 'State is required').max(2, 'State must be 2 characters'),
  zip: z.string().min(5, 'ZIP code is required'),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

async function verifyClientAccess(user: any, clientOrgId: string) {
  const isTpaUser = user.role === 'tpa_admin' || user.role === 'tpa_staff' || user.role === 'platform_admin';
  if (!isTpaUser) return false;

  const clientOrg = await db.query.organizations.findFirst({
    where: user.tpaOrgId
      ? and(eq(organizations.id, clientOrgId), eq(organizations.tpaOrgId, user.tpaOrgId))
      : eq(organizations.id, clientOrgId),
  });

  return clientOrg && clientOrg.type === 'client';
}

// GET /api/clients/[id]/locations
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await verifyClientAccess(user, params.id))) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const locations = await db.query.organizationLocations.findMany({
    where: eq(organizationLocations.orgId, params.id),
    orderBy: (loc, { asc }) => [asc(loc.name)],
  });

  return NextResponse.json({ locations });
}

// POST /api/clients/[id]/locations
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await verifyClientAccess(user, params.id))) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = locationSchema.safeParse(body);
  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid data', details: validation.error.errors }, { status: 400 });
  }

  const [location] = await db
    .insert(organizationLocations)
    .values({ orgId: params.id, ...validation.data })
    .returning();

  return NextResponse.json({ location }, { status: 201 });
}

// PATCH /api/clients/[id]/locations
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await verifyClientAccess(user, params.id))) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const body = await req.json();
  const { locationId, ...updateData } = body;
  if (!locationId) {
    return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  }

  const validation = locationSchema.partial().safeParse(updateData);
  if (!validation.success) {
    return NextResponse.json({ error: 'Invalid data', details: validation.error.errors }, { status: 400 });
  }

  const [location] = await db
    .update(organizationLocations)
    .set({ ...validation.data, updatedAt: new Date() })
    .where(and(eq(organizationLocations.id, locationId), eq(organizationLocations.orgId, params.id)))
    .returning();

  if (!location) {
    return NextResponse.json({ error: 'Location not found' }, { status: 404 });
  }

  return NextResponse.json({ location });
}

// DELETE /api/clients/[id]/locations
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await verifyClientAccess(user, params.id))) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 });
  }

  const body = await req.json();
  const { locationId } = body;
  if (!locationId) {
    return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  }

  await db
    .delete(organizationLocations)
    .where(and(eq(organizationLocations.id, locationId), eq(organizationLocations.orgId, params.id)));

  return NextResponse.json({ message: 'Location deleted' });
}
