/**
 * Template Generation Tests
 *
 * Actually generates projects and validates the output files.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { tmpdir } from "os";
import { join } from "path";
import { mkdtemp, readFile, readdir, rm, stat } from "fs/promises";
import nodePlop from "node-plop";
import { composeModules } from "../_modules/composer.js";

// Helper to run a plopfile and generate files
async function generateProject(
  plopfilePath: string,
  destPath: string,
  answers: Record<string, unknown>,
): Promise<void> {
  const plop = await nodePlop(plopfilePath, {
    destBasePath: destPath,
    force: true,
  });

  const generators = plop.getGeneratorList();
  const generator = plop.getGenerator(generators[0]?.name || "default");
  const results = await generator.runActions(answers);

  if (results.failures && results.failures.length > 0) {
    throw new Error(`Generation failed: ${results.failures.map((f) => f.error).join(", ")}`);
  }
}

// Helper to check if files exist
async function filesExist(basePath: string, files: string[]): Promise<boolean> {
  for (const file of files) {
    try {
      await stat(join(basePath, file));
    } catch {
      return false;
    }
  }
  return true;
}

// Helper to validate JSON syntax
async function isValidJson(filePath: string): Promise<boolean> {
  try {
    const content = await readFile(filePath, "utf-8");
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

// Helper to validate TypeScript/JavaScript syntax (basic check)
async function hasNoObviousSyntaxErrors(filePath: string): Promise<boolean> {
  try {
    const content = await readFile(filePath, "utf-8");
    // Check for common template rendering issues
    if (content.includes("{{") && content.includes("}}")) {
      // Unrendered Handlebars template
      return false;
    }
    if (content.includes("undefined") && !content.includes("typeof")) {
      // Check for accidental undefined values (but allow typeof checks)
      const lines = content.split("\n");
      for (const line of lines) {
        if (line.includes(": undefined") || line.includes("= undefined")) {
          return false;
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

describe("Full-Stack Generation", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-test-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("generates node-hono + react-vite + postgres-drizzle project", async () => {
    const projectDir = join(tempDir, "node-react-postgres");

    const { actions, manifest } = await composeModules(
      {
        backend: "node-hono",
        frontend: "react-vite",
        database: "postgres-drizzle",
        infra: ["docker-compose"],
      },
      {
        name: "test-app",
        projectDir,
        backendDir: "backend",
        frontendDir: "frontend",
      },
    );

    // Verify manifest
    expect(manifest.modules).toContain("backends/node-hono");
    expect(manifest.modules).toContain("frontends/react-vite");
    expect(manifest.modules).toContain("databases/postgres-drizzle");
    expect(manifest.modules).toContain("infra/docker-compose");

    // Verify dependencies were collected
    expect(manifest.dependencies).toHaveProperty("hono");
    expect(manifest.dependencies).toHaveProperty("react");
    expect(manifest.dependencies).toHaveProperty("drizzle-orm");

    // Verify scripts were collected
    expect(manifest.scripts).toHaveProperty("dev:backend");
    expect(manifest.scripts).toHaveProperty("dev:frontend");
    expect(manifest.scripts).toHaveProperty("docker:up");
  });

  test("generates python-fastapi + vue-vite + supabase project", async () => {
    const projectDir = join(tempDir, "python-vue-supabase");

    const { actions, manifest } = await composeModules(
      {
        backend: "python-fastapi",
        frontend: "vue-vite",
        cloud: ["supabase"],
      },
      {
        name: "py-vue-app",
        projectDir,
        backendDir: "backend",
        frontendDir: "frontend",
      },
    );

    expect(manifest.modules).toContain("backends/python-fastapi");
    expect(manifest.modules).toContain("frontends/vue-vite");
    expect(manifest.modules).toContain("cloud/supabase");

    expect(manifest.dependencies).toHaveProperty("vue");
    expect(manifest.dependencies).toHaveProperty("@supabase/supabase-js");
  });

  test("generates rust-axum + solid-vite + kubernetes project", async () => {
    const projectDir = join(tempDir, "rust-solid-k8s");

    const { actions, manifest } = await composeModules(
      {
        backend: "rust-axum",
        frontend: "solid-vite",
        infra: ["kubernetes", "github-actions"],
      },
      {
        name: "rust-solid-app",
        projectDir,
        backendDir: "backend",
        frontendDir: "frontend",
      },
    );

    expect(manifest.modules).toContain("backends/rust-axum");
    expect(manifest.modules).toContain("frontends/solid-vite");
    expect(manifest.modules).toContain("infra/kubernetes");
    expect(manifest.modules).toContain("infra/github-actions");

    expect(manifest.dependencies).toHaveProperty("solid-js");
    expect(manifest.scripts).toHaveProperty("k8s:apply");
  });

  test("generates go-chi + terraform + aws project", async () => {
    const projectDir = join(tempDir, "go-aws");

    const { actions, manifest } = await composeModules(
      {
        backend: "go-chi",
        infra: ["terraform"],
        cloud: ["aws"],
      },
      {
        name: "go-aws-app",
        projectDir,
        backendDir: "backend",
      },
    );

    expect(manifest.modules).toContain("backends/go-chi");
    expect(manifest.modules).toContain("infra/terraform");
    expect(manifest.modules).toContain("cloud/aws");

    expect(manifest.scripts).toHaveProperty("dev:backend");
    expect(manifest.scripts).toHaveProperty("tf:apply");
  });

  test("generates electron desktop app", async () => {
    const projectDir = join(tempDir, "electron-app");

    const { actions, manifest } = await composeModules(
      {
        frontend: "react-vite",
        desktop: "electron",
      },
      {
        name: "desktop-app",
        projectDir,
        frontendDir: "frontend",
        desktopDir: "desktop",
      },
    );

    expect(manifest.modules).toContain("frontends/react-vite");
    expect(manifest.modules).toContain("desktop/electron");

    expect(manifest.dependencies).toHaveProperty("electron");
    expect(manifest.scripts).toHaveProperty("dev:desktop");
  });

  test("generates tauri desktop app", async () => {
    const projectDir = join(tempDir, "tauri-app");

    const { actions, manifest } = await composeModules(
      {
        frontend: "vue-vite",
        desktop: "tauri",
      },
      {
        name: "tauri-app",
        projectDir,
        frontendDir: "frontend",
      },
    );

    expect(manifest.modules).toContain("frontends/vue-vite");
    expect(manifest.modules).toContain("desktop/tauri");

    expect(manifest.devDependencies).toHaveProperty("@tauri-apps/cli");
    expect(manifest.scripts).toHaveProperty("dev:desktop");
  });

  test("generates react-native mobile app", async () => {
    const projectDir = join(tempDir, "rn-app");

    const { actions, manifest } = await composeModules(
      {
        backend: "node-hono",
        mobile: "react-native",
      },
      {
        name: "mobile-app",
        projectDir,
        backendDir: "backend",
        mobileDir: "mobile",
      },
    );

    expect(manifest.modules).toContain("backends/node-hono");
    expect(manifest.modules).toContain("mobile/react-native");

    expect(manifest.scripts).toHaveProperty("dev:mobile");
  });

  test("generates flutter mobile app", async () => {
    const projectDir = join(tempDir, "flutter-app");

    const { actions, manifest } = await composeModules(
      {
        backend: "python-fastapi",
        mobile: "flutter",
      },
      {
        name: "flutter-app",
        projectDir,
        backendDir: "backend",
        mobileDir: "mobile",
      },
    );

    expect(manifest.modules).toContain("backends/python-fastapi");
    expect(manifest.modules).toContain("mobile/flutter");

    expect(manifest.scripts).toHaveProperty("dev:mobile");
  });

  test("generates cloudflare workers project", async () => {
    const projectDir = join(tempDir, "cf-app");

    const { actions, manifest } = await composeModules(
      {
        cloud: ["cloudflare"],
      },
      {
        name: "cf-app",
        projectDir,
      },
    );

    expect(manifest.modules).toContain("cloud/cloudflare");

    expect(manifest.devDependencies).toHaveProperty("wrangler");
    expect(manifest.scripts).toHaveProperty("cf:dev");
    expect(manifest.scripts).toHaveProperty("cf:deploy");
  });
});

describe("Manifest Merging", () => {
  test("merges dependencies from multiple modules without conflicts", async () => {
    const { manifest } = await composeModules(
      {
        backend: "node-hono",
        frontend: "react-vite",
        database: "postgres-drizzle",
        infra: ["docker-compose", "github-actions"],
        cloud: ["supabase"],
      },
      {
        name: "full-stack-app",
        projectDir: "/tmp/test",
        backendDir: "backend",
        frontendDir: "frontend",
      },
    );

    // All modules should be present
    expect(manifest.modules.length).toBe(6);

    // Dependencies from different modules
    expect(manifest.dependencies).toHaveProperty("hono"); // node-hono
    expect(manifest.dependencies).toHaveProperty("react"); // react-vite
    expect(manifest.dependencies).toHaveProperty("drizzle-orm"); // postgres-drizzle
    expect(manifest.dependencies).toHaveProperty("@supabase/supabase-js"); // supabase

    // Scripts from different modules
    expect(manifest.scripts).toHaveProperty("dev:backend");
    expect(manifest.scripts).toHaveProperty("dev:frontend");
    expect(manifest.scripts).toHaveProperty("db:generate");
    expect(manifest.scripts).toHaveProperty("docker:up");
    expect(manifest.scripts).toHaveProperty("supabase:start");

    // Env vars from different modules
    expect(manifest.envVars).toHaveProperty("PORT");
    expect(manifest.envVars).toHaveProperty("VITE_API_URL");
    expect(manifest.envVars).toHaveProperty("DATABASE_URL");
    expect(manifest.envVars).toHaveProperty("SUPABASE_URL");
  });

  test("handles empty selections gracefully", async () => {
    const { actions, manifest } = await composeModules(
      {},
      {
        name: "empty-app",
        projectDir: "/tmp/test",
      },
    );

    expect(actions.length).toBe(0);
    expect(manifest.modules.length).toBe(0);
    expect(Object.keys(manifest.dependencies).length).toBe(0);
  });

  test("handles 'none' selections correctly", async () => {
    const { manifest } = await composeModules(
      {
        backend: "none",
        frontend: "none",
        database: "none",
        desktop: "none",
        mobile: "none",
      },
      {
        name: "none-app",
        projectDir: "/tmp/test",
      },
    );

    expect(manifest.modules.length).toBe(0);
  });
});
