import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, organizationMembers, users, tpaSettings } from '@/db/schema';
import { withPlatformAuth } from '@/auth/api-middleware';
import { eq, and, count, asc } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const provisionTpaSchema = z.object({
  name: z.string().min(1, 'TPA name is required'),
  slug: z.string().min(1).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  adminName: z.string().min(1, 'Admin name is required'),
  adminEmail: z.string().email('Valid admin email is required'),
});

// GET /api/platform/tenants — list all TPA organizations with counts
export const GET = withPlatformAuth(async (req, user) => {
  const tpaOrgs = await db.query.organizations.findMany({
    where: eq(organizations.type, 'tpa'),
    orderBy: [asc(organizations.name)],
  });

  // Get member counts and client counts for each TPA
  const tpasWithCounts = await Promise.all(
    tpaOrgs.map(async (tpa: typeof organizations.$inferSelect) => {
      const [memberResult] = await db
        .select({ count: count() })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, tpa.id));

      const [clientResult] = await db
        .select({ count: count() })
        .from(organizations)
        .where(and(
          eq(organizations.tpaOrgId, tpa.id),
          eq(organizations.type, 'client'),
        ));

      return {
        id: tpa.id,
        name: tpa.name,
        slug: tpa.slug,
        contactEmail: tpa.contactEmail,
        contactPhone: tpa.contactPhone,
        isActive: tpa.isActive,
        createdAt: tpa.createdAt,
        userCount: memberResult.count,
        clientCount: clientResult.count,
      };
    })
  );

  return NextResponse.json({ tenants: tpasWithCounts });
});

// POST /api/platform/tenants — provision a new TPA
export const POST = withPlatformAuth(async (req, user) => {
  const body = await req.json();
  const validation = provisionTpaSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.errors },
      { status: 400 }
    );
  }

  const data = validation.data;

  // Auto-generate slug from name if not provided
  const slug = data.slug || data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80)
    + '-' + Date.now().toString(36);

  // Generate temporary password
  const tempPassword = crypto.randomBytes(16).toString('hex');

  // Create the TPA organization
  const [newOrg] = await db.insert(organizations).values({
    name: data.name,
    slug,
    type: 'tpa',
    contactEmail: data.contactEmail || null,
    contactPhone: data.contactPhone || null,
  }).returning();

  // Create tpa_settings row
  await db.insert(tpaSettings).values({
    tpaOrgId: newOrg.id,
    brandName: data.name,
  });

  // Check if admin user already exists
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, data.adminEmail),
  });

  let adminUser;

  if (existingUser) {
    await db.update(users).set({
      orgId: newOrg.id,
      role: 'tpa_admin',
      name: data.adminName || existingUser.name,
      updatedAt: new Date(),
    }).where(eq(users.id, existingUser.id));
    adminUser = existingUser;
  } else {
    const [newUser] = await db.insert(users).values({
      email: data.adminEmail,
      name: data.adminName,
      password: tempPassword,
      orgId: newOrg.id,
      role: 'tpa_admin',
    }).returning();
    adminUser = newUser;
  }

  // Add user as organization member
  await db.insert(organizationMembers).values({
    userId: adminUser.id,
    organizationId: newOrg.id,
    role: 'tpa_admin',
    invitedBy: user.id,
  });

  return NextResponse.json(
    {
      organization: newOrg,
      adminUser: {
        id: adminUser.id,
        email: adminUser.email,
        tempPassword: existingUser ? undefined : tempPassword,
      },
      message: 'TPA provisioned successfully',
    },
    { status: 201 }
  );
});
