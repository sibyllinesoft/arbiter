import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock shared module to keep execution side-effect free
vi.mock("@arbiter/shared", () => {
  return {
    CURRENT_VERSIONS: {
      api_version: "1",
      schema_version: "1.0",
      contract_version: "1.0",
      ticket_format: "v1",
    },
    checkCompatibility: vi.fn(async () => ({
      compatible: false,
      version_mismatches: [
        { component: "api_version", expected: "1", actual: "0", severity: "error" },
      ],
      issues: [],
      migration_required: false,
    })),
    estimateMigrationDuration: vi.fn(() => 42),
    executeMigration: vi.fn(async () => ({
      success: true,
      operations_performed: ["op1"],
      warnings: [],
      timestamp: "now",
    })),
    getAvailableMigrationPaths: vi.fn(() => ["1->2"]),
    getRuntimeVersionInfo: vi.fn(() => ({
      versions: { api_version: "1" },
      build_info: { timestamp: "now", commit_hash: "abc", deterministic: true, reproducible: true },
      compatibility: { strict_mode: true, allow_compat_flag: false, migration_support: true },
    })),
    hasMigrationPath: vi.fn(() => true),
    validateVersionSet: vi.fn(() => true),
  };
});

import { __compatTesting, runMigration } from "../index.js";

const { loadVersionsToCheck, outputCompatibilityResult, showMigrationPaths } = __compatTesting;

let exitSpy: ReturnType<typeof vi.spyOn>;
let consoleLogSpy: ReturnType<typeof vi.spyOn>;
let consoleTableSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    (process as any).__lastExitCode = code;
    return undefined as never;
  }) as never);
  consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  consoleTableSpy = vi.spyOn(console, "table").mockImplementation(() => undefined as any);
});

afterEach(() => {
  exitSpy.mockRestore();
  consoleLogSpy.mockRestore();
  consoleTableSpy.mockRestore();
});

describe("compat additional coverage", () => {
  it("loads versions from file path and validates structure", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "compat-"));
    const filePath = path.join(tmp, "versions.json");
    await fs.writeJSON(filePath, {
      versions: {
        api_version: "0",
        schema_version: "1.0",
        contract_version: "1.0",
        ticket_format: "v1",
      },
    });

    const result = await loadVersionsToCheck(filePath);
    expect(result.api_version).toBe("0");
  });

  it("outputs compatibility table format when requested", async () => {
    await outputCompatibilityResult(
      {
        compatible: false,
        version_mismatches: [
          { component: "api_version", expected: "1", actual: "0", severity: "error" },
        ],
        issues: [],
        migration_required: false,
      } as any,
      { format: "table", allowCompat: false, showMigrations: false, verbose: false },
    );

    expect(consoleTableSpy).toHaveBeenCalled();
  });

  it("shows migration paths when mismatches exist", async () => {
    await showMigrationPaths(
      { schema_version: "0.9", contract_version: "0.8" } as any,
      {
        format: "text",
        allowCompat: false,
        showMigrations: true,
        verbose: false,
      } as any,
    );

    expect(consoleLogSpy).toHaveBeenCalled();
  });

  it("runs migration in dry-run mode without performing operations", async () => {
    await runMigration({
      component: "api_version",
      from: "1",
      to: "2",
      dryRun: true,
      force: false,
      backup: true,
    } as any);

    expect(exitSpy).toHaveBeenCalledWith(0);
  });
});
