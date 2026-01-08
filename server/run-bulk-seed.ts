// Bulk seed script for 25K properties
import { generateBulkDemoData } from "./demo-data-generator";
import { db } from "./db";
import { organisations, properties, certificates, remedialActions, components, spaces, blocks, schemes } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const ORG_ID = "default-org";

async function wipeExistingData() {
  console.log("Wiping existing demo data...");
  
  // Delete in order of dependencies - all tables that reference properties
  console.log("  Deleting dependent records...");
  await db.execute(sql`DELETE FROM ml_predictions`);
  await db.execute(sql`DELETE FROM risk_alerts`);  // Before property_risk_snapshots
  await db.execute(sql`DELETE FROM property_risk_snapshots`);
  await db.execute(sql`DELETE FROM compliance_calendar_events`);
  await db.execute(sql`DELETE FROM contractor_assignments`);
  await db.execute(sql`DELETE FROM ingestion_jobs`);
  await db.execute(sql`DELETE FROM units`);
  await db.execute(sql`DELETE FROM audit_events WHERE property_id IS NOT NULL`);
  
  console.log("  Deleting core records...");
  await db.delete(remedialActions);
  await db.delete(certificates);
  await db.delete(components);
  await db.delete(spaces);
  await db.delete(properties);
  await db.delete(blocks);
  await db.delete(schemes).where(sql`${schemes.reference} LIKE 'SCH-DEMO-%'`);
  
  console.log("Wipe complete");
}

async function runBulkSeed() {
  console.log("=".repeat(60));
  console.log("BULK SEED: 25,000 Properties");
  console.log("=".repeat(60));
  
  const startTime = Date.now();
  
  try {
    // Check if org exists
    const [org] = await db.select().from(organisations).where(eq(organisations.id, ORG_ID)).limit(1);
    if (!org) {
      console.error("Organisation not found. Run normal seed first.");
      process.exit(1);
    }
    
    // Wipe existing demo data
    await wipeExistingData();
    
    // Generate bulk data
    const stats = await generateBulkDemoData(ORG_ID, 25000);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log("=".repeat(60));
    console.log("BULK SEED COMPLETE");
    console.log("=".repeat(60));
    console.log(`Duration: ${duration}s`);
    console.log(`Properties: ${stats.properties.toLocaleString()}`);
    console.log(`Components: ${stats.components.toLocaleString()}`);
    console.log(`Certificates: ${stats.certificates.toLocaleString()}`);
    console.log(`Remedial Actions: ${stats.remedialActions.toLocaleString()}`);
    console.log("=".repeat(60));
    
  } catch (error) {
    console.error("Bulk seed failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

runBulkSeed();
