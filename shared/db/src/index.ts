import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Fail fast with a clear error instead of hanging indefinitely if the
  // database is unreachable or slow to wake from an idle/suspended state
  // (common on free-tier hosted Postgres like Neon).
  connectionTimeoutMillis: 10_000,
  // Keeps the underlying TCP connection alive so it's less likely to be
  // silently dropped by a router/firewall during periods of inactivity.
  keepAlive: true,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
