import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, organizationMembers, users, tpaSettings } from '@/db/schema';
import { withPlatformAuth } from '@/auth/api-middleware';
import { eq, count, asc } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const provisionTpaSchema = z.object({
  name: z.string().min(1, 'TPA name is required'),
  adminEmail: z.string().email('Valid admin email is required'),
});

// GET /api/platform/tpas — list all TPA organizations
export const GET = withPlatformAuth(async (req, user) => {
  const tpaOrgs = await db.query.organizations.findMany({
    where: eq(organizations.type, 'tpa'),
    orderBy: [asc(organizations.name)],
  });

  // Get member counts for each TPA
  const tpasWithCounts = await Promise.all(
    tpaOrgs.map(async (tpa: typeof organizations.$inferSelect) => {
      const [memberResult] = await db
        .select({ count: count() })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, tpa.id));

      return {
        ...tpa,
        memberCount: memberResult.count,
      };
    })
  );

  return NextResponse.json({ tpas: tpasWithCounts });
});

// POST /api/platform/tpas — provision a new TPA
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

  // Auto-generate slug from name
  const slug = data.name
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
    // Update existing user to be part of this TPA
    await db.update(users).set({
      orgId: newOrg.id,
      role: 'tpa_admin',
      updatedAt: new Date(),
    }).where(eq(users.id, existingUser.id));
    adminUser = existingUser;
  } else {
    // Create invited admin user with temp password
    const [newUser] = await db.insert(users).values({
      email: data.adminEmail,
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
