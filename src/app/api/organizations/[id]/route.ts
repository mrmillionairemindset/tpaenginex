import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { organizations, organizationMembers, users } from "@/db/schema";
import { withAdminAuth } from "@/auth/api-middleware";
import { getCurrentUser } from "@/auth/get-user";
import { eq } from "drizzle-orm";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// GET /api/organizations/[id] - Get single organization
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only providers can view organization details
    if (!user.role?.startsWith('tpa_') && user.role !== 'platform_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const organization = await db.query.organizations.findFirst({
      where: eq(organizations.id, params.id),
      with: {
        orders: true,
        candidates: true,
        users: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Calculate counts
    const orgWithCounts = {
      ...organization,
      _count: {
        orders: organization.orders?.length || 0,
        candidates: organization.candidates?.length || 0,
        users: organization.users?.length || 0,
      },
      // Remove the actual arrays from response
      orders: undefined,
      candidates: undefined,
      users: undefined,
    };

    return NextResponse.json({ organization: orgWithCounts });
  } catch (error) {
    console.error('Error fetching organization:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

// PATCH /api/organizations/[id] - Update organization
export const PATCH = withAdminAuth(async (
  request,
  user,
  { params }: { params: { id: string } }
) => {
  try {
    // Ensure user is admin of THIS organization
    if (user.orgId !== params.id) {
      return NextResponse.json(
        { error: "You can only update your own organization" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Update organization
    const [updated] = await db
      .update(organizations)
      .set({ name })
      .where(eq(organizations.id, params.id))
      .returning();

    return NextResponse.json({ organization: updated });
  } catch (error) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: "Failed to update organization" },
      { status: 500 }
    );
  }
});

// DELETE /api/organizations/[id] - Delete organization
export const DELETE = withAdminAuth(async (
  request,
  user,
  { params }: { params: { id: string } }
) => {
  try {
    const orgId = params.id;

    // Check if organization exists
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
      with: {
        orders: true,
        candidates: true,
        members: true,
      },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Verify user is a member of this organization
    const isMember = org.members?.some(m => m.userId === user.id);
    if (!isMember) {
      return NextResponse.json(
        { error: "You can only delete organizations you're a member of" },
        { status: 403 }
      );
    }

    // Check if organization has orders or candidates
    if (org.orders && org.orders.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete organization with existing orders. Please contact support." },
        { status: 400 }
      );
    }

    if (org.candidates && org.candidates.length > 0) {
      return NextResponse.json(
        { error: "Cannot delete organization with existing candidates. Please contact support." },
        { status: 400 }
      );
    }

    // Get all members of this organization
    const members = org.members || [];

    // Delete organization memberships
    await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.organizationId, orgId));

    // For each user, if this was their active org, switch them to their first remaining membership
    for (const member of members) {
      const userActiveOrg = await db.query.users.findFirst({
        where: eq(users.id, member.userId),
      });

      if (userActiveOrg?.orgId === orgId) {
        // Find another organization this user is a member of
        const otherMembership = await db.query.organizationMembers.findFirst({
          where: eq(organizationMembers.userId, member.userId),
        });

        // Update user's active org (or set to null if no other orgs)
        await db
          .update(users)
          .set({
            orgId: otherMembership?.organizationId || null,
            role: otherMembership?.role || null,
          })
          .where(eq(users.id, member.userId));
      }
    }

    // Delete the organization
    await db
      .delete(organizations)
      .where(eq(organizations.id, orgId));

    return NextResponse.json({
      message: "Organization deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting organization:", error);
    return NextResponse.json(
      { error: "Failed to delete organization" },
      { status: 500 }
    );
  }
});
