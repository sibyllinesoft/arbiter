import { describe, expect, it } from "bun:test";
import {
  estimateMigrationDuration,
  getAvailableMigrationPaths,
  hasMigrationPath,
} from "../migration";

describe("migration utilities", () => {
  it("returns predefined paths for known components and generic for unknown", () => {
    expect(getAvailableMigrationPaths("arbiter")).toContain("v0.9.0 -> v1.0.0");
    expect(getAvailableMigrationPaths("unknown-component")).toEqual([
      "unknown-component: v1.0.0 -> v2.0.0",
    ]);
  });

  it("detects direct and semantic migration paths", () => {
    expect(hasMigrationPath("cue", "v0.5.0", "v0.6.0")).toBe(true); // direct
    expect(hasMigrationPath("arbiter", "v1.0.0", "v2.0.0")).toBe(true); // forward major
    expect(hasMigrationPath("node", "v20.0.0", "v18.0.0")).toBe(false); // backward not allowed
  });

  it("estimates duration with component weighting and version deltas", () => {
    // Arbiter major upgrade should be longer than base 10s and capped below 10 minutes
    const estimate = estimateMigrationDuration("arbiter", "v1.0.0", "v3.0.0");
    expect(estimate).toBeGreaterThan(10000);
    expect(estimate).toBeLessThanOrEqual(600000);
  });
});
