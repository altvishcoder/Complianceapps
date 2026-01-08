// Bulk seed script for 25K properties - RESUMABLE
// Usage: npx tsx server/run-bulk-seed.ts [--tier=small|medium|large] [--seed=<seed>]
import { generateBulkDemoData } from "./demo-data-generator";
import { initializeSeededRandom, runBulkSeed as runBulkSeedCore, VolumeTier } from "./demo-data/bulk-seeder";
import { db } from "./db";
import { organisations } from "@shared/schema";
import { eq } from "drizzle-orm";

const ORG_ID = "default-org";

// Parse command line arguments
function parseArgs(): { tier: VolumeTier; seed: string | undefined } {
  const args = process.argv.slice(2);
  let tier: VolumeTier = "medium";
  let seed: string | undefined;
  
  for (const arg of args) {
    if (arg.startsWith("--tier=")) {
      const tierValue = arg.split("=")[1] as VolumeTier;
      if (["small", "medium", "large"].includes(tierValue)) {
        tier = tierValue;
      }
    } else if (arg.startsWith("--seed=")) {
      seed = arg.split("=")[1];
    }
  }
  
  return { tier, seed };
}

async function runBulkSeed() {
  const { tier, seed } = parseArgs();
  
  console.log("=".repeat(60));
  console.log(`BULK SEED: ${tier.toUpperCase()} tier${seed ? ` (seed: ${seed})` : ''}`);
  console.log("=".repeat(60));
  
  // Initialize deterministic RNG if seed provided
  if (seed) {
    initializeSeededRandom(seed);
    console.log(`Deterministic mode: Using seed '${seed}' for reproducible data`);
  }
  
  const startTime = Date.now();
  
  try {
    // Check if org exists
    const [org] = await db.select().from(organisations).where(eq(organisations.id, ORG_ID)).limit(1);
    if (!org) {
      console.error("Organisation not found. Run normal seed first.");
      process.exit(1);
    }
    
    // Generate bulk data using the tier-based seeder
    await runBulkSeedCore(tier, ORG_ID);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log("=".repeat(60));
    console.log("BULK SEED COMPLETE");
    console.log("=".repeat(60));
    console.log(`Duration: ${duration}s`);
    console.log(`Tier: ${tier}`);
    if (seed) console.log(`Seed: ${seed} (reproducible)`);
    console.log("=".repeat(60));
    
  } catch (error) {
    console.error("Bulk seed failed:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

runBulkSeed();
