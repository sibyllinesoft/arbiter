/**
 * Supabase Module
 *
 * Provides Supabase configuration for database, auth, storage, and edge functions.
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  return [
    {
      type: "addMany",
      destination: "{{projectDir}}",
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data,
    },
  ];
}

export const description = "Supabase backend (Postgres, Auth, Storage, Edge Functions)";

export const dependencies = {
  "@supabase/supabase-js": "^2.39.0",
};

export const devDependencies = {
  supabase: "^1.131.0",
};

export const scripts = {
  "supabase:start": "supabase start",
  "supabase:stop": "supabase stop",
  "supabase:status": "supabase status",
  "supabase:db:reset": "supabase db reset",
  "supabase:db:push": "supabase db push",
  "supabase:gen:types": "supabase gen types typescript --local > src/types/supabase.ts",
  "supabase:functions:serve": "supabase functions serve",
  "supabase:functions:deploy": "supabase functions deploy",
};

export const envVars = {
  SUPABASE_URL: "http://localhost:54321",
  SUPABASE_ANON_KEY: "your-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "your-service-role-key",
};
