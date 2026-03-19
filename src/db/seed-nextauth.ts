import { db } from "./client";
import { users, organizations, organizationMembers } from "./schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("Seeding database with test users...");

  try {
    // Create test organizations
    console.log("Creating organizations...");

    // Platform org (super-admin)
    const [platformOrg] = await db
      .insert(organizations)
      .values({
        name: "TPAEngineX",
        slug: "tpa-engine-x",
        type: "platform",
        isActive: true,
      })
      .returning();

    // TPA org (paying tenant)
    const [tpaOrg] = await db
      .insert(organizations)
      .values({
        name: "USA Mobile Drug Testing",
        slug: "usa-mobile-drug-testing",
        type: "tpa",
        isActive: true,
      })
      .returning();

    // Client org (employer served by TPA)
    const [clientOrg] = await db
      .insert(organizations)
      .values({
        name: "Acme Construction",
        slug: "acme-construction",
        type: "client",
        tpaOrgId: tpaOrg.id,
        isActive: true,
      })
      .returning();

    console.log("Organizations created");

    // Create test users
    console.log("Creating users...");

    const password = await bcrypt.hash("password123", 10);

    // Platform Admin
    const [platformAdmin] = await db.insert(users).values({
      email: "platform-admin@example.com",
      name: "Platform Admin",
      password,
      role: "platform_admin",
      orgId: platformOrg.id,
      emailVerified: new Date(),
      isActive: true,
    }).returning();

    // TPA Admin
    const [tpaAdmin] = await db.insert(users).values({
      email: "tpa-admin@example.com",
      name: "Sarah TPA Admin",
      password,
      role: "tpa_admin",
      orgId: tpaOrg.id,
      emailVerified: new Date(),
      isActive: true,
    }).returning();

    // TPA Staff
    const [tpaStaff] = await db.insert(users).values({
      email: "tpa-staff@example.com",
      name: "Mike Scheduler",
      password,
      role: "tpa_staff",
      orgId: tpaOrg.id,
      emailVerified: new Date(),
      isActive: true,
    }).returning();

    // TPA Records
    const [tpaRecords] = await db.insert(users).values({
      email: "tpa-records@example.com",
      name: "Lisa Records",
      password,
      role: "tpa_records",
      orgId: tpaOrg.id,
      emailVerified: new Date(),
      isActive: true,
    }).returning();

    // TPA Billing
    const [tpaBilling] = await db.insert(users).values({
      email: "tpa-billing@example.com",
      name: "Tom Billing",
      password,
      role: "tpa_billing",
      orgId: tpaOrg.id,
      emailVerified: new Date(),
      isActive: true,
    }).returning();

    // Client Admin
    const [clientAdmin] = await db.insert(users).values({
      email: "client-admin@example.com",
      name: "John Client",
      password,
      role: "client_admin",
      orgId: clientOrg.id,
      emailVerified: new Date(),
      isActive: true,
    }).returning();

    console.log("Users created");

    // Create organization memberships
    console.log("Creating organization memberships...");

    await db.insert(organizationMembers).values([
      {
        userId: platformAdmin.id,
        organizationId: platformOrg.id,
        role: "platform_admin",
        invitedBy: platformAdmin.id,
        isActive: true,
      },
      {
        userId: tpaAdmin.id,
        organizationId: tpaOrg.id,
        role: "tpa_admin",
        invitedBy: tpaAdmin.id,
        isActive: true,
      },
      {
        userId: tpaStaff.id,
        organizationId: tpaOrg.id,
        role: "tpa_staff",
        invitedBy: tpaAdmin.id,
        isActive: true,
      },
      {
        userId: tpaRecords.id,
        organizationId: tpaOrg.id,
        role: "tpa_records",
        invitedBy: tpaAdmin.id,
        isActive: true,
      },
      {
        userId: tpaBilling.id,
        organizationId: tpaOrg.id,
        role: "tpa_billing",
        invitedBy: tpaAdmin.id,
        isActive: true,
      },
      {
        userId: clientAdmin.id,
        organizationId: clientOrg.id,
        role: "client_admin",
        invitedBy: tpaAdmin.id,
        isActive: true,
      },
    ]);

    console.log("Organization memberships created");
    console.log("\nTest Accounts:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Platform Admin:");
    console.log("  Email: platform-admin@example.com");
    console.log("  Password: password123");
    console.log("");
    console.log("TPA Admin:");
    console.log("  Email: tpa-admin@example.com");
    console.log("  Password: password123");
    console.log("  Org: USA Mobile Drug Testing");
    console.log("");
    console.log("TPA Staff:");
    console.log("  Email: tpa-staff@example.com");
    console.log("  Password: password123");
    console.log("");
    console.log("TPA Records:");
    console.log("  Email: tpa-records@example.com");
    console.log("  Password: password123");
    console.log("");
    console.log("TPA Billing:");
    console.log("  Email: tpa-billing@example.com");
    console.log("  Password: password123");
    console.log("");
    console.log("Client Admin:");
    console.log("  Email: client-admin@example.com");
    console.log("  Password: password123");
    console.log("  Org: Acme Construction");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\nSeeding complete!");
  } catch (error) {
    console.error("Seeding failed:", error);
    throw error;
  }
}

seed()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
