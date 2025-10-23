import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users, organizations } from "@/db/schema";
import { getCurrentUser } from "@/auth/get-user";
import { eq } from "drizzle-orm";

// POST /api/users/switch-org - Switch user's active organization
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { orgId } = body;

    if (!orgId) {
      return NextResponse.json(
        { error: "Organization ID is required" },
        { status: 400 }
      );
    }

    // Verify organization exists
    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Update user's organization
    await db
      .update(users)
      .set({ orgId })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      message: "Organization switched successfully",
      organization: org,
    });
  } catch (error) {
    console.error("Error switching organization:", error);
    return NextResponse.json(
      { error: "Failed to switch organization" },
      { status: 500 }
    );
  }
}
