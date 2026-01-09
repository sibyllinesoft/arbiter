import os from "node:os";
import path from "node:path";
import { __generateTesting } from "@/services/generate/io/index.js";
import fs from "fs-extra";
import { afterEach, describe, expect, it } from "vitest";

describe("generate discovery helpers", () => {
  const originalCwd = process.cwd();
  let tempDir: string;

  afterEach(async () => {
    process.chdir(originalCwd);
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  it("resolves assembly path based on explicit spec or discovery", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-gen-discovery-"));
    process.chdir(tempDir);

    // explicit spec
    const explicit = __generateTesting.resolveAssemblyPath("orders", { spec: undefined } as any);
    expect(explicit).toBe(path.join(".arbiter", "orders", "assembly.cue"));

    // single discovered spec
    await fs.ensureDir(path.join(tempDir, ".arbiter", "default"));
    const absoluteAssemblyPath = path.join(tempDir, ".arbiter", "default", "assembly.cue");
    await fs.writeFile(absoluteAssemblyPath, "product: { name: 'App' }");
    const discovered = __generateTesting.resolveAssemblyPath(undefined, { spec: undefined } as any);
    // discoverSpecs returns relative paths
    expect(discovered).toBe(path.join(".arbiter", "default", "assembly.cue"));

    // ambiguous discovery returns null
    await fs.ensureDir(path.join(tempDir, ".arbiter", "second"));
    await fs.writeFile(path.join(tempDir, ".arbiter", "second", "assembly.cue"), "#");
    const ambiguous = __generateTesting.resolveAssemblyPath(undefined, { spec: undefined } as any);
    expect(ambiguous).toBeNull();
  });

  it("discovers specs and aborts on warnings when force not supplied", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-gen-warn-"));
    process.chdir(tempDir);
    await fs.ensureDir(path.join(tempDir, ".arbiter", "one"));
    await fs.writeFile(path.join(tempDir, ".arbiter", "one", "assembly.cue"), "// cue");

    const specs = __generateTesting.discoverSpecs();
    expect(specs).toHaveLength(1);
    expect(specs[0].name).toBe("one");

    const abort = __generateTesting.shouldAbortOnWarnings({ hasWarnings: true }, {
      force: false,
    } as any);
    const proceed = __generateTesting.shouldAbortOnWarnings({ hasWarnings: false }, {
      force: false,
    } as any);
    const forced = __generateTesting.shouldAbortOnWarnings({ hasWarnings: true }, {
      force: true,
    } as any);

    expect(abort).toBe(true);
    expect(proceed).toBe(false);
    expect(forced).toBe(false);
    expect(__generateTesting.shouldSyncGithub({ githubDryRun: true } as any)).toBe(true);
  });
});
