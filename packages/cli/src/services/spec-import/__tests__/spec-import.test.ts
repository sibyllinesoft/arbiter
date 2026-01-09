import { describe, expect, it, spyOn } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

import { DEFAULT_PROJECT_STRUCTURE } from "@/io/config/config.js";
import { importSpec } from "@/services/spec-import/index.js";
import { determineRemotePath } from "@/services/spec-import/index.js";
import type { CLIConfig } from "@/types.js";

function makeConfig(dir: string, overrides: Partial<CLIConfig> = {}): CLIConfig {
  return {
    apiUrl: "http://localhost:5050",
    timeout: 1_000,
    format: "json",
    color: false,
    localMode: false,
    projectDir: dir,
    projectStructure: { ...DEFAULT_PROJECT_STRUCTURE },
    ...overrides,
  } as CLIConfig;
}

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "arbiter-spec-import-"));
}

describe("importSpec", () => {
  it("fails fast in local mode", async () => {
    const code = await importSpec(undefined, {}, makeConfig(process.cwd(), { localMode: true }), {
      createApiClient: () => ({}) as any,
      validateCue: async () => ({ valid: true, errors: [], warnings: [] }),
      ensureProjectExists: async () => "proj",
    });

    expect(code).toBe(1);
  });

  it("returns error when file is missing", async () => {
    const err = spyOn(console, "error").mockImplementation(() => {});
    const code = await importSpec("missing.cue", {}, makeConfig(process.cwd()), {
      createApiClient: () => ({}) as any,
      validateCue: async () => ({ valid: true, errors: [], warnings: [] }),
      ensureProjectExists: async () => "proj",
    });
    expect(code).toBe(1);
    err.mockRestore();
  });

  it("rejects when validation fails", async () => {
    const dir = createTempDir();
    const specPath = path.join(dir, "spec.cue");
    await fs.writeFile(specPath, "package demo", "utf-8");

    const err = spyOn(console, "error").mockImplementation(() => {});

    const code = await importSpec(specPath, {}, makeConfig(dir), {
      createApiClient: () => ({}) as any,
      validateCue: async () => ({ valid: false, errors: ["bad"], warnings: [] }),
      ensureProjectExists: async () => "proj",
    });

    expect(code).toBe(1);
    err.mockRestore();
    await fs.remove(dir);
  });

  it("imports successfully and derives remote path from project root", async () => {
    const dir = createTempDir();
    const specPath = path.join(dir, ".arbiter", "assembly.cue");
    await fs.ensureDir(path.dirname(specPath));
    await fs.writeFile(specPath, "package demo", "utf-8");

    const client = {
      updateFragment: async (_projectId: string, remotePath: string, content: string) => ({
        success: true,
        exitCode: 0,
        error: undefined,
        remotePath,
        content,
      }),
    } as any;

    const ensureProjectExists = async () => "proj-123";
    const validateCue = async () => ({ valid: true, errors: [], warnings: [] });

    const log = spyOn(console, "log").mockImplementation(() => {});
    const code = await importSpec(undefined, {}, makeConfig(dir), {
      createApiClient: () => client,
      validateCue,
      ensureProjectExists,
    });

    expect(code).toBe(0);
    log.mockRestore();
    await fs.remove(dir);
  });

  it("normalizes remote paths and honors overrides", () => {
    const remoteRelative = determineRemotePath("/root", "/root/.arbiter/assembly.cue");
    expect(remoteRelative).toBe(".arbiter/assembly.cue".replace(/^\.\/+/, ""));

    // Override is used as-is (only normalizes backslashes and strips leading ./)
    const remoteOverride = determineRemotePath(
      "/root",
      "/elsewhere/spec.cue",
      "custom/path/spec.cue",
    );
    expect(remoteOverride).toBe("custom/path/spec.cue");

    // Leading ./ is stripped from override
    const remoteOverrideWithDot = determineRemotePath(
      "/root",
      "/elsewhere/spec.cue",
      "./foo/bar.cue",
    );
    expect(remoteOverrideWithDot).toBe("foo/bar.cue");

    const remoteFallback = determineRemotePath("/root", "/other/spec.cue");
    expect(remoteFallback).toBe("spec.cue");
  });

  it("skips validation when skipValidate is set", async () => {
    const dir = createTempDir();
    const specPath = path.join(dir, "spec.cue");
    await fs.writeFile(specPath, "package demo", "utf-8");

    const validateCue = async () => {
      throw new Error("should not run");
    };

    const client = {
      updateFragment: async () => ({ success: true, exitCode: 0 }),
    } as any;

    const code = await importSpec(specPath, { skipValidate: true }, makeConfig(dir), {
      createApiClient: () => client,
      validateCue,
      ensureProjectExists: async () => "proj",
    });

    expect(code).toBe(0);
    await fs.remove(dir);
  });

  it("propagates remote API errors", async () => {
    const dir = createTempDir();
    const specPath = path.join(dir, "spec.cue");
    await fs.writeFile(specPath, "package demo", "utf-8");

    const client = {
      updateFragment: async () => ({ success: false, error: "boom", exitCode: 7 }),
    } as any;

    const code = await importSpec(specPath, {}, makeConfig(dir), {
      createApiClient: () => client,
      validateCue: async () => ({ valid: true, errors: [], warnings: [] }),
      ensureProjectExists: async () => "proj",
    });

    expect(code).toBe(7);
    await fs.remove(dir);
  });
});
