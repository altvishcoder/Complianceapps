// Bulk seed script for 25K properties - RESUMABLE
import { generateBulkDemoData } from "./demo-data-generator";
import { db } from "./db";
import { organisations } from "@shared/schema";
import { eq } from "drizzle-orm";

const ORG_ID = "default-org";

async function runBulkSeed() {
  console.log("=".repeat(60));
  console.log("BULK SEED: 25,000 Properties (RESUMABLE)");
  console.log("=".repeat(60));
  
  const startTime = Date.now();
  
  try {
    // Check if org exists
    const [org] = await db.select().from(organisations).where(eq(organisations.id, ORG_ID)).limit(1);
    if (!org) {
      console.error("Organisation not found. Run normal seed first.");
      process.exit(1);
    }
    
    // Generate bulk data (will resume if partial data exists)
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
