import type { Config } from "drizzle-kit";

const dbFile =
  process.env.DATABASE_FILE ??
  process.env.DATABASE_PATH ??
  new URL("./arbiter.db", import.meta.url).pathname;

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  driver: "better-sqlite",
  dbCredentials: {
    url: `sqlite:${dbFile}`,
  },
} satisfies Config;
