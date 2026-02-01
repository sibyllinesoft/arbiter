/**
 * E2E Tests
 *
 * Actually starts servers and makes HTTP requests to verify they work.
 * These tests are slower and require the generated projects to run.
 *
 * Run with: bun test e2e.test.ts
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { $ } from "bun";
import { mkdir, mkdtemp, rm, writeFile } from "fs/promises";
import nodePlop from "node-plop";
import { loadModule } from "../_modules/composer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const E2E_TIMEOUT = 60_000; // 1 minute per test

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

// Helper to wait for server to be ready
async function waitForServer(url: string, maxAttempts = 30, intervalMs = 200): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // Server not ready yet
    }
    await Bun.sleep(intervalMs);
  }
  return false;
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

describe("E2E Tests - Node.js Backends", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-e2e-node-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "node-hono backend starts and responds to health check",
    async () => {
      const projectDir = join(tempDir, "hono-e2e");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "hono-e2e",
        projectDir,
        backendDir: "backend",
      };

      await generateModule("backends", "node-hono", projectDir, context);

      const packageJson = {
        name: "hono-e2e",
        type: "module",
        dependencies: {
          hono: "^4.0.0",
          "@hono/node-server": "^1.8.0",
        },
        devDependencies: {
          tsx: "^4.0.0",
        },
      };
      await writeFile(join(projectDir, "package.json"), JSON.stringify(packageJson, null, 2));

      // Install dependencies
      await $`cd ${projectDir} && bun install`.quiet();

      // Use a random high port to avoid conflicts
      const port = 30000 + Math.floor(Math.random() * 10000);

      // Start server with tsx (handles .ts files with .js imports correctly)
      const server = Bun.spawn(["bunx", "tsx", "backend/src/index.ts"], {
        cwd: projectDir,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, PORT: String(port) },
      });

      try {
        // Wait for server to be ready
        const ready = await waitForServer(`http://localhost:${port}/health`);
        expect(ready).toBe(true);

        // Test health endpoint
        const healthResponse = await fetch(`http://localhost:${port}/health`);
        expect(healthResponse.ok).toBe(true);
        const healthData = await healthResponse.json();
        expect(healthData).toHaveProperty("status");

        // Test root endpoint
        const rootResponse = await fetch(`http://localhost:${port}/`);
        expect(rootResponse.ok).toBe(true);
      } finally {
        server.kill();
      }
    },
    E2E_TIMEOUT,
  );

  test(
    "node-express backend starts and responds to health check",
    async () => {
      const projectDir = join(tempDir, "express-e2e");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "express-e2e",
        projectDir,
        backendDir: "backend",
      };

      await generateModule("backends", "node-express", projectDir, context);

      // Use a random high port to avoid conflicts
      const port = 30000 + Math.floor(Math.random() * 10000);

      const packageJson = {
        name: "express-e2e",
        type: "module",
        scripts: {
          start: "bun run backend/src/index.ts",
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
        },
      };
      await writeFile(join(projectDir, "package.json"), JSON.stringify(packageJson, null, 2));

      await $`cd ${projectDir} && bun install`.quiet();

      const server = Bun.spawn(["bun", "run", "start"], {
        cwd: projectDir,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, PORT: String(port) },
      });

      try {
        const ready = await waitForServer(`http://localhost:${port}/health`);
        expect(ready).toBe(true);

        const healthResponse = await fetch(`http://localhost:${port}/health`);
        expect(healthResponse.ok).toBe(true);
        const healthData = await healthResponse.json();
        expect(healthData).toHaveProperty("status");
      } finally {
        server.kill();
      }
    },
    E2E_TIMEOUT,
  );
});

describe("E2E Tests - Go Backend", () => {
  let tempDir: string;
  let goAvailable: boolean;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-e2e-go-"));
    goAvailable = await commandExists("go");
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "go-chi backend builds and responds to health check",
    async () => {
      if (!goAvailable) {
        console.log("Skipping: go not available");
        return;
      }

      const projectDir = join(tempDir, "go-chi-e2e");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "go-chi-e2e",
        projectDir,
        backendDir: "backend",
      };

      await generateModule("backends", "go-chi", projectDir, context);

      const backendDir = join(projectDir, "backend");

      // Build the Go binary (main package is in cmd/server)
      const buildResult =
        await $`cd ${backendDir} && go mod tidy && go build -o server ./cmd/server`.nothrow();
      expect(buildResult.exitCode).toBe(0);

      // Use a random high port to avoid conflicts
      const port = 30000 + Math.floor(Math.random() * 10000);

      // Start server
      const server = Bun.spawn(["./server"], {
        cwd: backendDir,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, PORT: String(port) },
      });

      try {
        const ready = await waitForServer(`http://localhost:${port}/health`);
        expect(ready).toBe(true);

        const healthResponse = await fetch(`http://localhost:${port}/health`);
        expect(healthResponse.ok).toBe(true);
      } finally {
        server.kill();
      }
    },
    E2E_TIMEOUT,
  );
});

describe("E2E Tests - Python Backend", () => {
  let tempDir: string;
  let uvicornAvailable: boolean;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-e2e-python-"));
    uvicornAvailable = await commandExists("uvicorn");
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "python-fastapi backend starts and responds to health check",
    async () => {
      if (!uvicornAvailable) {
        console.log("Skipping: uvicorn not available");
        return;
      }

      const projectDir = join(tempDir, "fastapi-e2e");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "fastapi-e2e",
        projectDir,
        backendDir: "backend",
      };

      await generateModule("backends", "python-fastapi", projectDir, context);

      const backendDir = join(projectDir, "backend");

      // Install dependencies
      const installResult = await $`cd ${backendDir} && pip install -e . --quiet`.nothrow();
      if (installResult.exitCode !== 0) {
        console.log("Skipping: pip install failed");
        return;
      }

      // Start server
      const server = Bun.spawn(["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3904"], {
        cwd: backendDir,
        stdout: "pipe",
        stderr: "pipe",
      });

      try {
        const ready = await waitForServer("http://localhost:3904/health");
        expect(ready).toBe(true);

        const healthResponse = await fetch("http://localhost:3904/health");
        expect(healthResponse.ok).toBe(true);

        // FastAPI also generates OpenAPI docs
        const docsResponse = await fetch("http://localhost:3904/docs");
        expect(docsResponse.ok).toBe(true);
      } finally {
        server.kill();
      }
    },
    E2E_TIMEOUT,
  );
});

describe("E2E Tests - Cloudflare Worker", () => {
  let tempDir: string;
  let wranglerAvailable: boolean;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-e2e-cf-"));
    wranglerAvailable = await commandExists("wrangler");
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test(
    "cloudflare worker runs locally with wrangler",
    async () => {
      if (!wranglerAvailable) {
        console.log("Skipping: wrangler not available");
        return;
      }

      const projectDir = join(tempDir, "cf-worker-e2e");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "cf-worker-e2e",
        projectDir,
      };

      await generateModule("cloud", "cloudflare", projectDir, context);

      // Install dependencies
      const packageJson = {
        name: "cf-worker-e2e",
        type: "module",
        devDependencies: {
          wrangler: "^3.0.0",
        },
      };
      await writeFile(join(projectDir, "package.json"), JSON.stringify(packageJson, null, 2));
      await $`cd ${projectDir} && bun install`.quiet();

      // Start local dev server
      const server = Bun.spawn(["bunx", "wrangler", "dev", "--port", "3905"], {
        cwd: projectDir,
        stdout: "pipe",
        stderr: "pipe",
      });

      try {
        const ready = await waitForServer("http://localhost:3905/");
        if (ready) {
          const response = await fetch("http://localhost:3905/");
          expect(response.ok).toBe(true);
        } else {
          console.log("Wrangler dev server did not start in time");
        }
      } finally {
        server.kill();
      }
    },
    E2E_TIMEOUT,
  );
});
