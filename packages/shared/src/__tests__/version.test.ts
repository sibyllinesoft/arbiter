import { describe, expect, it } from "bun:test";
import {
  CURRENT_VERSIONS,
  checkCompatibility,
  executeMigration,
  getRuntimeVersionInfo,
  validateVersionSet,
} from "../version";

describe("version helpers", () => {
  it("validates version sets", () => {
    expect(validateVersionSet({ arbiter: "1.0.0", cue: "0.6.0" })).toBe(true);
    expect(validateVersionSet({ arbiter: "1.0.0" } as any)).toBe(false);
  });

  it("detects incompatible arbiter major version", async () => {
    const result = await checkCompatibility({ arbiter: "0.5.0", cue: "0.6.0" });
    expect(result.compatible).toBe(false);
    expect(result.issues.some((i) => i.component === "arbiter")).toBe(true);
  });

  it("allows compatibility with allowCompat when only warnings remain", async () => {
    const result = await checkCompatibility(
      { arbiter: CURRENT_VERSIONS.arbiter, cue: "1.2.0" },
      true,
    );
    expect(result.compatible).toBe(true);
  });

  it("simulates migrations and warns on no-op", async () => {
    const noop = await executeMigration("arbiter", "1.0.0", "1.0.0");
    expect(noop.success).toBe(true);
    expect(noop.warnings.length).toBeGreaterThan(0);

    const migrate = await executeMigration("arbiter", "0.9.0", "1.0.0");
    expect(migrate.success).toBe(true);
    expect(migrate.operations_performed.length).toBeGreaterThan(0);
  });

  it("reports runtime version info", () => {
    const info = getRuntimeVersionInfo();
    expect(info.versions.arbiter).toBe(CURRENT_VERSIONS.arbiter);
    expect(info.build_info.timestamp).toBeDefined();
  });
});
