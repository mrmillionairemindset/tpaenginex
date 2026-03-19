import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { organizationMembers, users } from "@/db/schema";
import { getCurrentUser } from "@/auth/get-user";
import { eq, and } from "drizzle-orm";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// GET /api/organizations/[id]/members - Get organization members
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = params.id;

    // Verify user is a member of this organization or is a provider
    const isProvider = user.role?.startsWith("tpa_") || user.role === "platform_admin";
    const isMember = user.orgId === orgId;

    if (!isProvider && !isMember) {
      return NextResponse.json(
        { error: "You can only view members of your own organization" },
        { status: 403 }
      );
    }

    // Fetch all members of the organization
    const members = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.organizationId, orgId),
      with: {
        user: {
          columns: {
            id: true,
            email: true,
            name: true,
            createdAt: true,
            lastLoginAt: true,
          },
        },
        invitedByUser: {
          columns: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: (members, { asc }) => [asc(members.joinedAt)],
    });

    const formattedMembers = members.map((member) => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      isActive: member.isActive,
      joinedAt: member.joinedAt,
      user: member.user,
      invitedBy: member.invitedByUser,
    }));

    return NextResponse.json({ members: formattedMembers });
  } catch (error) {
    console.error("Error fetching organization members:", error);
    return NextResponse.json(
      { error: "Failed to fetch members" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[id]/members - Remove a member
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = params.id;
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Verify current user is an admin of this organization
    const isAdmin =
      user.orgId === orgId &&
      (user.role === "tpa_admin" || user.role === "platform_admin");

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Only admins can remove members" },
        { status: 403 }
      );
    }

    // Prevent removing yourself
    if (userId === user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the organization" },
        { status: 400 }
      );
    }

    // Check if this is the last admin
    const admins = await db.query.organizationMembers.findMany({
      where: and(
        eq(organizationMembers.organizationId, orgId),
        eq(organizationMembers.isActive, true)
      ),
    });

    const activeAdmins = admins.filter(
      (m) => m.role === "tpa_admin" || m.role === "platform_admin"
    );

    const targetMember = admins.find((m) => m.userId === userId);

    if (
      targetMember &&
      (targetMember.role === "tpa_admin" ||
        targetMember.role === "platform_admin") &&
      activeAdmins.length === 1
    ) {
      return NextResponse.json(
        { error: "Cannot remove the last admin from the organization" },
        { status: 400 }
      );
    }

    // Remove the member
    await db
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, userId)
        )
      );

    // If this was the user's active org, set their org to null
    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (targetUser?.orgId === orgId) {
      await db
        .update(users)
        .set({ orgId: null, role: null })
        .where(eq(users.id, userId));
    }

    return NextResponse.json({
      message: "Member removed successfully",
    });
  } catch (error) {
    console.error("Error removing member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
