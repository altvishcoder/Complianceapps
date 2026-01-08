import { applyPerformanceIndexes, createMaterializedViews, refreshAllMaterializedViews } from "./db-optimization";

async function main() {
  console.log("Starting database optimization...\n");
  
  console.log("Step 1: Applying performance indexes...");
  const indexResult = await applyPerformanceIndexes();
  console.log(`  Applied: ${indexResult.applied} indexes`);
  if (indexResult.errors.length > 0) {
    console.log(`  Errors: ${indexResult.errors.join(", ")}`);
  }
  
  console.log("\nStep 2: Creating materialized views...");
  const viewResult = await createMaterializedViews();
  console.log(`  Created: ${viewResult.created} views/indexes`);
  if (viewResult.errors.length > 0) {
    console.log(`  Errors: ${viewResult.errors.join(", ")}`);
  }
  
  console.log("\nStep 3: Refreshing materialized views with data...");
  const refreshResult = await refreshAllMaterializedViews();
  console.log(`  Refreshed: ${refreshResult.refreshed} views`);
  if (refreshResult.errors.length > 0) {
    console.log(`  Errors: ${refreshResult.errors.join(", ")}`);
  }
  
  console.log("\n✅ Database optimization complete!");
  process.exit(0);
}

main().catch(err => {
  console.error("Failed:", err);
  process.exit(1);
});
