/**
 * Bun SQLite database adapter.
 * Creates a Drizzle ORM client for Bun's native SQLite implementation.
 */
import { Database } from "bun:sqlite";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { schema } from "../schema.ts";

/** Options for creating a Bun SQLite client */
export interface BunSqliteClientOptions {
  databasePath: string;
  createIfMissing?: boolean;
  pragmas?: {
    foreignKeys?: boolean;
    journalMode?: "DELETE" | "TRUNCATE" | "PERSIST" | "MEMORY" | "WAL" | "OFF";
    synchronous?: "OFF" | "NORMAL" | "FULL" | "EXTRA";
    cacheSize?: number;
    tempStore?: "default" | "file" | "memory";
  };
}

/** Bun SQLite client with driver discriminator */
export interface BunSqliteClient {
  driver: "bun-sqlite";
  database: Database;
  client: BunSQLiteDatabase<typeof schema>;
}

/**
 * Configure SQLite pragmas for performance and safety.
 * @param database - SQLite database instance
 * @param options - Pragma options to apply
 */
function configurePragmas(database: Database, options?: BunSqliteClientOptions["pragmas"]): void {
  const pragmas = {
    foreignKeys: true,
    journalMode: "WAL" as const,
    synchronous: "NORMAL" as const,
    cacheSize: 1000,
    tempStore: "memory" as const,
    ...options,
  };

  if (pragmas.foreignKeys) {
    database.exec("PRAGMA foreign_keys = ON");
  }
  database.exec(`PRAGMA journal_mode = ${pragmas.journalMode}`);
  database.exec(`PRAGMA synchronous = ${pragmas.synchronous}`);
  database.exec(`PRAGMA cache_size = ${pragmas.cacheSize}`);
  database.exec(`PRAGMA temp_store = ${pragmas.tempStore}`);
}

/**
 * Create a Bun SQLite client with Drizzle ORM.
 * @param options - Database path and configuration options
 * @returns Configured client with driver and database references
 */
export function createBunSqliteClient(options: BunSqliteClientOptions): BunSqliteClient {
  const { databasePath, createIfMissing = true, pragmas } = options;
  const database = new Database(databasePath, { create: createIfMissing });

  configurePragmas(database, pragmas);

  const client = drizzle(database, { schema });
  return { driver: "bun-sqlite", database, client };
}
