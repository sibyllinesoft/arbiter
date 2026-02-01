/**
 * Rust + Axum Backend Module
 */

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatesDir = resolve(__dirname, "templates");

export default function (data) {
  const backendDir = data.backendDir || "backend";

  return [
    {
      type: "addMany",
      destination: `{{projectDir}}/${backendDir}`,
      base: templatesDir,
      templateFiles: `${templatesDir}/**/*.hbs`,
      stripExtensions: ["hbs"],
      data,
    },
  ];
}

export const description = "Rust backend with Axum web framework";

export const scripts = {
  "dev:backend": "cd backend && cargo watch -x run",
  "build:backend": "cd backend && cargo build --release",
  "start:backend": "cd backend && ./target/release/{{snakeCase name}}",
  "test:backend": "cd backend && cargo test",
  "lint:backend": "cd backend && cargo clippy --all-targets --all-features -- -D warnings",
  "lint:backend:fix": "cd backend && cargo clippy --fix --allow-dirty --allow-staged",
  "format:backend": "cd backend && cargo fmt",
  "format:backend:check": "cd backend && cargo fmt -- --check",
  "docs:backend": "cd backend && cargo doc --no-deps --open",
};

export const envVars = {
  PORT: "3000",
  DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/{{snakeCase name}}",
  RUST_LOG: "info,{{snakeCase name}}=debug",
};
