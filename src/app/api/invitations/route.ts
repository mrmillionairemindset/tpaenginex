import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users, organizationMembers } from "@/db/schema";
import { getCurrentUser } from "@/auth/get-user";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// POST /api/invitations - Invite a new user to organization
export async function POST(request: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is an admin
    const isAdmin =
      currentUser.role === "employer_admin" || currentUser.role === "provider_admin";

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Only admins can invite users" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role, orgId } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 }
      );
    }

    // Verify orgId matches current user's org
    if (orgId !== currentUser.orgId) {
      return NextResponse.json(
        { error: "Cannot invite users to other organizations" },
        { status: 403 }
      );
    }

    // Check if user with this email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    // For now, create a user with a temporary password
    // In a real app, you'd send an invitation email with a signup link
    const temporaryPassword = Math.random().toString(36).slice(-12);
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        name: email.split("@")[0], // Use email prefix as temporary name
        password: hashedPassword,
        role,
        orgId,
        emailVerified: new Date(), // Auto-verify for now
        isActive: true,
      })
      .returning();

    // Create organization membership entry
    await db.insert(organizationMembers).values({
      userId: newUser.id,
      organizationId: orgId,
      role,
      invitedBy: currentUser.id,
      isActive: true,
    });

    // TODO: Send invitation email with temporary password or signup link
    console.log(`User invited: ${email} with temporary password: ${temporaryPassword}`);

    return NextResponse.json(
      {
        message: "User invited successfully",
        user: {
          id: newUser.id,
          email: newUser.email,
          role: newUser.role,
        },
        // In development, return the temp password. Remove in production!
        temporaryPassword: process.env.NODE_ENV === "development" ? temporaryPassword : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error inviting user:", error);
    return NextResponse.json(
      { error: "Failed to invite user" },
      { status: 500 }
    );
  }
}
