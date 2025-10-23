import { db } from "./client";
import { users, organizationMembers } from "./schema";

async function migrateOrgMembers() {
  console.log("🔄 Migrating existing users to organizationMembers...");

  try {
    // Get all users with an orgId
    const allUsers = await db.query.users.findMany({
      where: (users, { isNotNull }) => isNotNull(users.orgId),
    });

    console.log(`Found ${allUsers.length} users to migrate`);

    // Create organization membership entries for each user
    for (const user of allUsers) {
      if (!user.orgId || !user.role) {
        console.log(`⏭️  Skipping user ${user.email} (no orgId or role)`);
        continue;
      }

      // Check if membership already exists
      const existing = await db.query.organizationMembers.findFirst({
        where: (members, { and, eq }) =>
          and(
            eq(members.userId, user.id),
            eq(members.organizationId, user.orgId!)
          ),
      });

      if (existing) {
        console.log(`✓ Membership already exists for ${user.email}`);
        continue;
      }

      // Create membership
      await db.insert(organizationMembers).values({
        userId: user.id,
        organizationId: user.orgId,
        role: user.role,
        invitedBy: user.id, // Self-invited for existing users
        isActive: true,
      });

      console.log(`✓ Created membership for ${user.email} in org ${user.orgId}`);
    }

    console.log("\n✨ Migration complete!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  }
}

migrateOrgMembers()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
