/**
 * Cloudflare Module
 *
 * Provides Cloudflare Workers, Pages, R2, D1, and KV configuration.
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

export const description = "Cloudflare Workers, Pages, R2, D1, KV";

export const devDependencies = {
  wrangler: "^3.22.0",
  "@cloudflare/workers-types": "^4.20240117.0",
};

export const scripts = {
  "cf:dev": "wrangler dev",
  "cf:deploy": "wrangler deploy",
  "cf:pages:dev": "wrangler pages dev",
  "cf:pages:deploy": "wrangler pages deploy",
};

export const envVars = {
  CLOUDFLARE_ACCOUNT_ID: "your-account-id",
  CLOUDFLARE_API_TOKEN: "your-api-token",
};
