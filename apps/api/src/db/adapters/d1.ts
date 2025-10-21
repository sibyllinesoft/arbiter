import type { D1Database } from "@cloudflare/workers-types";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { schema } from "../schema.ts";

export interface D1ClientOptions {
  binding: D1Database;
}

export interface D1Client {
  driver: "d1";
  binding: D1Database;
  client: DrizzleD1Database<typeof schema>;
}

export function createD1Client(options: D1ClientOptions): D1Client {
  const { binding } = options;
  const client = drizzle(binding, { schema });
  return { driver: "d1", binding, client };
}
