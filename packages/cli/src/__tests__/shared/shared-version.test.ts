import { describe, expect, it } from "bun:test";

import {
  CURRENT_VERSIONS,
  checkCompatibility,
  executeMigration,
  getRuntimeVersionInfo,
  validateVersionSet,
} from "@arbiter/specification";

describe("shared version helpers", () => {
  it("treats matching versions as compatible", async () => {
    const result = await checkCompatibility({
      arbiter: CURRENT_VERSIONS.arbiter,
      cue: CURRENT_VERSIONS.cue,
    });

    expect(result.compatible).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it("flags older arbiter versions and requests migration", async () => {
    const result = await checkCompatibility({ arbiter: "0.5.0", cue: CURRENT_VERSIONS.cue });

    expect(result.compatible).toBe(false);
    expect(result.migration_required).toBe(true);
    expect(result.version_mismatches?.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("runs migrations safely when versions are identical", async () => {
    const migration = await executeMigration("arbiter", "1.0.0", "1.0.0");

    expect(migration.success).toBe(true);
    expect(migration.operations_performed).toHaveLength(0);
    expect(migration.warnings.some((w) => w.includes("no migration needed"))).toBe(true);
  });

  it("validates required version fields and reports runtime info", () => {
    expect(validateVersionSet({ arbiter: "1.0.0", cue: "0.6.0" })).toBe(true);
    expect(validateVersionSet({ arbiter: "1.0.0" } as any)).toBe(false);

    const runtime = getRuntimeVersionInfo();
    expect(runtime.versions.arbiter).toBe(CURRENT_VERSIONS.arbiter);
    expect(runtime.compatibility.migration_support).toBe(true);
  });
});
