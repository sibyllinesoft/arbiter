import { describe, expect, it } from "bun:test";
import path from "node:path";

import { DEFAULT_PROJECT_STRUCTURE } from "@/io/config/config.js";
import {
  collectClientTargets,
  createClientTarget,
  createServiceTarget,
  toRelativePath,
} from "@/services/generate/io/index.js";

const structure = { ...DEFAULT_PROJECT_STRUCTURE };

describe("generate targets utilities", () => {
  it("computes relative paths correctly", () => {
    const base = "/tmp/project";
    const rel = toRelativePath(base, path.join(base, "clients", "web"));
    expect(rel).toBe("clients/web");

    // same directory yields null
    expect(toRelativePath(base, base)).toBeNull();
  });

  it("creates client target with default directories", () => {
    const target = createClientTarget("web", undefined, structure, "/workspace");
    expect(target.slug).toBe("web");
    expect(target.context.routesDir).toContain(path.join("clients", "web", "src", "routes"));
  });

  it("creates service target with package-relative tests", () => {
    const customStructure = {
      ...structure,
      packageRelative: { ...structure.packageRelative, testsDirectory: true },
    };
    const target = createServiceTarget("api", { language: "python" }, customStructure, "/root");

    expect(target.language).toBe("python");
    expect(target.relativeRoot).toBe("services/api");
    expect(target.context.testsDir).toContain(path.join("services", "api", "tests"));
  });

  it("collects client targets and falls back to product name when none provided", () => {
    const appSpec = { product: { name: "Portal" } } as any;
    const targets = collectClientTargets(appSpec, structure, "/root");
    expect(targets[0].slug).toBe("portal");
  });
});
