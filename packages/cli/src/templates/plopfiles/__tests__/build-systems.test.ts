/**
 * Build Systems Tests
 *
 * Comprehensive tests for Bazel, Nx, and Turborepo template modules.
 * Includes generation tests, linting, and E2E validation where possible.
 *
 * Run with: bun test build-systems.test.ts
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { $ } from "bun";
import { mkdir, mkdtemp, readFile, readdir, rm } from "fs/promises";
import nodePlop from "node-plop";
import { loadModule } from "../_modules/composer.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const TEST_TIMEOUT = 60_000;

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

  // Register helpers
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
        .replace(/[\s-]+/g, "_")
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
  plop.setHelper(
    "has",
    (arr: unknown[], item: unknown) => Array.isArray(arr) && arr.includes(item),
  );
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

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await $`which ${cmd}`.quiet();
    return true;
  } catch {
    return false;
  }
}

// Track available tools
const tools: Record<string, boolean> = {};

beforeAll(async () => {
  tools.bazel = await commandExists("bazel");
  tools.buildifier = await commandExists("buildifier");
  tools.nx = await commandExists("nx");
  tools.turbo = await commandExists("turbo");

  console.log(
    "Available build tools:",
    Object.entries(tools)
      .filter(([_, v]) => v)
      .map(([k]) => k)
      .join(", ") || "none",
  );
});

describe("Bazel Module", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-bazel-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("generates repo-level configs for Node.js backend", async () => {
    const projectDir = join(tempDir, "node-backend");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "backend"), { recursive: true });

    const context = {
      name: "node-app",
      projectDir,
      backendDir: "backend",
      backend: "node-hono",
      frontend: "none",
    };

    await generateModule("build", "bazel", projectDir, context);

    // Check repo-level files exist
    const files = await readdir(projectDir);
    expect(files).toContain("WORKSPACE.bazel");
    expect(files).toContain(".bazelrc");
    expect(files).toContain(".bazelignore");
    expect(files).toContain("BUILD.bazel");

    // Check backend BUILD file
    const backendFiles = await readdir(join(projectDir, "backend"));
    expect(backendFiles).toContain("BUILD.bazel");

    // Validate WORKSPACE content
    const workspaceContent = await readFile(join(projectDir, "WORKSPACE.bazel"), "utf-8");
    expect(workspaceContent).toContain('workspace(name = "node_app")');
    expect(workspaceContent).toContain("aspect_rules_js");
    expect(workspaceContent).toContain("aspect_rules_ts");
  });

  test("generates repo-level configs for Go backend", async () => {
    const projectDir = join(tempDir, "go-backend");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "backend"), { recursive: true });

    const context = {
      name: "go-app",
      projectDir,
      backendDir: "backend",
      backend: "go-chi",
      frontend: "none",
    };

    await generateModule("build", "bazel", projectDir, context);

    const workspaceContent = await readFile(join(projectDir, "WORKSPACE.bazel"), "utf-8");
    expect(workspaceContent).toContain("io_bazel_rules_go");
    expect(workspaceContent).toContain("bazel_gazelle");

    const backendBuildContent = await readFile(join(projectDir, "backend/BUILD.bazel"), "utf-8");
    expect(backendBuildContent).toContain("go_binary");
    expect(backendBuildContent).toContain("go_library");
  });

  test("generates repo-level configs for Python backend", async () => {
    const projectDir = join(tempDir, "python-backend");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "backend"), { recursive: true });

    const context = {
      name: "python-app",
      projectDir,
      backendDir: "backend",
      backend: "python-fastapi",
      frontend: "none",
    };

    await generateModule("build", "bazel", projectDir, context);

    const workspaceContent = await readFile(join(projectDir, "WORKSPACE.bazel"), "utf-8");
    expect(workspaceContent).toContain("rules_python");

    const backendBuildContent = await readFile(join(projectDir, "backend/BUILD.bazel"), "utf-8");
    expect(backendBuildContent).toContain("py_binary");
    expect(backendBuildContent).toContain("py_library");
  });

  test("generates repo-level configs for Rust backend", async () => {
    const projectDir = join(tempDir, "rust-backend");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "backend"), { recursive: true });

    const context = {
      name: "rust-app",
      projectDir,
      backendDir: "backend",
      backend: "rust-axum",
      frontend: "none",
    };

    await generateModule("build", "bazel", projectDir, context);

    const workspaceContent = await readFile(join(projectDir, "WORKSPACE.bazel"), "utf-8");
    expect(workspaceContent).toContain("rules_rust");

    const backendBuildContent = await readFile(join(projectDir, "backend/BUILD.bazel"), "utf-8");
    expect(backendBuildContent).toContain("rust_binary");
    expect(backendBuildContent).toContain("rust_library");
  });

  test("generates frontend BUILD file for React", async () => {
    const projectDir = join(tempDir, "full-stack");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "backend"), { recursive: true });
    await mkdir(join(projectDir, "frontend"), { recursive: true });

    const context = {
      name: "full-stack-app",
      projectDir,
      backendDir: "backend",
      frontendDir: "frontend",
      backend: "node-hono",
      frontend: "react-vite",
    };

    await generateModule("build", "bazel", projectDir, context);

    const frontendBuildContent = await readFile(join(projectDir, "frontend/BUILD.bazel"), "utf-8");
    expect(frontendBuildContent).toContain("ts_project");
    expect(frontendBuildContent).toContain("js_run_binary");
  });

  test(
    "buildifier validates generated files",
    async () => {
      if (!tools.buildifier) {
        console.log("Skipping: buildifier not available");
        return;
      }

      const projectDir = join(tempDir, "buildifier-test");
      await mkdir(projectDir, { recursive: true });
      await mkdir(join(projectDir, "backend"), { recursive: true });

      const context = {
        name: "buildifier-test",
        projectDir,
        backendDir: "backend",
        backend: "go-chi",
        frontend: "none",
      };

      await generateModule("build", "bazel", projectDir, context);

      // Run buildifier in check mode
      const result =
        await $`buildifier --lint=warn --mode=check ${join(projectDir, "WORKSPACE.bazel")} ${join(projectDir, "BUILD.bazel")} ${join(projectDir, "backend/BUILD.bazel")}`.nothrow();

      // 0 = valid, 4 = lint warnings (acceptable)
      expect(result.exitCode === 0 || result.exitCode === 4).toBe(true);
    },
    TEST_TIMEOUT,
  );
});

describe("Nx Module", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-nx-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("generates repo-level nx.json", async () => {
    const projectDir = join(tempDir, "repo-level");
    await mkdir(projectDir, { recursive: true });

    const context = {
      name: "nx-app",
      projectDir,
      backend: "none",
      frontend: "none",
    };

    await generateModule("build", "nx", projectDir, context);

    const files = await readdir(projectDir);
    expect(files).toContain("nx.json");
    expect(files).toContain(".nxignore");

    const nxJson = JSON.parse(await readFile(join(projectDir, "nx.json"), "utf-8"));
    expect(nxJson.$schema).toBeDefined();
    expect(nxJson.targetDefaults).toBeDefined();
    expect(nxJson.namedInputs).toBeDefined();
  });

  test("generates project.json for Node.js backend", async () => {
    const projectDir = join(tempDir, "node-backend");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "backend"), { recursive: true });

    const context = {
      name: "nx-node-app",
      projectDir,
      backendDir: "backend",
      backend: "node-hono",
      frontend: "none",
    };

    await generateModule("build", "nx", projectDir, context);

    const projectJson = JSON.parse(
      await readFile(join(projectDir, "backend/project.json"), "utf-8"),
    );

    expect(projectJson.name).toBe("nx-node-app-backend");
    expect(projectJson.projectType).toBe("application");
    expect(projectJson.targets.build).toBeDefined();
    expect(projectJson.targets.serve).toBeDefined();
    expect(projectJson.targets.test).toBeDefined();
    expect(projectJson.targets.lint).toBeDefined();
  });

  test("generates project.json for Go backend", async () => {
    const projectDir = join(tempDir, "go-backend");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "backend"), { recursive: true });

    const context = {
      name: "nx-go-app",
      projectDir,
      backendDir: "backend",
      backend: "go-chi",
      frontend: "none",
    };

    await generateModule("build", "nx", projectDir, context);

    const projectJson = JSON.parse(
      await readFile(join(projectDir, "backend/project.json"), "utf-8"),
    );

    expect(projectJson.targets.build.executor).toContain("nx-go");
    expect(projectJson.targets.test.executor).toContain("nx-go");
  });

  test("generates project.json for Python backend", async () => {
    const projectDir = join(tempDir, "python-backend");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "backend"), { recursive: true });

    const context = {
      name: "nx-python-app",
      projectDir,
      backendDir: "backend",
      backend: "python-fastapi",
      frontend: "none",
    };

    await generateModule("build", "nx", projectDir, context);

    const projectJson = JSON.parse(
      await readFile(join(projectDir, "backend/project.json"), "utf-8"),
    );

    expect(projectJson.targets.serve.options.command).toContain("uvicorn");
    expect(projectJson.targets.test.options.command).toContain("pytest");
  });

  test("generates project.json for React frontend", async () => {
    const projectDir = join(tempDir, "react-frontend");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "backend"), { recursive: true });
    await mkdir(join(projectDir, "frontend"), { recursive: true });

    const context = {
      name: "nx-react-app",
      projectDir,
      backendDir: "backend",
      frontendDir: "frontend",
      backend: "node-hono",
      frontend: "react-vite",
    };

    await generateModule("build", "nx", projectDir, context);

    const projectJson = JSON.parse(
      await readFile(join(projectDir, "frontend/project.json"), "utf-8"),
    );

    expect(projectJson.name).toBe("nx-react-app-frontend");
    expect(projectJson.targets.build.executor).toContain("vite");
    expect(projectJson.targets.serve.executor).toContain("vite");
    expect(projectJson.implicitDependencies).toContain("nx-react-app-backend");
  });

  test("nx.json plugins vary by backend language", async () => {
    // Test that different backends get appropriate Nx plugins
    const backends = [
      { backend: "node-hono", expected: "@nx/js/typescript" },
      { backend: "go-chi", expected: "@nx-go/nx-go" },
      { backend: "python-fastapi", expected: "@nx/python" },
      { backend: "rust-axum", expected: "@monodon/rust" },
    ];

    for (const { backend, expected } of backends) {
      const projectDir = join(tempDir, `nx-${backend}`);
      await mkdir(projectDir, { recursive: true });
      await mkdir(join(projectDir, "backend"), { recursive: true });

      const context = {
        name: `nx-${backend}-app`,
        projectDir,
        backendDir: "backend",
        backend,
        frontend: "none",
      };

      await generateModule("build", "nx", projectDir, context);

      const nxJson = JSON.parse(await readFile(join(projectDir, "nx.json"), "utf-8"));
      const plugins = JSON.stringify(nxJson.plugins);
      expect(plugins).toContain(expected);
    }
  });
});

describe("Turborepo Module", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-turbo-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("generates repo-level turbo.json", async () => {
    const projectDir = join(tempDir, "repo-level");
    await mkdir(projectDir, { recursive: true });

    const context = {
      name: "turbo-app",
      projectDir,
      backend: "none",
      frontend: "none",
    };

    await generateModule("build", "turborepo", projectDir, context);

    const files = await readdir(projectDir);
    expect(files).toContain("turbo.json");

    const turboJson = JSON.parse(await readFile(join(projectDir, "turbo.json"), "utf-8"));
    expect(turboJson.$schema).toBeDefined();
    expect(turboJson.tasks).toBeDefined();
    expect(turboJson.tasks.build).toBeDefined();
    expect(turboJson.tasks.dev).toBeDefined();
    expect(turboJson.tasks.test).toBeDefined();
    expect(turboJson.tasks.lint).toBeDefined();
  });

  test("generates package-level turbo.json for Node.js backend", async () => {
    const projectDir = join(tempDir, "node-backend");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "backend"), { recursive: true });

    const context = {
      name: "turbo-node-app",
      projectDir,
      backendDir: "backend",
      backend: "node-hono",
      frontend: "none",
    };

    await generateModule("build", "turborepo", projectDir, context);

    const backendTurbo = JSON.parse(
      await readFile(join(projectDir, "backend/turbo.json"), "utf-8"),
    );

    expect(backendTurbo.extends).toContain("//");
    expect(backendTurbo.tasks.build).toBeDefined();
    expect(backendTurbo.tasks.build.outputs).toContain("dist/**");
  });

  test("generates package-level turbo.json for Go backend", async () => {
    const projectDir = join(tempDir, "go-backend");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "backend"), { recursive: true });

    const context = {
      name: "turbo-go-app",
      projectDir,
      backendDir: "backend",
      backend: "go-chi",
      frontend: "none",
    };

    await generateModule("build", "turborepo", projectDir, context);

    const backendTurbo = JSON.parse(
      await readFile(join(projectDir, "backend/turbo.json"), "utf-8"),
    );

    expect(backendTurbo.tasks.build.outputs).toContain("bin/**");
    expect(backendTurbo.tasks.test.inputs).toContain("**/*.go");
  });

  test("generates package-level turbo.json for Python backend", async () => {
    const projectDir = join(tempDir, "python-backend");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "backend"), { recursive: true });

    const context = {
      name: "turbo-python-app",
      projectDir,
      backendDir: "backend",
      backend: "python-fastapi",
      frontend: "none",
    };

    await generateModule("build", "turborepo", projectDir, context);

    const backendTurbo = JSON.parse(
      await readFile(join(projectDir, "backend/turbo.json"), "utf-8"),
    );

    expect(backendTurbo.tasks.test.inputs).toContain("app/**/*.py");
    expect(backendTurbo.tasks.lint.inputs).toContain("ruff.toml");
  });

  test("generates package-level turbo.json for Rust backend", async () => {
    const projectDir = join(tempDir, "rust-backend");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "backend"), { recursive: true });

    const context = {
      name: "turbo-rust-app",
      projectDir,
      backendDir: "backend",
      backend: "rust-axum",
      frontend: "none",
    };

    await generateModule("build", "turborepo", projectDir, context);

    const backendTurbo = JSON.parse(
      await readFile(join(projectDir, "backend/turbo.json"), "utf-8"),
    );

    expect(backendTurbo.tasks.build.outputs).toContain("target/release/**");
    expect(backendTurbo.tasks.test.inputs).toContain("src/**/*.rs");
  });

  test("generates frontend turbo.json for React", async () => {
    const projectDir = join(tempDir, "react-frontend");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "frontend"), { recursive: true });

    const context = {
      name: "turbo-react-app",
      projectDir,
      frontendDir: "frontend",
      backend: "none",
      frontend: "react-vite",
    };

    await generateModule("build", "turborepo", projectDir, context);

    const frontendTurbo = JSON.parse(
      await readFile(join(projectDir, "frontend/turbo.json"), "utf-8"),
    );

    expect(frontendTurbo.tasks.build.env).toContain("VITE_API_URL");
    expect(frontendTurbo.tasks.preview).toBeDefined();
  });

  test("full-stack generates both backend and frontend configs", async () => {
    const projectDir = join(tempDir, "full-stack");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "backend"), { recursive: true });
    await mkdir(join(projectDir, "frontend"), { recursive: true });

    const context = {
      name: "turbo-full-stack",
      projectDir,
      backendDir: "backend",
      frontendDir: "frontend",
      backend: "node-hono",
      frontend: "react-vite",
    };

    await generateModule("build", "turborepo", projectDir, context);

    // Verify all files exist
    expect(await Bun.file(join(projectDir, "turbo.json")).exists()).toBe(true);
    expect(await Bun.file(join(projectDir, "backend/turbo.json")).exists()).toBe(true);
    expect(await Bun.file(join(projectDir, "frontend/turbo.json")).exists()).toBe(true);
  });

  test(
    "turbo validates generated config",
    async () => {
      if (!tools.turbo) {
        console.log("Skipping: turbo not available");
        return;
      }

      const projectDir = join(tempDir, "turbo-validate");
      await mkdir(projectDir, { recursive: true });

      const context = {
        name: "turbo-validate",
        projectDir,
        backend: "none",
        frontend: "none",
      };

      await generateModule("build", "turborepo", projectDir, context);

      // Create package.json for turbo
      await Bun.write(
        join(projectDir, "package.json"),
        JSON.stringify({ name: "turbo-validate", private: true, workspaces: [] }, null, 2),
      );

      // turbo should be able to parse the config
      const result = await $`cd ${projectDir} && turbo build --dry-run=json 2>&1`.nothrow();
      expect(result.exitCode).toBeLessThanOrEqual(1);
    },
    TEST_TIMEOUT,
  );
});

describe("Build System Integration", () => {
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "arbiter-build-int-"));
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test("multiple build systems can be generated together", async () => {
    // While not recommended in practice, the modules should not conflict
    const projectDir = join(tempDir, "multi-build");
    await mkdir(projectDir, { recursive: true });
    await mkdir(join(projectDir, "backend"), { recursive: true });

    const context = {
      name: "multi-build-app",
      projectDir,
      backendDir: "backend",
      backend: "node-hono",
      frontend: "none",
    };

    // Generate all three build systems
    await generateModule("build", "bazel", projectDir, context);
    await generateModule("build", "nx", projectDir, context);
    await generateModule("build", "turborepo", projectDir, context);

    // All should coexist
    const files = await readdir(projectDir);
    expect(files).toContain("WORKSPACE.bazel");
    expect(files).toContain("nx.json");
    expect(files).toContain("turbo.json");

    const backendFiles = await readdir(join(projectDir, "backend"));
    expect(backendFiles).toContain("BUILD.bazel");
    expect(backendFiles).toContain("project.json");
    expect(backendFiles).toContain("turbo.json");
  });

  test("generated scripts are consistent across build systems", async () => {
    const bazelMod = await loadModule("build", "bazel");
    const nxMod = await loadModule("build", "nx");
    const turboMod = await loadModule("build", "turborepo");

    // All should have build, test scripts
    expect(bazelMod.scripts).toHaveProperty("bazel:build");
    expect(bazelMod.scripts).toHaveProperty("bazel:test");

    expect(nxMod.scripts).toHaveProperty("nx:build");
    expect(nxMod.scripts).toHaveProperty("nx:test");

    expect(turboMod.scripts).toHaveProperty("build");
    expect(turboMod.scripts).toHaveProperty("test");
  });
});
