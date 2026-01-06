import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

// Lazy initialization - don't connect at import time
let _pool: pg.Pool | null = null;
let _db: NodePgDatabase<typeof schema> | null = null;

function getPool(): pg.Pool {
  if (!_pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error(
        "DATABASE_URL must be set. Did you forget to provision a database?",
      );
    }
    console.log(`[${new Date().toISOString()}] Creating database pool...`);
    _pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return _pool;
}

// Export pool as a getter for backwards compatibility
export const pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    return (getPool() as any)[prop];
  }
});

// Export db with lazy initialization
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    if (!_db) {
      console.log(`[${new Date().toISOString()}] Initializing Drizzle ORM...`);
      _db = drizzle(getPool(), { schema });
    }
    return (_db as any)[prop];
  }
});
