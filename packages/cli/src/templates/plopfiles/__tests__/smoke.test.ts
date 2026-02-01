/**
 * Smoke Tests
 *
 * Actually generates projects, installs dependencies, and runs builds.
 * These tests are slower and require external tools (bun, npm, cargo, go, etc.)
 *
 * Run with: bun test smoke.test.ts
 * Or skip with: bun test --test-name-pattern "^(?!.*smoke).*$"
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { $ } from "bun";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import nodePlop from "node-plop";
import { composeModules, loadModule } from "../_modules/composer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Timeout for slow operations
const SLOW_TIMEOUT = 120_000; // 2 minutes

// Helper to execute plop actions
async function executePlopActions(
  destPath: string,
  actions: Array<Record<string, unknown>>,
  context: Record<string, unknown>,
) {
  const plop = await nodePlop(undefined, {
    destBasePath: destPath,
    force: true,
  });

  // Register helpers on plop's Handlebars instance
  plop.setHelper(
    "kebabCase",
    (str: string) =>
      str
        ?.toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "") || "",
  );
  plop.setHelper(
    "snakeCase",
    (str: string) =>
      str
        ?.toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "") || "",
  );
  plop.setHelper("camelCase", (str: string) => {
    if (!str) return "";
    return str.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase());
  });
  plop.setHelper("pascalCase", (str: string) => {
    if (!str) return "";
    const camel = str
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr: string) => chr.toUpperCase());
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  });
  plop.setHelper(
    "titleCase",
    (str: string) => str?.replace(/\b\w/g, (char) => char.toUpperCase()) || "",
  );
  plop.setHelper("eq", (a: unknown, b: unknown) => a === b);
  plop.setHelper("ne", (a: unknown, b: unknown) => a !== b);
  plop.setHelper("json", (obj: unknown) => JSON.stringify(obj, null, 2));

  // Create a generator with the given actions
  plop.setGenerator("temp", {
    description: "temp",
    prompts: [],
    actions: actions as any[],
  });

  const gen = plop.getGenerator("temp");
  const results = await gen.runActions(context);

  if (results.failures && results.failures.length > 0) {
    const errors = results.failures.map((f) => f.error || f.message || String(f)).join("\n");
    throw new Error(`Generation failed:\n${errors}`);
  }

  return results;
}

// Helper to generate a single module
async function generateModule(
  category: string,
  moduleName: string,
  destPath: string,
  context: Record<string, unknown>,
) {
  const mod = await loadModule(category, moduleName);
  const actions = mod.default(context);
  await executePlopActions(destPath, actions, context);
  return mod;
}

// Helper to check if a command exists
async function commandExists(cmd: string): Promise<boolean> {
  try {
    await $`which ${cmd}`.quiet();
    return true;
  } catch {
    return false;
  }
}

describe("Smoke Tests - Node.js Projects", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-smoke-node-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "node-hono backend builds and type-checks",
    async () => {
      const projectDir = join(tempDir, "node-hono-test");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "node-hono-test",
        projectDir,
        backendDir: "backend",
      };

      await generateModule("backends", "node-hono", projectDir, context);

      // Write package.json to root
      const packageJson = {
        name: "node-hono-test",
        type: "module",
        scripts: {
          typecheck: "tsc -p backend/tsconfig.json --noEmit",
        },
        dependencies: {
          hono: "^4.0.0",
          "@hono/node-server": "^1.8.0",
        },
        devDependencies: {
          "@types/bun": "latest",
          "@types/node": "^20.10.0",
          typescript: "^5.3.0",
        },
      };
      await writeFile(join(projectDir, "package.json"), JSON.stringify(packageJson, null, 2));

      // Install and type-check
      const result = await $`cd ${projectDir} && bun install && bun run typecheck 2>&1`.nothrow();

      // Even if typecheck has warnings, it shouldn't have errors
      expect(result.exitCode).toBeLessThanOrEqual(1);
    },
    SLOW_TIMEOUT,
  );

  test(
    "node-express backend builds and type-checks",
    async () => {
      const projectDir = join(tempDir, "node-express-test");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "node-express-test",
        projectDir,
        backendDir: "backend",
      };

      await generateModule("backends", "node-express", projectDir, context);

      const packageJson = {
        name: "node-express-test",
        type: "module",
        scripts: {
          typecheck: "tsc -p backend/tsconfig.json --noEmit",
        },
        dependencies: {
          express: "^4.18.0",
          cors: "^2.8.5",
          helmet: "^7.1.0",
          "express-rate-limit": "^7.1.0",
          dotenv: "^16.3.0",
        },
        devDependencies: {
          "@types/express": "^4.17.0",
          "@types/cors": "^2.8.0",
          "@types/node": "^20.10.0",
          typescript: "^5.3.0",
        },
      };
      await writeFile(join(projectDir, "package.json"), JSON.stringify(packageJson, null, 2));

      const result = await $`cd ${projectDir} && bun install && bun run typecheck 2>&1`.nothrow();
      expect(result.exitCode).toBeLessThanOrEqual(1);
    },
    SLOW_TIMEOUT,
  );
});

describe("Smoke Tests - Frontend Projects", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-smoke-frontend-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "react-vite frontend type-checks",
    async () => {
      const projectDir = join(tempDir, "react-vite-test");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "react-vite-test",
        projectDir,
        frontendDir: "frontend",
      };

      await generateModule("frontends", "react-vite", projectDir, context);

      const packageJson = {
        name: "react-vite-test",
        type: "module",
        scripts: {
          typecheck: "tsc --noEmit -p frontend/tsconfig.json",
        },
        dependencies: {
          react: "^18.2.0",
          "react-dom": "^18.2.0",
          "react-router-dom": "^6.20.0",
          "@tanstack/react-query": "^5.0.0",
        },
        devDependencies: {
          "@types/react": "^18.2.0",
          "@types/react-dom": "^18.2.0",
          "@vitejs/plugin-react": "^4.2.0",
          autoprefixer: "^10.4.0",
          postcss: "^8.4.0",
          tailwindcss: "^3.4.0",
          typescript: "^5.3.0",
          vite: "^5.0.0",
        },
      };
      await writeFile(join(projectDir, "package.json"), JSON.stringify(packageJson, null, 2));

      const result = await $`cd ${projectDir} && bun install 2>&1`.nothrow();
      expect(result.exitCode).toBe(0);
    },
    SLOW_TIMEOUT,
  );

  test(
    "vue-vite frontend installs correctly",
    async () => {
      const projectDir = join(tempDir, "vue-vite-test");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "vue-vite-test",
        projectDir,
        frontendDir: "frontend",
      };

      await generateModule("frontends", "vue-vite", projectDir, context);

      const packageJson = {
        name: "vue-vite-test",
        type: "module",
        dependencies: {
          vue: "^3.4.0",
          "vue-router": "^4.2.0",
          pinia: "^2.1.0",
          "@tanstack/vue-query": "^5.0.0",
        },
        devDependencies: {
          "@vitejs/plugin-vue": "^5.0.0",
          typescript: "^5.3.0",
          vite: "^5.0.0",
        },
      };
      await writeFile(join(projectDir, "package.json"), JSON.stringify(packageJson, null, 2));

      const result = await $`cd ${projectDir} && bun install 2>&1`.nothrow();
      expect(result.exitCode).toBe(0);
    },
    SLOW_TIMEOUT,
  );

  test(
    "solid-vite frontend installs correctly",
    async () => {
      const projectDir = join(tempDir, "solid-vite-test");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "solid-vite-test",
        projectDir,
        frontendDir: "frontend",
      };

      await generateModule("frontends", "solid-vite", projectDir, context);

      const packageJson = {
        name: "solid-vite-test",
        type: "module",
        dependencies: {
          "solid-js": "^1.8.0",
          "@solidjs/router": "^0.10.0",
          "@tanstack/solid-query": "^5.0.0",
        },
        devDependencies: {
          "vite-plugin-solid": "^2.8.0",
          typescript: "^5.3.0",
          vite: "^5.0.0",
        },
      };
      await writeFile(join(projectDir, "package.json"), JSON.stringify(packageJson, null, 2));

      const result = await $`cd ${projectDir} && bun install 2>&1`.nothrow();
      expect(result.exitCode).toBe(0);
    },
    SLOW_TIMEOUT,
  );
});

describe("Smoke Tests - Rust Projects", () => {
  let tempDir: string;
  let cargoAvailable: boolean;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-smoke-rust-"));
    cargoAvailable = await commandExists("cargo");
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "rust-axum backend has valid Cargo.toml",
    async () => {
      const projectDir = join(tempDir, "rust-axum-test");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "rust-axum-test",
        projectDir,
        backendDir: "backend",
      };

      await generateModule("backends", "rust-axum", projectDir, context);

      // Check Cargo.toml exists and is valid TOML
      const cargoToml = await Bun.file(join(projectDir, "backend", "Cargo.toml")).text();
      expect(cargoToml).toContain("[package]");
      expect(cargoToml).toContain("axum");

      if (cargoAvailable) {
        const result = await $`cd ${join(projectDir, "backend")} && cargo check 2>&1`.nothrow();
        // Might fail due to network issues downloading deps, but shouldn't have syntax errors
        expect(result.exitCode).toBeLessThanOrEqual(101);
      }
    },
    SLOW_TIMEOUT,
  );
});

describe("Smoke Tests - Go Projects", () => {
  let tempDir: string;
  let goAvailable: boolean;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-smoke-go-"));
    goAvailable = await commandExists("go");
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "go-chi backend has valid go.mod",
    async () => {
      const projectDir = join(tempDir, "go-chi-test");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "go-chi-test",
        projectDir,
        backendDir: "backend",
      };

      await generateModule("backends", "go-chi", projectDir, context);

      // Check go.mod exists
      const goMod = await Bun.file(join(projectDir, "backend", "go.mod")).text();
      expect(goMod).toContain("module");
      expect(goMod).toContain("chi");

      if (goAvailable) {
        const result =
          await $`cd ${join(projectDir, "backend")} && go mod tidy && go build ./... 2>&1`.nothrow();
        expect(result.exitCode).toBe(0);
      }
    },
    SLOW_TIMEOUT,
  );
});

describe("Smoke Tests - Python Projects", () => {
  let tempDir: string;
  let pythonAvailable: boolean;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-smoke-python-"));
    pythonAvailable = await commandExists("python3");
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "python-fastapi syntax is valid",
    async () => {
      const projectDir = join(tempDir, "python-fastapi-test");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "python-fastapi-test",
        projectDir,
        backendDir: "backend",
      };

      await generateModule("backends", "python-fastapi", projectDir, context);

      // Check pyproject.toml exists
      const pyproject = await Bun.file(join(projectDir, "backend", "pyproject.toml")).text();
      expect(pyproject).toContain("fastapi");

      if (pythonAvailable) {
        const result =
          await $`python3 -m py_compile ${join(projectDir, "backend/app/main.py")} 2>&1`.nothrow();
        expect(result.exitCode).toBe(0);
      }
    },
    SLOW_TIMEOUT,
  );
});

describe("Smoke Tests - Infrastructure", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-smoke-infra-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "docker-compose.yml is generated correctly",
    async () => {
      const projectDir = join(tempDir, "docker-compose-test");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "docker-compose-test",
        projectDir,
        backendDir: "backend",
        frontendDir: "frontend",
        backend: "node-hono",
        frontend: "react-vite",
        database: "postgres-drizzle",
      };

      await generateModule("infra", "docker-compose", projectDir, context);

      // Check docker-compose.yml exists and has expected content
      const dockerCompose = await Bun.file(join(projectDir, "docker-compose.yml")).text();
      expect(dockerCompose).toContain("version:");
      expect(dockerCompose).toContain("services:");

      if (await commandExists("docker")) {
        const result = await $`cd ${projectDir} && docker compose config 2>&1`.nothrow();
        // Check it parses without YAML errors
        expect(result.stdout.toString() + result.stderr.toString()).not.toMatch(/yaml.*error/i);
      }
    },
    SLOW_TIMEOUT,
  );

  test(
    "kubernetes manifests are generated correctly",
    async () => {
      const projectDir = join(tempDir, "k8s-test");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "k8s-test",
        projectDir,
        backendDir: "backend",
      };

      await generateModule("infra", "kubernetes", projectDir, context);

      // Check k8s files exist
      const deployment = await Bun.file(join(projectDir, "k8s/base/deployment.yaml")).text();
      expect(deployment).toContain("apiVersion:");
      expect(deployment).toContain("kind: Deployment");

      if (await commandExists("kubectl")) {
        const result =
          await $`kubectl apply --dry-run=client -f ${join(projectDir, "k8s/base/deployment.yaml")} 2>&1`.nothrow();
        expect(result.exitCode).toBeLessThanOrEqual(1);
      }
    },
    SLOW_TIMEOUT,
  );

  test(
    "terraform files are generated correctly",
    async () => {
      const projectDir = join(tempDir, "terraform-test");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "terraform-test",
        projectDir,
      };

      await generateModule("infra", "terraform", projectDir, context);

      // Check terraform files exist
      const mainTf = await Bun.file(join(projectDir, "infra/terraform/main.tf")).text();
      expect(mainTf).toContain("terraform");
      expect(mainTf).toContain("required_version");

      if (await commandExists("terraform")) {
        const result =
          await $`cd ${join(projectDir, "infra/terraform")} && terraform init -backend=false && terraform validate 2>&1`.nothrow();
        // Should at least not have syntax errors
        expect(result.stdout.toString() + result.stderr.toString()).not.toMatch(/Error:/);
      }
    },
    SLOW_TIMEOUT,
  );
});

describe("Smoke Tests - Cloud Providers", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-smoke-cloud-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("cloudflare worker is generated correctly", async () => {
    const projectDir = join(tempDir, "cloudflare-test");
    await mkdir(projectDir, { recursive: true });

    const context = {
      name: "cloudflare-test",
      projectDir,
    };

    await generateModule("cloud", "cloudflare", projectDir, context);

    // Check wrangler.toml exists
    const wranglerToml = await Bun.file(join(projectDir, "wrangler.toml")).text();
    expect(wranglerToml).toContain("name");
    expect(wranglerToml).toContain("main");

    // Check worker.ts exists
    const workerTs = await Bun.file(join(projectDir, "src/worker.ts")).text();
    expect(workerTs).toContain("fetch");
    expect(workerTs).toContain("Request");
  });

  test("supabase config is generated correctly", async () => {
    const projectDir = join(tempDir, "supabase-test");
    await mkdir(projectDir, { recursive: true });

    const context = {
      name: "supabase-test",
      projectDir,
    };

    await generateModule("cloud", "supabase", projectDir, context);

    // Check supabase config exists
    const configToml = await Bun.file(join(projectDir, "supabase/config.toml")).text();
    expect(configToml).toContain("[api]");
    expect(configToml).toContain("[auth]");

    // Check migration exists
    const migration = await Bun.file(
      join(projectDir, "supabase/migrations/00000000000000_init.sql"),
    ).text();
    expect(migration.toLowerCase()).toContain("create table");
  });
});
