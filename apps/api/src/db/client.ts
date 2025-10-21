import type { D1Database } from "@cloudflare/workers-types";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import type { BunSqliteClient } from "./adapters/bun-sqlite.ts";
import type { D1Client } from "./adapters/d1.ts";
import { createD1Client } from "./adapters/d1.ts";
import { schema } from "./schema.ts";

export type BunSQLiteInstance = import("bun:sqlite").Database;

export type SpecWorkbenchDrizzle =
  | BunSQLiteDatabase<typeof schema>
  | DrizzleD1Database<typeof schema>;

export type DatabaseClient = BunSqliteClient | D1Client;

export type DatabaseDriver = DatabaseClient["driver"];

export interface DatabaseRuntimeContext {
  driver: DatabaseDriver;
  drizzle: SpecWorkbenchDrizzle;
  /**
   * Raw connection for driver-specific operations (e.g. pragmas, maintenance).
   * For D1 this is the bound `D1Database`, for Bun this is the sqlite `Database`.
   */
  raw: BunSQLiteInstance | D1Database;
}

export function normalizeClient(client: DatabaseClient): DatabaseRuntimeContext {
  if (client.driver === "bun-sqlite") {
    return { driver: client.driver, drizzle: client.client, raw: client.database };
  }

  return { driver: client.driver, drizzle: client.client, raw: client.binding };
}

export function createD1RuntimeContext(binding: D1Database): DatabaseRuntimeContext {
  return normalizeClient(createD1Client({ binding }));
}
