/** @packageDocumentation Utility tests */
import { afterEach, describe, expect, it, mock } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  FILE_PATTERNS,
  detectNamingPreferences,
  generateSmartFilename,
  resolveSmartNaming,
  validateNaming,
} from "@/utils/util/core/smart-naming.js";

const mkTmp = () => fs.mkdtemp(path.join(os.tmpdir(), "smart-name-"));

describe("smart naming", () => {
  afterEach(() => {
    mock.restore();
  });

  it("sanitizes base names and honors input files", () => {
    const name = generateSmartFilename("surface", { baseName: "My App!" });
    expect(name).toBe("my-app-surface.json");

    // input "requirements" should not leak the generic base name
    const derived = generateSmartFilename("assembly", { inputFile: "requirements.txt" });
    expect(derived).toMatch(/\.assembly\.cue$/);
    expect(derived.startsWith("requirements")).toBe(false);
  });

  it("detects existing naming preferences from files", async () => {
    const dir = await mkTmp();
    await fs.writeFile(path.join(dir, "demo.assembly.cue"), "", "utf-8");
    await fs.writeFile(path.join(dir, "demo-surface.json"), "", "utf-8");

    const prefs = await detectNamingPreferences(dir);
    expect(prefs.usesProjectNames).toBe(true);
    expect(prefs.existingPatterns.length).toBeGreaterThanOrEqual(2);
  });

  it("validates conflicts and suggests alternates", async () => {
    const dir = await mkTmp();
    const ctxFile = path.join(dir, FILE_PATTERNS.surface.default);
    await fs.writeFile(ctxFile, "{}", "utf-8"); // existing generic file

    const result = await validateNaming("surface", { outputDir: dir });
    expect(result.isValid).toBe(false);
    expect(result.conflicts[0]).toContain("File already exists");
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("resolves smart naming with context detection", async () => {
    const dir = await mkTmp();
    await fs.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "cool-app" }),
      "utf-8",
    );

    const res = await resolveSmartNaming("docs", { outputDir: dir, useGenericNames: false });
    expect(res.filename).toBe("cool-app-docs.md");
    expect(res.fullPath.endsWith("cool-app-docs.md")).toBe(true);
    expect(res.context.name).toBe("cool-app");
  });
});
