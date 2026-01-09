/**
 * Cloudflare D1 database adapter.
 * Creates a Drizzle ORM client for Cloudflare's D1 SQLite service.
 */
import type { D1Database } from "@cloudflare/workers-types";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { schema } from "../schema.ts";

/** Options for creating a D1 client */
export interface D1ClientOptions {
  binding: D1Database;
}

/** D1 client with driver discriminator */
export interface D1Client {
  driver: "d1";
  binding: D1Database;
  client: DrizzleD1Database<typeof schema>;
}

/**
 * Create a D1 client with Drizzle ORM.
 * @param options - D1 database binding
 * @returns Configured client with driver and binding references
 */
export function createD1Client(options: D1ClientOptions): D1Client {
  const { binding } = options;
  const client = drizzle(binding, { schema });
  return { driver: "d1", binding, client };
}
