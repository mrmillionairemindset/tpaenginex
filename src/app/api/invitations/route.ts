import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users, organizationMembers, collectors } from "@/db/schema";
import { getCurrentUser } from "@/auth/get-user";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { sendUserInviteEmail } from "@/lib/email";
import { getTpaBranding } from "@/lib/tpa-settings";

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
      currentUser.role === "tpa_admin" || currentUser.role === "platform_admin";

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Only admins can invite users" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { firstName, middleName, lastName, email, role, orgId, address, city, state, zip } = body;

    if (!firstName || !lastName || !email || !role) {
      return NextResponse.json(
        { error: "First name, last name, email, and role are required" },
        { status: 400 }
      );
    }

    const fullName = [firstName, middleName, lastName].filter(Boolean).join(" ");

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
        name: fullName,
        phone: null,
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

    // If collector role, auto-create a collector record linked to this user
    if (role === 'collector' && currentUser.tpaOrgId) {
      await db.insert(collectors).values({
        tpaOrgId: currentUser.tpaOrgId,
        firstName,
        lastName,
        email: email.toLowerCase(),
        phone: body.phone || '',
        userId: newUser.id,
      });
    }

    // Send invitation email
    const loginUrl = `${process.env.NEXTAUTH_URL || 'https://tpaenginex.vercel.app'}/auth/signin`;
    const branding = currentUser.tpaOrgId ? await getTpaBranding(currentUser.tpaOrgId) : undefined;
    await sendUserInviteEmail({
      to: email.toLowerCase(),
      name: fullName,
      role,
      organizationName: currentUser.organization?.name || 'TPAEngineX',
      temporaryPassword,
      loginUrl,
      branding,
    }).catch(err => console.error('Failed to send invite email:', err));

    return NextResponse.json(
      {
        message: `${fullName} has been added and will receive an invite email`,
        user: {
          id: newUser.id,
          name: newUser.name,
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
