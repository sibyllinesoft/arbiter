import { describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { DEFAULT_UI_OPTION_CATALOG, UI_OPTION_KEYS, resolveUIOptionCatalog } from "../ui-options";

describe("ui-options", () => {
  it("resolves static values and leaves unspecified keys undefined", async () => {
    const result = await resolveUIOptionCatalog({
      frontendFrameworks: { values: ["React", "Next.js"] },
    });
    expect(result.catalog.frontendFrameworks).toEqual(["React", "Next.js"]);
    expect(result.catalog.serviceLanguages).toBeUndefined();
    expect(result.diagnostics.length).toBe(0);
  });

  it("falls back to defaults when no config provided", async () => {
    const result = await resolveUIOptionCatalog({});
    // None set, so catalog should be empty; defaults are still exported separately
    expect(Object.keys(result.catalog).length).toBe(0);
    expect(DEFAULT_UI_OPTION_CATALOG.frontendFrameworks?.length).toBeGreaterThan(0);
  });

  it("executes generator scripts for array keys", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "ui-opt-"));
    const genPath = path.join(tmpDir, "gen.js");
    await fs.writeFile(genPath, "export const options = ['SvelteKit'];");

    const result = await resolveUIOptionCatalog(
      {
        frontendFrameworks: { generator: genPath },
      },
      { baseDir: tmpDir },
    );

    expect(result.catalog.frontendFrameworks).toEqual(["SvelteKit"]);
    await fs.remove(tmpDir);
  });

  it("collects diagnostics on generator failure", async () => {
    const result = await resolveUIOptionCatalog({
      serviceLanguages: { generator: "missing.js" },
    });
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("exports all option keys", () => {
    expect(UI_OPTION_KEYS).toContain("frontendFrameworks");
    expect(UI_OPTION_KEYS.length).toBeGreaterThan(0);
  });
});
