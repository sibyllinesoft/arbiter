import { afterAll, describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

import {
  DEFAULT_UI_OPTION_CATALOG,
  buildUIOptionConfig,
  resolveUIOptionCatalog,
} from "@arbiter/specification";

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arbiter-ui-options-"));
  tempDirs.push(dir);
  return dir;
}

afterAll(async () => {
  await Promise.all(tempDirs.map((dir) => fs.remove(dir)));
});

describe("UI option resolution", () => {
  it("prefers generator output and normalizes values", async () => {
    const dir = createTempDir();
    const generatorPath = path.join(dir, "frameworks.js");
    await fs.writeFile(generatorPath, "export default ['Vue', 'Svelte', 'Vue', '']", "utf-8");

    const { catalog, diagnostics } = await resolveUIOptionCatalog(
      {
        frontendFrameworks: {
          values: ["React", ""],
          generator: generatorPath,
        },
      },
      { baseDir: dir },
    );

    expect(catalog.frontendFrameworks).toEqual(["Vue", "Svelte"]);
    expect(diagnostics).toHaveLength(0);
  });

  it("falls back to static values and records diagnostics when generator fails", async () => {
    const { catalog, diagnostics } = await resolveUIOptionCatalog({
      frontendFrameworks: {
        values: ["React", "Next.js"],
        generator: "missing.js",
      },
    });

    expect(catalog.frontendFrameworks).toEqual(["React", "Next.js"]);
    expect(diagnostics[0]).toContain("Failed to execute generator");
  });

  it("deduplicates framework maps from generators", async () => {
    const dir = createTempDir();
    const generatorPath = path.join(dir, "framework-map.js");
    await fs.writeFile(
      generatorPath,
      "export const generate = () => ({ TypeScript: ['NestJS', 'NestJS', 'tRPC'] });",
      "utf-8",
    );

    const { catalog, diagnostics } = await resolveUIOptionCatalog(
      {
        serviceFrameworks: {
          values: { TypeScript: ["Express"] },
          generator: generatorPath,
        },
      },
      { baseDir: dir },
    );

    expect(catalog.serviceFrameworks?.TypeScript).toEqual(["NestJS", "tRPC"]);
    expect(diagnostics).toHaveLength(0);
  });
});

describe("UI option config builder", () => {
  it("builds config entries from catalog and generators without mutating inputs", () => {
    const config = buildUIOptionConfig(DEFAULT_UI_OPTION_CATALOG, {
      frontendFrameworks: "@/__tests__/gen.js",
    });

    expect(config.frontendFrameworks?.values).toEqual(DEFAULT_UI_OPTION_CATALOG.frontendFrameworks);
    expect(config.frontendFrameworks?.generator).toBe("@/__tests__/gen.js");

    // Ensure deep copies were created
    expect(config.frontendFrameworks?.values).not.toBe(
      DEFAULT_UI_OPTION_CATALOG.frontendFrameworks,
    );
    expect(config.serviceFrameworks?.values).not.toBeUndefined();
  });
});
