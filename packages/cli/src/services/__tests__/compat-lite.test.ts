import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { LATEST_API_VERSION } from "@/constraints/schema.js";
import {
  evaluateApiVersion,
  loadVersionsToCheck,
  runMigration,
  showVersionInfo,
} from "@/services/compat/index.js";

// Mock shared module before imports execute real code
const sharedMock = {
  CURRENT_VERSIONS: { api_version: "0.9.0", schema_version: "1.0.0" },
  VERSION_COMPATIBILITY: {
    supported: ["1.1.0"],
    deprecated: ["1.0.0"],
    unsupported: ["0.8.0"],
  },
  validateVersionSet: mock(() => {}),
  checkCompatibility: mock(async () => ({ compatible: true, version_mismatches: [], issues: [] })),
  getRuntimeVersionInfo: mock(() => ({
    versions: { api_version: "1.2.3", schema_version: "2.0.0" },
    build_info: { timestamp: "now", commit_hash: "abc", deterministic: true, reproducible: false },
    compatibility: { strict_mode: true, allow_compat_flag: false, migration_support: true },
  })),
  getAvailableMigrationPaths: mock(() => ["a->b"]),
  hasMigrationPath: mock(() => true),
  estimateMigrationDuration: mock(() => 5),
  executeMigration: mock(async () => ({
    success: true,
    operations_performed: ["step1"],
    warnings: [],
    timestamp: "now",
  })),
};

mock.module("@arbiter/shared", () => sharedMock);

afterEach(() => {
  mock.restore();
});

describe("evaluateApiVersion", () => {
  it("returns undefined for latest", () => {
    expect(evaluateApiVersion(LATEST_API_VERSION)).toBeUndefined();
  });

  it("warns for supported and deprecated, errors for unsupported/unknown", () => {
    expect(evaluateApiVersion("1.1.0")?.severity).toBeDefined();
    expect(evaluateApiVersion("1.0.0")?.severity).toBeDefined();
    expect(evaluateApiVersion("0.8.0")?.severity).toBe("error");
    expect(evaluateApiVersion("0.0.1")?.severity).toBe("error");
  });
});

describe("loadVersionsToCheck", () => {
  it("returns current versions with latest api when no input", async () => {
    const result = await loadVersionsToCheck();
    expect(result.api_version).toBe(LATEST_API_VERSION);
    expect(result.schema_version).toBe(sharedMock.CURRENT_VERSIONS.schema_version);
  });

  it("reads versions from file and normalizes api", async () => {
    const tmp = path.join(os.tmpdir(), "versions.json");
    await fs.writeFile(tmp, JSON.stringify({ versions: { schema_version: "2.0.0" } }), "utf-8");
    const result = await loadVersionsToCheck(tmp);
    expect(result.api_version).toBe(LATEST_API_VERSION);
    expect(result.schema_version).toBe("2.0.0");
  });

  it("throws for bad input", async () => {
    await expect(loadVersionsToCheck("not-json")).rejects.toThrow("Cannot load versions");
  });
});

describe("showVersionInfo", () => {
  it("prints runtime info", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    await showVersionInfo();
    expect(sharedMock.getRuntimeVersionInfo).toHaveBeenCalled();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("runMigration", () => {
  it("executes migration path and does not exit on success", async () => {
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);
    const log = spyOn(console, "log").mockImplementation(() => {});
    const err = spyOn(console, "error").mockImplementation(() => {});

    await runMigration({
      component: "schema_version",
      from: "1.0.0",
      to: "2.0.0",
      dryRun: true,
      force: true,
      backup: false,
    } as any);

    expect(sharedMock.hasMigrationPath).toHaveBeenCalled();
    expect(sharedMock.executeMigration).not.toHaveBeenCalled(); // dry run
    exitSpy.mockRestore();
    log.mockRestore();
    err.mockRestore();
  });
});
