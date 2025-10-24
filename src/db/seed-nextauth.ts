import { db } from "./client";
import { users, organizations, organizationMembers } from "./schema";
import bcrypt from "bcryptjs";

async function seed() {
  console.log("🌱 Seeding database with test users...");

  try {
    // Create test organizations
    console.log("Creating organizations...");

    const [employerOrg] = await db
      .insert(organizations)
      .values({
        name: "Acme Corp",
        slug: "acme-corp",
        type: "employer",
        isActive: true,
      })
      .returning();

    const [providerOrg] = await db
      .insert(organizations)
      .values({
        name: "HealthTest Solutions",
        slug: "healthtest-solutions",
        type: "provider",
        isActive: true,
      })
      .returning();

    console.log("✅ Organizations created");

    // Create test users
    console.log("Creating users...");

    const password = await bcrypt.hash("password123", 10);

    // Employer Admin
    const [employerAdmin] = await db.insert(users).values({
      email: "employer-admin@example.com",
      name: "John Employer",
      password,
      role: "employer_admin",
      orgId: employerOrg.id,
      emailVerified: new Date(),
      isActive: true,
    }).returning();

    // Employer User
    const [employerUser] = await db.insert(users).values({
      email: "employer-user@example.com",
      name: "Jane Employee",
      password,
      role: "employer_user",
      orgId: employerOrg.id,
      emailVerified: new Date(),
      isActive: true,
    }).returning();

    // Provider Admin
    const [providerAdmin] = await db.insert(users).values({
      email: "provider-admin@example.com",
      name: "Dr. Sarah Provider",
      password,
      role: "provider_admin",
      orgId: providerOrg.id,
      emailVerified: new Date(),
      isActive: true,
    }).returning();

    // Provider Agent
    const [providerAgent] = await db.insert(users).values({
      email: "provider-agent@example.com",
      name: "Mike Agent",
      password,
      role: "provider_agent",
      orgId: providerOrg.id,
      emailVerified: new Date(),
      isActive: true,
    }).returning();

    console.log("✅ Users created");

    // Create organization memberships
    console.log("Creating organization memberships...");

    await db.insert(organizationMembers).values([
      {
        userId: employerAdmin.id,
        organizationId: employerOrg.id,
        role: "employer_admin",
        invitedBy: employerAdmin.id,
        isActive: true,
      },
      {
        userId: employerUser.id,
        organizationId: employerOrg.id,
        role: "employer_user",
        invitedBy: employerAdmin.id,
        isActive: true,
      },
      {
        userId: providerAdmin.id,
        organizationId: providerOrg.id,
        role: "provider_admin",
        invitedBy: providerAdmin.id,
        isActive: true,
      },
      {
        userId: providerAgent.id,
        organizationId: providerOrg.id,
        role: "provider_agent",
        invitedBy: providerAdmin.id,
        isActive: true,
      },
    ]);

    console.log("✅ Organization memberships created");
    console.log("\n📋 Test Accounts:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Employer Admin:");
    console.log("  Email: employer-admin@example.com");
    console.log("  Password: password123");
    console.log("  Org: Acme Corp");
    console.log("");
    console.log("Employer User:");
    console.log("  Email: employer-user@example.com");
    console.log("  Password: password123");
    console.log("  Org: Acme Corp");
    console.log("");
    console.log("Provider Admin:");
    console.log("  Email: provider-admin@example.com");
    console.log("  Password: password123");
    console.log("  Org: HealthTest Solutions");
    console.log("");
    console.log("Provider Agent:");
    console.log("  Email: provider-agent@example.com");
    console.log("  Password: password123");
    console.log("  Org: HealthTest Solutions");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n✨ Seeding complete!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
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
