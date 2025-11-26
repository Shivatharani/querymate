// lib/lib.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// Create singleton pool to prevent connection leaks
const globalForPool = globalThis as unknown as {
  pool: Pool | undefined;
};

export const pool =
  globalForPool.pool ??
  new Pool({
    connectionString: process.env.SUPABASE_DB_URL,
    max: 10, // Lower max for transaction pooler
    idleTimeoutMillis: 20000, // Close idle clients after 20 seconds
    connectionTimeoutMillis: 5000, // Faster timeout for transaction mode
  });

if (process.env.NODE_ENV !== "production") globalForPool.pool = pool;

// Handle pool errors gracefully
pool.on("error", (err) => {
  console.error("❌ Unexpected database pool error:", err);
});

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log("🔌 Closing database connections...");
  await pool.end();
  process.exit(0);
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

export const db = drizzle(pool, { schema });

console.log("✅ Database pool initialized with Supabase");