import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, organizationMembers, users, tpaSettings, orders, events } from '@/db/schema';
import { withPlatformAuth } from '@/auth/api-middleware';
import { eq, and, count } from 'drizzle-orm';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const updateTpaSchema = z.object({
  name: z.string().min(1).optional(),
  contactEmail: z.string().email().optional().nullable(),
  contactPhone: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// GET /api/platform/tenants/[id] — TPA detail (no PHI)
export const GET = withPlatformAuth(async (req, user, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  const tpa = await db.query.organizations.findFirst({
    where: and(eq(organizations.id, id), eq(organizations.type, 'tpa')),
  });

  if (!tpa) {
    return NextResponse.json({ error: 'TPA not found' }, { status: 404 });
  }

  // Get TPA settings
  const settings = await db.query.tpaSettings.findFirst({
    where: eq(tpaSettings.tpaOrgId, id),
  });

  // Get users (staff) — name, email, role only. No PHI.
  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, id));

  // Get client orgs — name and contact only. No orders/candidates.
  const clientOrgs = await db.query.organizations.findMany({
    where: and(eq(organizations.tpaOrgId, id), eq(organizations.type, 'client')),
    columns: {
      id: true,
      name: true,
      contactEmail: true,
      contactPhone: true,
      isActive: true,
      createdAt: true,
    },
  });

  // Aggregate counts only — no actual record data
  const [orderCount] = await db
    .select({ count: count() })
    .from(orders)
    .where(eq(orders.tpaOrgId, id));

  const [eventCount] = await db
    .select({ count: count() })
    .from(events)
    .where(eq(events.tpaOrgId, id));

  return NextResponse.json({
    tpa: {
      id: tpa.id,
      name: tpa.name,
      slug: tpa.slug,
      contactEmail: tpa.contactEmail,
      contactPhone: tpa.contactPhone,
      isActive: tpa.isActive,
      createdAt: tpa.createdAt,
      updatedAt: tpa.updatedAt,
    },
    settings: settings ? {
      brandName: settings.brandName,
      logoUrl: settings.logoUrl,
      primaryColor: settings.primaryColor,
      replyToEmail: settings.replyToEmail,
      timezone: settings.timezone,
      dotCompanyName: settings.dotCompanyName,
      dotConsortiumId: settings.dotConsortiumId,
      defaultCollectionWindowHours: settings.defaultCollectionWindowHours,
    } : null,
    members,
    clients: clientOrgs,
    stats: {
      totalOrders: orderCount.count,
      totalEvents: eventCount.count,
      totalClients: clientOrgs.length,
      totalUsers: members.length,
    },
  });
});

// PATCH /api/platform/tenants/[id] — update TPA info
export const PATCH = withPlatformAuth(async (req, user, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  const tpa = await db.query.organizations.findFirst({
    where: and(eq(organizations.id, id), eq(organizations.type, 'tpa')),
  });

  if (!tpa) {
    return NextResponse.json({ error: 'TPA not found' }, { status: 404 });
  }

  const body = await req.json();
  const validation = updateTpaSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  const [updated] = await db.update(organizations).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(organizations.id, id)).returning();

  return NextResponse.json({ tpa: updated });
});
