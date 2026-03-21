import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { organizations, organizationMembers, users, tpaSettings } from '@/db/schema';
import { withPlatformAuth } from '@/auth/api-middleware';
import { eq, and, count, asc } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

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

  // Send invite email to admin (async, don't block response)
  const loginUrl = `${process.env.NEXTAUTH_URL || 'https://app.tpaenginex.com'}/auth/signin`;
  sgMail.send({
    to: data.adminEmail,
    from: 'TPAEngineX <noreply@tpaenginex.com>',
    subject: `Your TPA Account is Ready — ${data.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Welcome to TPAEngineX</h1>
        </div>
        <div style="padding: 24px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p>Hi ${data.adminName},</p>
          <p>Your TPA account <strong>${data.name}</strong> has been created and is ready to use.</p>
          ${!existingUser ? `
            <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; margin: 20px 0;">
              <p style="margin: 0 0 8px 0;"><strong>Your login credentials:</strong></p>
              <p style="margin: 0;">Email: <strong>${data.adminEmail}</strong></p>
              <p style="margin: 0;">Temporary Password: <strong>${tempPassword}</strong></p>
            </div>
            <p>Please change your password after your first login.</p>
          ` : `
            <p>You can log in with your existing account: <strong>${data.adminEmail}</strong></p>
          `}
          <div style="text-align: center; margin: 24px 0;">
            <a href="${loginUrl}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: bold;">Log In to Your Account</a>
          </div>
          <p style="color: #6b7280; font-size: 14px;">If you have any questions, contact your platform administrator.</p>
        </div>
      </div>
    `,
  }).catch((err) => {
    console.error('Failed to send TPA invite email:', err);
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
