import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Log database URL status at module load (don't throw - let server start for health checks)
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error(`[${new Date().toISOString()}] WARNING: DATABASE_URL not set - database operations will fail`);
}

// Create pool only if DATABASE_URL is set, otherwise create a dummy that will fail gracefully
// Configuration optimized for production workloads with 25k+ property portfolios
const DEFAULT_POOL_SIZE = 50;
const MAX_POOL_SIZE = 100; // Cap to prevent resource exhaustion
const parsedPoolSize = parseInt(process.env.DB_POOL_SIZE || '', 10);
const poolSize = Number.isFinite(parsedPoolSize) && parsedPoolSize > 0 && parsedPoolSize <= MAX_POOL_SIZE
  ? parsedPoolSize
  : DEFAULT_POOL_SIZE;

export const pool = databaseUrl 
  ? new Pool({ 
      connectionString: databaseUrl,
      max: poolSize,              // Configurable pool size (default: 50 for production)
      idleTimeoutMillis: 30000,   // Close idle connections after 30s
      connectionTimeoutMillis: 10000, // Wait 10s for connection
      statement_timeout: 120000,  // 2 minute statement timeout for bulk inserts
    })
  : null as unknown as pg.Pool;

// Log pool configuration at startup
if (databaseUrl) {
  console.log(`[${new Date().toISOString()}] Database pool configured: max=${poolSize} connections`);
}

export const db = databaseUrl 
  ? drizzle(pool, { schema })
  : null as unknown as ReturnType<typeof drizzle>;

// Helper to check if database is available
export function isDatabaseAvailable(): boolean {
  return !!databaseUrl && !!pool;
}
