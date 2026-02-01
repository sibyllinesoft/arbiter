/**
 * Module Loading Tests
 *
 * Validates that all modules can be loaded and have the expected exports.
 */

import { describe, expect, test } from "bun:test";
import { getModuleChoices, listModules, loadModule } from "../_modules/composer.js";

describe("Module Composer", () => {
  test("getModuleChoices returns all categories", async () => {
    const choices = await getModuleChoices();

    expect(choices.backends).toBeInstanceOf(Array);
    expect(choices.frontends).toBeInstanceOf(Array);
    expect(choices.databases).toBeInstanceOf(Array);
    expect(choices.desktop).toBeInstanceOf(Array);
    expect(choices.mobile).toBeInstanceOf(Array);
    expect(choices.infra).toBeInstanceOf(Array);
    expect(choices.cloud).toBeInstanceOf(Array);
    expect(choices.build).toBeInstanceOf(Array);

    // Should have at least one module in each category
    expect(choices.backends.length).toBeGreaterThan(0);
    expect(choices.frontends.length).toBeGreaterThan(1); // includes "none"
    expect(choices.infra.length).toBeGreaterThan(0);
    expect(choices.cloud.length).toBeGreaterThan(0);
    expect(choices.build.length).toBeGreaterThan(0);
  });
});

describe("Backend Modules", () => {
  const backends = [
    "node-hono",
    "node-express",
    "python-fastapi",
    "rust-axum",
    "go-chi",
    "kotlin-ktor",
  ];

  for (const backend of backends) {
    test(`${backend} loads and has required exports`, async () => {
      const mod = await loadModule("backends", backend);

      expect(mod.default).toBeInstanceOf(Function);
      expect(mod.description).toBeTypeOf("string");
      expect(mod.scripts).toBeDefined();
    });

    test(`${backend} returns actions`, async () => {
      const mod = await loadModule("backends", backend);
      const actions = mod.default({
        name: "test-app",
        projectDir: "/tmp/test",
        backendDir: "backend",
      });

      expect(actions).toBeInstanceOf(Array);
      expect(actions.length).toBeGreaterThan(0);
    });
  }
});

describe("Frontend Modules", () => {
  const frontends = ["react-vite", "vue-vite", "solid-vite"];

  for (const frontend of frontends) {
    test(`${frontend} loads and has required exports`, async () => {
      const mod = await loadModule("frontends", frontend);

      expect(mod.default).toBeInstanceOf(Function);
      expect(mod.description).toBeTypeOf("string");
      expect(mod.dependencies).toBeDefined();
      expect(mod.devDependencies).toBeDefined();
      expect(mod.scripts).toBeDefined();
    });

    test(`${frontend} returns actions`, async () => {
      const mod = await loadModule("frontends", frontend);
      const actions = mod.default({
        name: "test-app",
        projectDir: "/tmp/test",
        frontendDir: "frontend",
      });

      expect(actions).toBeInstanceOf(Array);
      expect(actions.length).toBeGreaterThan(0);
    });
  }
});

describe("Database Modules", () => {
  const databases = ["postgres-drizzle"];

  for (const database of databases) {
    test(`${database} loads and has required exports`, async () => {
      const mod = await loadModule("databases", database);

      expect(mod.default).toBeInstanceOf(Function);
      expect(mod.description).toBeTypeOf("string");
    });

    test(`${database} returns actions`, async () => {
      const mod = await loadModule("databases", database);
      const actions = mod.default({
        name: "test-app",
        projectDir: "/tmp/test",
        backendDir: "backend",
      });

      expect(actions).toBeInstanceOf(Array);
      expect(actions.length).toBeGreaterThan(0);
    });
  }
});

describe("Desktop Modules", () => {
  const desktop = ["electron", "tauri"];

  for (const app of desktop) {
    test(`${app} loads and has required exports`, async () => {
      const mod = await loadModule("desktop", app);

      expect(mod.default).toBeInstanceOf(Function);
      expect(mod.description).toBeTypeOf("string");
      expect(mod.scripts).toBeDefined();
    });

    test(`${app} returns actions`, async () => {
      const mod = await loadModule("desktop", app);
      const actions = mod.default({
        name: "test-app",
        projectDir: "/tmp/test",
        desktopDir: "desktop",
      });

      expect(actions).toBeInstanceOf(Array);
      expect(actions.length).toBeGreaterThan(0);
    });
  }
});

describe("Mobile Modules", () => {
  const mobile = ["react-native", "flutter", "android-kotlin", "ios-swift"];

  for (const app of mobile) {
    test(`${app} loads and has required exports`, async () => {
      const mod = await loadModule("mobile", app);

      expect(mod.default).toBeInstanceOf(Function);
      expect(mod.description).toBeTypeOf("string");
      expect(mod.scripts).toBeDefined();
    });

    test(`${app} returns actions`, async () => {
      const mod = await loadModule("mobile", app);
      const actions = mod.default({
        name: "test-app",
        projectDir: "/tmp/test",
        mobileDir: "mobile",
      });

      expect(actions).toBeInstanceOf(Array);
      expect(actions.length).toBeGreaterThan(0);
    });
  }
});

describe("Infrastructure Modules", () => {
  const infra = ["docker-compose", "github-actions", "kubernetes", "terraform", "pulumi", "just"];

  for (const infraMod of infra) {
    test(`${infraMod} loads and has required exports`, async () => {
      const mod = await loadModule("infra", infraMod);

      expect(mod.default).toBeInstanceOf(Function);
      expect(mod.description).toBeTypeOf("string");
    });

    test(`${infraMod} returns actions`, async () => {
      const mod = await loadModule("infra", infraMod);
      const actions = mod.default({
        name: "test-app",
        projectDir: "/tmp/test",
        backendDir: "backend",
        frontendDir: "frontend",
        backend: "node-hono",
        frontend: "react-vite",
        database: "postgres-drizzle",
      });

      expect(actions).toBeInstanceOf(Array);
      expect(actions.length).toBeGreaterThan(0);
    });
  }
});

describe("Cloud Modules", () => {
  const cloud = ["aws", "gcp", "azure", "cloudflare", "supabase"];

  for (const cloudMod of cloud) {
    test(`${cloudMod} loads and has required exports`, async () => {
      const mod = await loadModule("cloud", cloudMod);

      expect(mod.default).toBeInstanceOf(Function);
      expect(mod.description).toBeTypeOf("string");
    });

    test(`${cloudMod} returns actions`, async () => {
      const mod = await loadModule("cloud", cloudMod);
      const actions = mod.default({
        name: "test-app",
        projectDir: "/tmp/test",
      });

      expect(actions).toBeInstanceOf(Array);
      expect(actions.length).toBeGreaterThan(0);
    });
  }
});

describe("Build System Modules", () => {
  const build = ["bazel", "nx", "turborepo"];

  for (const buildMod of build) {
    test(`${buildMod} loads and has required exports`, async () => {
      const mod = await loadModule("build", buildMod);

      expect(mod.default).toBeInstanceOf(Function);
      expect(mod.description).toBeTypeOf("string");
      expect(mod.scripts).toBeDefined();
    });

    test(`${buildMod} returns actions with backend and frontend`, async () => {
      const mod = await loadModule("build", buildMod);
      const actions = mod.default({
        name: "test-app",
        projectDir: "/tmp/test",
        backendDir: "backend",
        frontendDir: "frontend",
        backend: "node-hono",
        frontend: "react-vite",
      });

      expect(actions).toBeInstanceOf(Array);
      expect(actions.length).toBeGreaterThan(0);
    });

    test(`${buildMod} returns actions with backend only`, async () => {
      const mod = await loadModule("build", buildMod);
      const actions = mod.default({
        name: "test-app",
        projectDir: "/tmp/test",
        backendDir: "backend",
        backend: "go-chi",
        frontend: "none",
      });

      expect(actions).toBeInstanceOf(Array);
      expect(actions.length).toBeGreaterThan(0);
    });

    test(`${buildMod} returns repo-level configs without backend/frontend`, async () => {
      const mod = await loadModule("build", buildMod);
      const actions = mod.default({
        name: "test-app",
        projectDir: "/tmp/test",
        backend: "none",
        frontend: "none",
      });

      expect(actions).toBeInstanceOf(Array);
      // Should at least have repo-level configs
      expect(actions.length).toBeGreaterThan(0);
    });
  }
});
