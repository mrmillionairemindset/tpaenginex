import { NextRequest, NextResponse } from "next/server";
import { withAuth, withPermission, withAdminAuth } from "@/auth/api-middleware";

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Example 1: Simple authentication check
export const GET = withAuth(async (req, user) => {
  return NextResponse.json({
    message: "Authenticated successfully",
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      organization: user.organization?.name,
      organizationType: user.organization?.type,
    },
  });
});

// Example 2: Permission-based access
export const POST = withPermission("create_orders", async (req, user) => {
  return NextResponse.json({
    message: "You have permission to create orders",
    user: {
      email: user.email,
      role: user.role,
    },
  });
});

// Example 3: Admin-only access
export const DELETE = withAdminAuth(async (req, user) => {
  return NextResponse.json({
    message: "Admin access granted",
    user: {
      email: user.email,
      role: user.role,
    },
  });
});
