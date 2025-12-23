// Seed script for initial ComplianceAI data
import { db } from "./db";
import { organisations, schemes, blocks, properties } from "@shared/schema";

const ORG_ID = "default-org";

export async function seedDatabase() {
  try {
    // Check if org exists
    const [existingOrg] = await db.select().from(organisations).limit(1);
    
    if (existingOrg) {
      console.log("✓ Database already seeded");
      return;
    }
    
    console.log("🌱 Seeding database...");
    
    // Create organisation
    const [org] = await db.insert(organisations).values({
      id: ORG_ID,
      name: "Demo Housing Association",
      slug: "demo-ha",
      settings: { timezone: "Europe/London" }
    }).returning();
    
    console.log("✓ Created organisation:", org.name);
    
    // Create schemes
    const [scheme1] = await db.insert(schemes).values({
      organisationId: org.id,
      name: "Oak Estate",
      reference: "SCH001",
      complianceStatus: "COMPLIANT"
    }).returning();
    
    const [scheme2] = await db.insert(schemes).values({
      organisationId: org.id,
      name: "Riverside Gardens",
      reference: "SCH002",
      complianceStatus: "EXPIRING_SOON"
    }).returning();
    
    console.log("✓ Created schemes");
    
    // Create blocks
    const [block1] = await db.insert(blocks).values({
      schemeId: scheme1.id,
      name: "Oak House",
      reference: "BLK001",
      hasLift: false,
      hasCommunalBoiler: false,
      complianceStatus: "COMPLIANT"
    }).returning();
    
    const [block2] = await db.insert(blocks).values({
      schemeId: scheme2.id,
      name: "The Towers Block A",
      reference: "BLK002",
      hasLift: true,
      hasCommunalBoiler: true,
      complianceStatus: "NON_COMPLIANT"
    }).returning();
    
    const [block3] = await db.insert(blocks).values({
      schemeId: scheme2.id,
      name: "The Towers Block B",
      reference: "BLK003",
      hasLift: true,
      hasCommunalBoiler: true,
      complianceStatus: "COMPLIANT"
    }).returning();
    
    console.log("✓ Created blocks");
    
    // Create properties
    await db.insert(properties).values([
      {
        blockId: block1.id,
        uprn: "10001001",
        addressLine1: "Flat 1, Oak House",
        city: "London",
        postcode: "SW1 1AA",
        propertyType: "FLAT",
        tenure: "SOCIAL_RENT",
        bedrooms: 2,
        hasGas: true,
        complianceStatus: "COMPLIANT"
      },
      {
        blockId: block1.id,
        uprn: "10001002",
        addressLine1: "Flat 2, Oak House",
        city: "London",
        postcode: "SW1 1AA",
        propertyType: "FLAT",
        tenure: "SOCIAL_RENT",
        bedrooms: 2,
        hasGas: true,
        complianceStatus: "OVERDUE"
      },
      {
        blockId: block2.id,
        uprn: "10002001",
        addressLine1: "101 The Towers",
        city: "Manchester",
        postcode: "M1 1BB",
        propertyType: "FLAT",
        tenure: "LEASEHOLD",
        bedrooms: 1,
        hasGas: false,
        complianceStatus: "COMPLIANT"
      },
      {
        blockId: block2.id,
        uprn: "10002002",
        addressLine1: "102 The Towers",
        city: "Manchester",
        postcode: "M1 1BB",
        propertyType: "FLAT",
        tenure: "SOCIAL_RENT",
        bedrooms: 1,
        hasGas: false,
        complianceStatus: "NON_COMPLIANT"
      }
    ]);
    
    console.log("✓ Created properties");
    console.log("🎉 Database seeded successfully!");
    
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

// Run seed if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}
