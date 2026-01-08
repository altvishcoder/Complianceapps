import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
  const views = [
    'mv_risk_aggregates',
    'mv_dashboard_stats', 
    'mv_property_summary',
    'mv_block_rollup',
    'mv_certificate_expiry_calendar'
  ];
  
  for (const view of views) {
    console.log(`Refreshing ${view}...`);
    const start = Date.now();
    try {
      await db.execute(sql.raw(`REFRESH MATERIALIZED VIEW ${view}`));
      console.log(`  ✓ ${view} refreshed in ${Date.now() - start}ms`);
    } catch (err: any) {
      console.log(`  ✗ ${view} failed: ${err.message}`);
    }
  }
  
  const check = await db.execute(sql`
    SELECT COUNT(*) as total, 
           COUNT(b.id) as blocks_joined
    FROM mv_risk_aggregates mv
    LEFT JOIN blocks b ON b.id = mv.block_id
  `);
  console.log('Verification:', check.rows[0]);
  
  process.exit(0);
}

main().catch(console.error);
