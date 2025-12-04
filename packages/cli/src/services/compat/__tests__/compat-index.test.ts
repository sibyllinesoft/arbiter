import { describe, expect, it, spyOn } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";

import { LATEST_API_VERSION } from "@/constraints/schema.js";
import {
  CompatCheckOptionsSchema,
  __compatTesting,
  evaluateApiVersion,
  loadVersionsToCheck,
} from "@/services/compat/index.js";

describe("compat command helpers", () => {
  it("normalizes version payload when api_version missing", () => {
    const payload = __compatTesting.normalizeVersionPayload({ schema_version: "1.0.0" });
    expect(payload.api_version).toBe(LATEST_API_VERSION);
  });

  it("loadVersionsToCheck reads from file and validates shape", async () => {
    const tmpPath = path.join(import.meta.dir, "versions.json");
    await fs.writeFile(tmpPath, JSON.stringify({ versions: { api_version: "0.1.0" } }));
    const versions = await loadVersionsToCheck(tmpPath);
    expect(versions.api_version).toBe("0.1.0");
    await fs.unlink(tmpPath);
  });

  it("loadVersionsToCheck parses direct JSON string and throws on bad input", async () => {
    const versions = await loadVersionsToCheck('{"api_version":"0.2.0"}');
    expect(versions.api_version).toBe("0.2.0");
    await expect(loadVersionsToCheck("not-json")).rejects.toThrow();
  });

  it("evaluateApiVersion returns warning/error states", () => {
    const supported = evaluateApiVersion(LATEST_API_VERSION);
    expect(supported).toBeUndefined();

    const unknown = evaluateApiVersion("0.0.0");
    expect(unknown?.severity).toBe("error");
  });

  it("augmentWithApiVersionCheck injects issues and mismatches", () => {
    const versions = { api_version: "0.0.0" };
    const result: any = {
      compatible: true,
      version_mismatches: [],
      issues: [],
      migration_required: false,
      migration_path: undefined,
      timestamp: "",
    };
    __compatTesting.augmentWithApiVersionCheck(versions as any, result, false);
    expect(result.compatible).toBe(false);
    expect(result.version_mismatches.length).toBe(1);
  });

  it("outputs compatibility in text/json/table formats", async () => {
    const result: any = {
      compatible: false,
      version_mismatches: [
        { component: "api_version", expected: "1", actual: "0", severity: "error" },
      ],
      issues: [],
      migration_required: false,
      migration_path: undefined,
      timestamp: new Date().toISOString(),
    };

    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    await __compatTesting.outputCompatibilityResult(result, {
      format: "json",
      allowCompat: false,
      showMigrations: false,
      verbose: false,
    } as any);
    await __compatTesting.outputCompatibilityResult(result, {
      format: "table",
      allowCompat: false,
      showMigrations: false,
      verbose: false,
    } as any);
    logSpy.mockRestore();
  });

  it("validates command option schemas", () => {
    const parsed = CompatCheckOptionsSchema.parse({});
    expect(parsed.format).toBe("text");
  });
});
