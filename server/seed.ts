// Seed script for initial ComplianceAI data
import { db } from "./db";
import { organisations, schemes, blocks, properties, users } from "@shared/schema";
import { eq } from "drizzle-orm";

const ORG_ID = "default-org";
const SUPER_ADMIN_ID = "super-admin-user";

export async function seedDatabase() {
  try {
    // Check if org AND users exist (more robust check)
    const [existingOrg] = await db.select().from(organisations).limit(1);
    const [existingUser] = await db.select().from(users).limit(1);
    const [existingProperty] = await db.select().from(properties).limit(1);
    
    if (existingOrg && existingUser && existingProperty) {
      console.log("✓ Database already seeded");
      return;
    }
    
    // If org exists but data was wiped, delete and reseed
    if (existingOrg && (!existingUser || !existingProperty)) {
      console.log("🔄 Partial data detected, reseeding...");
    }
    
    console.log("🌱 Seeding database...");
    
    // Create or get organisation
    let org = existingOrg;
    if (!org) {
      const [newOrg] = await db.insert(organisations).values({
        id: ORG_ID,
        name: "Demo Housing Association",
        slug: "demo-ha",
        settings: { timezone: "Europe/London" }
      }).returning();
      org = newOrg;
      console.log("✓ Created organisation:", org.name);
    } else {
      console.log("✓ Using existing organisation:", org.name);
    }
    
    // Create super admin user
    const [existingSuperAdmin] = await db.select().from(users).where(eq(users.id, SUPER_ADMIN_ID));
    if (!existingSuperAdmin) {
      await db.insert(users).values({
        id: SUPER_ADMIN_ID,
        username: "admin",
        password: "admin123",
        email: "admin@complianceai.co.uk",
        name: "System Admin",
        role: "SUPER_ADMIN",
        organisationId: org.id
      });
      console.log("✓ Created super admin user (username: admin, password: admin123)");
    }
    
    // Create additional demo users
    const demoUsers = [
      { id: "user-manager-1", username: "manager", password: "manager123", email: "manager@complianceai.co.uk", name: "Property Manager", role: "MANAGER" as const },
      { id: "user-officer-1", username: "officer", password: "officer123", email: "officer@complianceai.co.uk", name: "Compliance Officer", role: "OFFICER" as const },
      { id: "user-viewer-1", username: "viewer", password: "viewer123", email: "viewer@complianceai.co.uk", name: "Report Viewer", role: "VIEWER" as const },
    ];
    
    for (const demoUser of demoUsers) {
      const [existing] = await db.select().from(users).where(eq(users.id, demoUser.id));
      if (!existing) {
        await db.insert(users).values({
          ...demoUser,
          organisationId: org.id
        });
      }
    }
    console.log("✓ Created demo users");
    
    // Create schemes if needed
    const existingSchemes = await db.select().from(schemes).where(eq(schemes.organisationId, org.id));
    let scheme1, scheme2;
    
    if (existingSchemes.length === 0) {
      [scheme1] = await db.insert(schemes).values({
        organisationId: org.id,
        name: "Oak Estate",
        reference: "SCH001",
        complianceStatus: "COMPLIANT"
      }).returning();
      
      [scheme2] = await db.insert(schemes).values({
        organisationId: org.id,
        name: "Riverside Gardens",
        reference: "SCH002",
        complianceStatus: "EXPIRING_SOON"
      }).returning();
      
      console.log("✓ Created schemes");
    } else {
      scheme1 = existingSchemes[0];
      scheme2 = existingSchemes[1] || existingSchemes[0];
      console.log("✓ Using existing schemes");
    }
    
    // Create blocks if needed
    const existingBlocks = await db.select().from(blocks).limit(1);
    let block1, block2;
    
    if (existingBlocks.length === 0) {
      [block1] = await db.insert(blocks).values({
        schemeId: scheme1.id,
        name: "Oak House",
        reference: "BLK001",
        hasLift: false,
        hasCommunalBoiler: false,
        complianceStatus: "COMPLIANT"
      }).returning();
      
      [block2] = await db.insert(blocks).values({
        schemeId: scheme2.id,
        name: "The Towers Block A",
        reference: "BLK002",
        hasLift: true,
        hasCommunalBoiler: true,
        complianceStatus: "NON_COMPLIANT"
      }).returning();
      
      await db.insert(blocks).values({
        schemeId: scheme2.id,
        name: "The Towers Block B",
        reference: "BLK003",
        hasLift: true,
        hasCommunalBoiler: true,
        complianceStatus: "COMPLIANT"
      });
      
      console.log("✓ Created blocks");
    } else {
      const allBlocks = await db.select().from(blocks);
      block1 = allBlocks[0];
      block2 = allBlocks[1] || allBlocks[0];
      console.log("✓ Using existing blocks");
    }
    
    // Create properties if needed
    if (!existingProperty) {
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
    } else {
      console.log("✓ Using existing properties");
    }
    console.log("🎉 Database seeded successfully!");
    
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

// Seed is exported for use by routes - do not auto-run
// To seed manually, call the /api/seed endpoint or import and call seedDatabase()
