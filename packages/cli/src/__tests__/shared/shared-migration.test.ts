import { describe, expect, it } from "bun:test";

import {
  estimateMigrationDuration,
  getAvailableMigrationPaths,
  hasMigrationPath,
} from "@arbiter/specification";

describe("migration helpers", () => {
  it("returns default migration paths for known components", () => {
    expect(getAvailableMigrationPaths("arbiter")).toContain("v0.9.0 -> v1.0.0");
    expect(getAvailableMigrationPaths("unknown")[0]).toContain("unknown: v1.0.0 -> v2.0.0");
  });

  it("detects forward-compatible migration paths and rejects backwards moves", () => {
    expect(hasMigrationPath("arbiter", "v1.0.0", "v2.0.0")).toBe(true);
    expect(hasMigrationPath("arbiter", "v2.0.0", "v1.0.0")).toBe(false);
  });

  it("estimates migration duration based on version distance and component", () => {
    const minor = estimateMigrationDuration("node", "v20.0.0", "v20.1.0");
    const major = estimateMigrationDuration("node", "v18.0.0", "v20.0.0");
    const arbiter = estimateMigrationDuration("arbiter", "v0.9.0", "v1.0.0");

    expect(major).toBeGreaterThan(minor);
    expect(arbiter).toBeGreaterThan(major); // arbiter migrations are intentionally heavier
    expect(minor).toBeGreaterThanOrEqual(10000);
  });
});
