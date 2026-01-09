/**
 * Database client types and utilities.
 * Provides unified interface for SQLite (Bun) and D1 (Cloudflare) databases.
 */
import type { D1Database } from "@cloudflare/workers-types";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { BunSqliteClient } from "./adapters/bun-sqlite.ts";
import type { D1Client } from "./adapters/d1.ts";
import { createD1Client } from "./adapters/d1.ts";
import { schema } from "./schema.ts";

/** Native Bun SQLite database instance type */
export type BunSQLiteInstance = import("bun:sqlite").Database;

/** Union type for supported Drizzle ORM instances */
export type SpecWorkbenchDrizzle =
  | BunSQLiteDatabase<typeof schema>
  | DrizzleD1Database<typeof schema>;

/** Union type for database client implementations */
export type DatabaseClient = BunSqliteClient | D1Client;

/** Discriminator type for database driver ("bun-sqlite" | "d1") */
export type DatabaseDriver = DatabaseClient["driver"];

/** Runtime context containing database connection and driver info */
export interface DatabaseRuntimeContext {
  driver: DatabaseDriver;
  drizzle: SpecWorkbenchDrizzle;
  /**
   * Raw connection for driver-specific operations (e.g. pragmas, maintenance).
   * For D1 this is the bound `D1Database`, for Bun this is the sqlite `Database`.
   */
  raw: BunSQLiteInstance | D1Database;
}

/**
 * Normalize a database client into a runtime context.
 * @param client - Database client (Bun SQLite or D1)
 * @returns Unified runtime context
 */
export function normalizeClient(client: DatabaseClient): DatabaseRuntimeContext {
  if (client.driver === "bun-sqlite") {
    return { driver: client.driver, drizzle: client.client, raw: client.database };
  }

  return { driver: client.driver, drizzle: client.client, raw: client.binding };
}

/**
 * Create a runtime context from a D1 database binding.
 * @param binding - Cloudflare D1 database binding
 * @returns Database runtime context
 */
export function createD1RuntimeContext(binding: D1Database): DatabaseRuntimeContext {
  return normalizeClient(createD1Client({ binding }));
}
