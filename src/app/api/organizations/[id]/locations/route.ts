import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { organizationLocations } from "@/db/schema";
import { getCurrentUser } from "@/auth/get-user";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const locationSchema = z.object({
  name: z.string().min(1, "Name is required"),
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required").max(2, "State must be 2 characters"),
  zip: z.string().min(5, "ZIP code is required"),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

// GET /api/organizations/[id]/locations - Get organization locations
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

    // Verify user is a member of this organization
    if (user.orgId !== orgId) {
      return NextResponse.json(
        { error: "You can only view locations for your own organization" },
        { status: 403 }
      );
    }

    // Fetch all locations for the organization
    const locations = await db.query.organizationLocations.findMany({
      where: eq(organizationLocations.orgId, orgId),
      orderBy: (locations, { desc }) => [desc(locations.createdAt)],
    });

    return NextResponse.json({ locations });
  } catch (error) {
    console.error("Error fetching locations:", error);
    return NextResponse.json(
      { error: "Failed to fetch locations" },
      { status: 500 }
    );
  }
}

// POST /api/organizations/[id]/locations - Create a new location
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = params.id;

    // Only admins can add locations
    const isAdmin =
      user.orgId === orgId &&
      (user.role === "employer_admin" || user.role === "provider_admin");

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Only admins can add locations" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = locationSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const data = validation.data;

    const [location] = await db
      .insert(organizationLocations)
      .values({
        orgId,
        ...data,
      })
      .returning();

    return NextResponse.json(
      { location, message: "Location added successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating location:", error);
    return NextResponse.json(
      { error: "Failed to create location" },
      { status: 500 }
    );
  }
}

// PATCH /api/organizations/[id]/locations - Update a location
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = params.id;

    // Only admins can update locations
    const isAdmin =
      user.orgId === orgId &&
      (user.role === "employer_admin" || user.role === "provider_admin");

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Only admins can update locations" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { locationId, ...updateData } = body;

    if (!locationId) {
      return NextResponse.json(
        { error: "Location ID is required" },
        { status: 400 }
      );
    }

    const validation = locationSchema.partial().safeParse(updateData);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid data", details: validation.error.errors },
        { status: 400 }
      );
    }

    const [location] = await db
      .update(organizationLocations)
      .set({
        ...validation.data,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(organizationLocations.id, locationId),
          eq(organizationLocations.orgId, orgId)
        )
      )
      .returning();

    if (!location) {
      return NextResponse.json(
        { error: "Location not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      location,
      message: "Location updated successfully",
    });
  } catch (error) {
    console.error("Error updating location:", error);
    return NextResponse.json(
      { error: "Failed to update location" },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/[id]/locations - Delete a location
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

    // Only admins can delete locations
    const isAdmin =
      user.orgId === orgId &&
      (user.role === "employer_admin" || user.role === "provider_admin");

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Only admins can delete locations" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { locationId } = body;

    if (!locationId) {
      return NextResponse.json(
        { error: "Location ID is required" },
        { status: 400 }
      );
    }

    await db
      .delete(organizationLocations)
      .where(
        and(
          eq(organizationLocations.id, locationId),
          eq(organizationLocations.orgId, orgId)
        )
      );

    return NextResponse.json({
      message: "Location deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting location:", error);
    return NextResponse.json(
      { error: "Failed to delete location" },
      { status: 500 }
    );
  }
}
