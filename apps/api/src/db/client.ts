import { Pool, PoolConfig } from "pg";
import { config } from "../config";
import { logger } from "../lib/logger";

/**
 * Build pg Pool config from the DATABASE_URL.
 * Handles cloud Postgres providers (Neon, Supabase, etc.) that require SSL
 * and may include non-standard query params (channel_binding) that pg ignores.
 */
function buildPoolConfig(): PoolConfig {
  const url = new URL(config.databaseUrl);

  // pg does not understand channel_binding — remove it to avoid parse errors
  url.searchParams.delete("channel_binding");

  const sslMode = url.searchParams.get("sslmode");

  return {
    connectionString: url.toString(),
    // Enable SSL for any cloud provider that requires it
    ssl: sslMode === "require" || sslMode === "prefer"
      ? { rejectUnauthorized: false }
      : undefined,
  };
}

export const db = new Pool(buildPoolConfig());

db.on("error", (err) => logger.error("pg pool error", { err }));

/** Run schema migration on startup */
export async function migrate(): Promise<void> {
  const sql = await import("fs").then((fs) =>
    fs.readFileSync(__dirname + "/schema.sql", "utf8")
  );
  await db.query(sql);
  logger.info("Database migration applied");
}
