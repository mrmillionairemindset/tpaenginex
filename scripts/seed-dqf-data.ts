/**
 * Seed DQF sample data.
 * Run with: npx tsx scripts/seed-dqf-data.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
import { eq, and } from "drizzle-orm";

// Load .env.local explicitly
config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { db } = await import("../src/db/client");
  const {
    persons,
    driverApplications,
    driverQualifications,
    dqfChecklists,
    dqfChecklistItems,
    annualReviews,
    employerInvestigations,
    publicTicketForms,
    organizations,
  } = await import("../src/db/schema");

  try {
    console.log("Seeding DQF sample data...");

    // 1. Find first TPA org
    const tpaOrg = await db.query.organizations.findFirst({
      where: eq(organizations.type, "tpa"),
    });
    if (!tpaOrg) {
      throw new Error("No TPA organization found. Run the base seed first.");
    }
    console.log(`Using TPA: ${tpaOrg.name} (${tpaOrg.id})`);

    // 2. Find first client org under this TPA
    const clientOrg = await db.query.organizations.findFirst({
      where: and(eq(organizations.type, "client"), eq(organizations.tpaOrgId, tpaOrg.id)),
    });
    if (!clientOrg) {
      throw new Error("No client organization found under TPA. Run the base seed first.");
    }
    console.log(`Using Client: ${clientOrg.name} (${clientOrg.id})`);

    const tpaOrgId = tpaOrg.id;
    const clientOrgId = clientOrg.id;

    // 3. Create 3 driver persons + applications
    const driversData = [
      {
        first: "James",
        last: "Carter",
        email: "james.carter@example.com",
        status: "submitted" as const,
        cdl: "TX1234567",
        cdlState: "TX",
      },
      {
        first: "Maria",
        last: "Gonzalez",
        email: "maria.gonzalez@example.com",
        status: "under_review" as const,
        cdl: "CA9876543",
        cdlState: "CA",
      },
      {
        first: "Robert",
        last: "Nguyen",
        email: "robert.nguyen@example.com",
        status: "approved" as const,
        cdl: "IL5554321",
        cdlState: "IL",
      },
    ];

    const createdPersons: { id: string; first: string; last: string }[] = [];
    const createdApplications: { id: string; personId: string }[] = [];

    for (const d of driversData) {
      const [person] = await db
        .insert(persons)
        .values({
          orgId: clientOrgId,
          tpaOrgId,
          personType: "driver",
          firstName: d.first,
          lastName: d.last,
          dob: "1985-06-15",
          ssnLast4: "1234",
          phone: "555-555-0100",
          email: d.email,
        } as typeof persons.$inferInsert)
        .returning();
      createdPersons.push({ id: person.id, first: d.first, last: d.last });

      const [app] = await db
        .insert(driverApplications)
        .values({
          tpaOrgId,
          personId: person.id,
          clientOrgId,
          status: d.status,
          position: "CDL Driver",
          cdlNumber: d.cdl,
          cdlState: d.cdlState,
          cdlClass: "A",
          endorsements: ["H", "N"],
          notes: `Sample application for ${d.first} ${d.last}`,
        } as typeof driverApplications.$inferInsert)
        .returning();
      createdApplications.push({ id: app.id, personId: person.id });
      console.log(`  Created driver + application: ${d.first} ${d.last} (${d.status})`);
    }

    // 4. Two qualifications per driver — CDL + medical card. One med card expires soon.
    const now = new Date();
    const soon = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days
    const farFuture = new Date(now.getTime() + 2 * 365 * 24 * 60 * 60 * 1000); // ~2 years

    for (let i = 0; i < createdPersons.length; i++) {
      const p = createdPersons[i];
      await db.insert(driverQualifications).values([
        {
          tpaOrgId,
          personId: p.id,
          qualificationType: "cdl",
          issuedAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
          expiresAt: farFuture,
          status: "active",
          issuingAuthority: "State DMV",
          referenceNumber: `CDL-${p.id.slice(0, 8)}`,
        },
        {
          tpaOrgId,
          personId: p.id,
          qualificationType: "medical_card",
          issuedAt: new Date(now.getTime() - 300 * 24 * 60 * 60 * 1000),
          // First driver's med card expires soon; others far in the future
          expiresAt: i === 0 ? soon : farFuture,
          status: i === 0 ? "expiring_soon" : "active",
          issuingAuthority: "DOT Medical Examiner",
          referenceNumber: `MC-${p.id.slice(0, 8)}`,
        },
      ] as (typeof driverQualifications.$inferInsert)[]);
    }
    console.log(`  Created ${createdPersons.length * 2} driver qualifications`);

    // 5. One DQF checklist with 5 items
    const [checklist] = await db
      .insert(dqfChecklists)
      .values({
        tpaOrgId,
        clientOrgId,
        name: "Standard DOT Driver Qualification Checklist",
        description: "Baseline qualification items required for all CDL drivers.",
      } as typeof dqfChecklists.$inferInsert)
      .returning();

    const items = [
      { label: "CDL License", qualificationType: "cdl" },
      { label: "Medical Card", qualificationType: "medical_card" },
      { label: "MVR (Motor Vehicle Record)", qualificationType: "mvr" },
      { label: "Pre-Employment Drug Test", qualificationType: "drug_test" },
      { label: "Road Test Certificate", qualificationType: "road_test" },
    ];

    await db.insert(dqfChecklistItems).values(
      items.map((it, idx) => ({
        checklistId: checklist.id,
        tpaOrgId,
        label: it.label,
        isRequired: true,
        qualificationType: it.qualificationType,
        sortOrder: idx,
      })) as (typeof dqfChecklistItems.$inferInsert)[],
    );
    console.log(`  Created checklist "${checklist.name}" with ${items.length} items`);

    // 6. Annual review scheduled for next month — tie to first driver
    const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    await db
      .insert(annualReviews)
      .values({
        tpaOrgId,
        personId: createdPersons[0].id,
        clientOrgId,
        scheduledDate: nextMonth,
        status: "scheduled",
        notes: "Standard annual DQ file review.",
      } as typeof annualReviews.$inferInsert);
    console.log(`  Created annual review for ${createdPersons[0].first} ${createdPersons[0].last}`);

    // 7. Employer investigation tied to first application
    await db
      .insert(employerInvestigations)
      .values({
        tpaOrgId,
        personId: createdApplications[0].personId,
        applicationId: createdApplications[0].id,
        employerName: "Former Trucking Co.",
        contactName: "HR Manager",
        contactPhone: "555-555-0200",
        contactEmail: "hr@former-trucking.example.com",
        contactDate: now,
        response: "Awaiting response from previous employer.",
        datesOfEmployment: "2020-2023",
        positionHeld: "OTR Driver",
        reasonForLeaving: "Voluntary — relocated",
        safetyViolations: false,
        drugAlcoholViolations: false,
      } as typeof employerInvestigations.$inferInsert);
    console.log(`  Created employer investigation`);

    // 8. Public ticket form
    await db
      .insert(publicTicketForms)
      .values({
        tpaOrgId,
        clientOrgId,
        formName: "Driver Application Intake",
        formConfig: {
          fields: ["firstName", "lastName", "email", "phone", "cdlNumber", "cdlState"],
          branding: { primaryColor: "#0052CC" },
        },
        isActive: true,
        publicUrl: "driver-apply",
      } as typeof publicTicketForms.$inferInsert);
    console.log(`  Created public ticket form`);

    console.log("\n=== DQF Seed Summary ===");
    console.log(`TPA:                      ${tpaOrg.name}`);
    console.log(`Client:                   ${clientOrg.name}`);
    console.log(`Driver persons:           ${createdPersons.length}`);
    console.log(`Driver applications:      ${createdApplications.length}`);
    console.log(`Driver qualifications:    ${createdPersons.length * 2}`);
    console.log(`Checklists:               1 (with ${items.length} items)`);
    console.log(`Annual reviews:           1`);
    console.log(`Employer investigations:  1`);
    console.log(`Public ticket forms:      1`);
    console.log("DQF seed complete!");
  } catch (error) {
    console.error("DQF seeding failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
