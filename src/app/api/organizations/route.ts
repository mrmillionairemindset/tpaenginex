import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { organizations, users, organizationMembers } from "@/db/schema";
import { withAuth } from "@/auth/api-middleware";
import { eq } from "drizzle-orm";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// GET /api/organizations - Get organizations
// For providers: returns all employer organizations with stats
// For employers: returns their own organization memberships
export const GET = withAuth(async (req, user) => {
  try {
    const isTpaUser = user.role?.startsWith('tpa_') || user.role === 'platform_admin';

    if (isTpaUser) {
      // Providers see all employer organizations with stats
      const employerOrgs = await db.query.organizations.findMany({
        where: eq(organizations.type, 'client'),
        with: {
          orders: {
            columns: {
              id: true,
            },
          },
          candidates: {
            columns: {
              id: true,
            },
          },
          members: {
            columns: {
              id: true,
            },
          },
        },
      });

      const formattedOrgs = employerOrgs.map((org) => ({
        ...org,
        _count: {
          orders: org.orders?.length || 0,
          candidates: org.candidates?.length || 0,
          users: org.members?.length || 0,
        },
      }));

      return NextResponse.json({ organizations: formattedOrgs });
    } else {
      // Employers see their own organization memberships
      const memberships = await db.query.organizationMembers.findMany({
        where: eq(organizationMembers.userId, user.id),
        with: {
          organization: true,
        },
      });

      const userOrgs = memberships.map((m) => ({
        ...m.organization,
        role: m.role,
        isActive: m.isActive,
      }));

      return NextResponse.json({ organizations: userOrgs });
    }
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { error: "Failed to fetch organizations" },
      { status: 500 }
    );
  }
});

// POST /api/organizations - Create new organization
export const POST = withAuth(async (request, user) => {
  try {
    const body = await request.json();
    const { name, type } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }

    if (!["tpa", "client"].includes(type)) {
      return NextResponse.json(
        { error: "Type must be tpa or client" },
        { status: 400 }
      );
    }

    // Create slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Create organization
    const [organization] = await db
      .insert(organizations)
      .values({
        name,
        type,
        slug,
        isActive: true,
      })
      .returning();

    // Assign creator as admin to the new organization
    const adminRole = type === "tpa" ? "tpa_admin" : "client_admin";

    await db.insert(organizationMembers).values({
      userId: user.id,
      organizationId: organization.id,
      role: adminRole,
      invitedBy: user.id,
      isActive: true,
    });

    // Update user's active organization
    await db
      .update(users)
      .set({ orgId: organization.id, role: adminRole })
      .where(eq(users.id, user.id));

    return NextResponse.json({ organization }, { status: 201 });
  } catch (error) {
    console.error("Error creating organization:", error);
    return NextResponse.json(
      { error: "Failed to create organization" },
      { status: 500 }
    );
  }
});
