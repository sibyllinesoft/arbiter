import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { ServiceGenerationTarget } from "@/services/generate/io/contexts.js";
import {
  type ModuleSelectionFacts,
  buildFacts,
  clearEngineCache,
  selectModules,
  supportsLanguage,
} from "@/services/generate/templates/rule-engine.js";

beforeEach(() => {
  clearEngineCache();
});

afterEach(() => {
  clearEngineCache();
});

// ---------------------------------------------------------------------------
// Helper to build minimal facts
// ---------------------------------------------------------------------------

function makeFacts(overrides: Partial<ModuleSelectionFacts> = {}): ModuleSelectionFacts {
  return {
    language: "typescript",
    framework: "hono",
    subtype: "service",
    tags: [],
    parent: "",
    database: "",
    port: 3000,
    name: "test-service",
    artifactType: "service",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Backend selection — mirrors legacy detectFramework() behavior
// ---------------------------------------------------------------------------

describe("backend module selection", () => {
  it("selects node-hono for typescript + hono service", async () => {
    const facts = makeFacts({ language: "typescript", framework: "hono", subtype: "service" });
    const matches = await selectModules(facts);
    const backend = matches.find((m) => m.category === "backends");
    expect(backend).toBeDefined();
    expect(backend!.module).toBe("node-hono");
  });

  it("selects node-express for javascript + express", async () => {
    const facts = makeFacts({ language: "javascript", framework: "express", subtype: "service" });
    const matches = await selectModules(facts);
    const backend = matches.find((m) => m.category === "backends");
    expect(backend).toBeDefined();
    expect(backend!.module).toBe("node-express");
  });

  it("selects node-fastify for typescript + fastify", async () => {
    const facts = makeFacts({ language: "typescript", framework: "fastify", subtype: "worker" });
    const matches = await selectModules(facts);
    const backend = matches.find((m) => m.category === "backends");
    expect(backend).toBeDefined();
    expect(backend!.module).toBe("node-fastify");
  });

  it("selects python-fastapi for python + fastapi", async () => {
    const facts = makeFacts({ language: "python", framework: "fastapi", subtype: "service" });
    const matches = await selectModules(facts);
    const backend = matches.find((m) => m.category === "backends");
    expect(backend).toBeDefined();
    expect(backend!.module).toBe("python-fastapi");
  });

  it("selects rust-axum for rust + axum", async () => {
    const facts = makeFacts({ language: "rust", framework: "axum", subtype: "service" });
    const matches = await selectModules(facts);
    const backend = matches.find((m) => m.category === "backends");
    expect(backend).toBeDefined();
    expect(backend!.module).toBe("rust-axum");
  });

  it("selects go-chi for go + chi", async () => {
    const facts = makeFacts({ language: "go", framework: "chi", subtype: "service" });
    const matches = await selectModules(facts);
    const backend = matches.find((m) => m.category === "backends");
    expect(backend).toBeDefined();
    expect(backend!.module).toBe("go-chi");
  });

  it("selects kotlin-ktor for kotlin + ktor", async () => {
    const facts = makeFacts({ language: "kotlin", framework: "ktor", subtype: "service" });
    const matches = await selectModules(facts);
    const backend = matches.find((m) => m.category === "backends");
    expect(backend).toBeDefined();
    expect(backend!.module).toBe("kotlin-ktor");
  });

  it("does not match backends for unknown framework", async () => {
    const facts = makeFacts({
      language: "typescript",
      framework: "unknown-fw",
      subtype: "service",
    });
    const matches = await selectModules(facts);
    const backend = matches.find((m) => m.category === "backends");
    expect(backend).toBeUndefined();
  });

  it("does not match backend for frontend subtype", async () => {
    const facts = makeFacts({ language: "typescript", framework: "hono", subtype: "frontend" });
    const matches = await selectModules(facts);
    const backend = matches.find((m) => m.category === "backends");
    expect(backend).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Frontend selection
// ---------------------------------------------------------------------------

describe("frontend module selection", () => {
  it("selects react-vite for frontend + react", async () => {
    const facts = makeFacts({ subtype: "frontend", framework: "react" });
    const matches = await selectModules(facts);
    const frontend = matches.find((m) => m.category === "frontends");
    expect(frontend).toBeDefined();
    expect(frontend!.module).toBe("react-vite");
  });

  it("selects vue-vite for frontend + vue", async () => {
    const facts = makeFacts({ subtype: "frontend", framework: "vue" });
    const matches = await selectModules(facts);
    const frontend = matches.find((m) => m.category === "frontends");
    expect(frontend).toBeDefined();
    expect(frontend!.module).toBe("vue-vite");
  });

  it("selects solid-vite for frontend + solid", async () => {
    const facts = makeFacts({ subtype: "frontend", framework: "solid" });
    const matches = await selectModules(facts);
    const frontend = matches.find((m) => m.category === "frontends");
    expect(frontend).toBeDefined();
    expect(frontend!.module).toBe("solid-vite");
  });
});

// ---------------------------------------------------------------------------
// Quality auto-selection by language
// ---------------------------------------------------------------------------

describe("quality module auto-selection", () => {
  it("selects biome for typescript", async () => {
    const facts = makeFacts({ language: "typescript" });
    const matches = await selectModules(facts);
    const quality = matches.find((m) => m.category === "quality");
    expect(quality).toBeDefined();
    expect(quality!.module).toBe("biome");
  });

  it("selects biome for javascript", async () => {
    const facts = makeFacts({ language: "javascript", framework: "express", subtype: "service" });
    const matches = await selectModules(facts);
    const quality = matches.find((m) => m.category === "quality");
    expect(quality).toBeDefined();
    expect(quality!.module).toBe("biome");
  });

  it("selects clippy for rust", async () => {
    const facts = makeFacts({ language: "rust", framework: "axum", subtype: "service" });
    const matches = await selectModules(facts);
    const quality = matches.find((m) => m.category === "quality");
    expect(quality).toBeDefined();
    expect(quality!.module).toBe("clippy");
  });

  it("selects golangci-lint for go", async () => {
    const facts = makeFacts({ language: "go", framework: "chi", subtype: "service" });
    const matches = await selectModules(facts);
    const quality = matches.find((m) => m.category === "quality");
    expect(quality).toBeDefined();
    expect(quality!.module).toBe("golangci-lint");
  });

  it("selects ruff for python", async () => {
    const facts = makeFacts({ language: "python", framework: "fastapi", subtype: "service" });
    const matches = await selectModules(facts);
    const quality = matches.find((m) => m.category === "quality");
    expect(quality).toBeDefined();
    expect(quality!.module).toBe("ruff");
  });
});

// ---------------------------------------------------------------------------
// Multi-module accumulation
// ---------------------------------------------------------------------------

describe("multi-module accumulation", () => {
  it("TS hono service selects both backend AND quality modules", async () => {
    const facts = makeFacts({ language: "typescript", framework: "hono", subtype: "service" });
    const matches = await selectModules(facts);
    const categories = matches.map((m) => m.category);
    expect(categories).toContain("backends");
    expect(categories).toContain("quality");
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("TS hono service with postgres selects backend + quality + database", async () => {
    const facts = makeFacts({
      language: "typescript",
      framework: "hono",
      subtype: "service",
      database: "postgres",
    });
    const matches = await selectModules(facts);
    const categories = matches.map((m) => m.category);
    expect(categories).toContain("backends");
    expect(categories).toContain("quality");
    expect(categories).toContain("databases");
  });

  it("TS hono service with tags selects backend + quality + infra", async () => {
    const facts = makeFacts({
      language: "typescript",
      framework: "hono",
      subtype: "service",
      tags: ["docker-compose", "github-actions"],
    });
    const matches = await selectModules(facts);
    const categories = matches.map((m) => m.category);
    expect(categories).toContain("backends");
    expect(categories).toContain("quality");
    expect(categories).toContain("infra");
    const infraMatches = matches.filter((m) => m.category === "infra");
    expect(infraMatches.length).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Priority ordering
// ---------------------------------------------------------------------------

describe("priority ordering", () => {
  it("sorts matches by descending priority", async () => {
    const facts = makeFacts({
      language: "typescript",
      framework: "hono",
      subtype: "service",
      database: "postgres",
      tags: ["docker-compose"],
    });
    const matches = await selectModules(facts);

    // Verify descending priority order
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].priority).toBeGreaterThanOrEqual(matches[i].priority);
    }

    // Backend (100) should come before database (50) before quality (20) before infra (10)
    const backendIdx = matches.findIndex((m) => m.category === "backends");
    const dbIdx = matches.findIndex((m) => m.category === "databases");
    const qualityIdx = matches.findIndex((m) => m.category === "quality");
    const infraIdx = matches.findIndex((m) => m.category === "infra");

    expect(backendIdx).toBeLessThan(dbIdx);
    expect(dbIdx).toBeLessThan(qualityIdx);
    expect(qualityIdx).toBeLessThan(infraIdx);
  });
});

// ---------------------------------------------------------------------------
// buildFacts
// ---------------------------------------------------------------------------

describe("buildFacts", () => {
  it("extracts facts from ServiceGenerationTarget", () => {
    const target: ServiceGenerationTarget = {
      key: "api",
      slug: "my-api",
      relativeRoot: "services/api",
      language: "typescript",
      config: {
        name: "my-api",
        language: "typescript",
        framework: "hono",
        subtype: "service",
        tags: ["docker-compose"],
        port: 8080,
      },
      context: {
        root: "/tmp/out",
        routesDir: "/tmp/out/src/routes",
        testsDir: "/tmp/out/tests",
      },
    };

    const facts = buildFacts(target);
    expect(facts.language).toBe("typescript");
    expect(facts.framework).toBe("hono");
    expect(facts.subtype).toBe("service");
    expect(facts.tags).toEqual(["docker-compose"]);
    expect(facts.port).toBe(8080);
    expect(facts.name).toBe("my-api");
  });

  it("handles nested config.service.framework", () => {
    const target: ServiceGenerationTarget = {
      key: "api",
      slug: "my-api",
      relativeRoot: "services/api",
      language: "typescript",
      config: {
        service: { framework: "Hono" },
      },
      context: {
        root: "/tmp/out",
        routesDir: "/tmp/out/src/routes",
        testsDir: "/tmp/out/tests",
      },
    };

    const facts = buildFacts(target);
    expect(facts.framework).toBe("hono");
  });

  it("defaults missing fields gracefully", () => {
    const target: ServiceGenerationTarget = {
      key: "api",
      slug: "my-api",
      relativeRoot: ".",
      language: "",
      config: {},
      context: {
        root: "/tmp/out",
        routesDir: "/tmp/out/src/routes",
        testsDir: "/tmp/out/tests",
      },
    };

    const facts = buildFacts(target);
    expect(facts.language).toBe("");
    expect(facts.framework).toBe("");
    expect(facts.subtype).toBe("service");
    expect(facts.tags).toEqual([]);
    expect(facts.database).toBe("");
    expect(facts.port).toBe(3000);
  });
});

// ---------------------------------------------------------------------------
// supportsLanguage — data-driven from rules
// ---------------------------------------------------------------------------

describe("supportsLanguage", () => {
  it("returns true for typescript + hono", async () => {
    expect(await supportsLanguage("hono", "typescript")).toBe(true);
  });

  it("returns true for javascript + express", async () => {
    expect(await supportsLanguage("express", "javascript")).toBe(true);
  });

  it("returns true for python + fastapi", async () => {
    expect(await supportsLanguage("fastapi", "python")).toBe(true);
  });

  it("returns true for rust + axum", async () => {
    expect(await supportsLanguage("axum", "rust")).toBe(true);
  });

  it("returns true for go + chi", async () => {
    expect(await supportsLanguage("chi", "go")).toBe(true);
  });

  it("returns true for kotlin + ktor", async () => {
    expect(await supportsLanguage("ktor", "kotlin")).toBe(true);
  });

  it("returns false for mismatched language/framework", async () => {
    expect(await supportsLanguage("hono", "python")).toBe(false);
    expect(await supportsLanguage("fastapi", "typescript")).toBe(false);
    expect(await supportsLanguage("axum", "go")).toBe(false);
  });

  it("returns false for unknown framework", async () => {
    expect(await supportsLanguage("unknown-framework", "typescript")).toBe(false);
  });
});
