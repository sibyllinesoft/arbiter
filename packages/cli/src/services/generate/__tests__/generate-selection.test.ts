import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import os from "node:os";
import path from "node:path";
import { __generateTesting } from "@/services/generate/io/index.js";
import fs from "fs-extra";

const { resolveAssemblyPath, shouldAbortOnWarnings, shouldSyncGithub } = __generateTesting;

let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
});

afterEach(async () => {
  process.chdir(originalCwd);
});

describe("generate selection helpers", () => {
  it("resolves single spec automatically and null when ambiguous", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-select-"));
    process.chdir(tmp);
    // single spec
    await fs.ensureDir(path.join(tmp, ".arbiter", "one"));
    await fs.writeFile(
      path.join(tmp, ".arbiter", "one", "assembly.cue"),
      'product: { name: "one" }\n',
    );
    expect(resolveAssemblyPath(undefined, {} as any)).toBe(
      path.join(".arbiter", "one", "assembly.cue"),
    );

    // ambiguous
    await fs.ensureDir(path.join(tmp, ".arbiter", "two"));
    await fs.writeFile(
      path.join(tmp, ".arbiter", "two", "assembly.cue"),
      'product: { name: "two" }\n',
    );
    expect(resolveAssemblyPath(undefined, {} as any)).toBeNull();
  });

  it("prefers named spec when provided", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-select-2-"));
    process.chdir(tmp);
    await fs.ensureDir(path.join(tmp, ".arbiter", "chosen"));
    await fs.writeFile(
      path.join(tmp, ".arbiter", "chosen", "assembly.cue"),
      'product: { name: "chosen" }\n',
    );
    expect(resolveAssemblyPath("chosen", {} as any)).toContain("chosen/assembly.cue");
  });

  it("aborts on warnings when force not set", () => {
    expect(shouldAbortOnWarnings({ hasWarnings: true }, { force: false } as any)).toBe(true);
    expect(shouldAbortOnWarnings({ hasWarnings: true }, { force: true } as any)).toBe(false);
    expect(shouldAbortOnWarnings({ hasWarnings: false }, { force: false } as any)).toBe(false);
  });

  it("gates github sync", () => {
    expect(shouldSyncGithub({} as any)).toBe(false);
    expect(shouldSyncGithub({ syncGithub: true } as any)).toBe(true);
    expect(shouldSyncGithub({ githubDryRun: true } as any)).toBe(true);
  });
});
