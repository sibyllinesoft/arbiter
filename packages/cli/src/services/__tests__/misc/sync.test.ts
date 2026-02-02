/** @packageDocumentation Service tests */
import { afterEach, describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import { syncProject } from "@/services/sync/index.js";
import type { CLIConfig, SyncOptions } from "@/types.js";
import fs from "fs-extra";

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((fn) => fn()));
});

function baseConfig(projectDir: string): CLIConfig {
  return {
    apiUrl: "http://localhost:5050",
    timeout: 5_000,
    format: "json",
    color: true,
    localMode: false,
    projectDir,
    projectStructure: {
      clientsDirectory: "apps",
      servicesDirectory: "services",
      packagesDirectory: "packages",
      toolsDirectory: "tools",
      docsDirectory: "docs",
      testsDirectory: "tests",
      infraDirectory: "infra",
    },
  };
}

describe("syncProject service", () => {
  it("updates package.json manifests for TypeScript projects", async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-sync-"));
    cleanup.push(() => fs.remove(projectDir));

    const pkgPath = path.join(projectDir, "package.json");
    await fs.writeJSON(pkgPath, { name: "demo-app", version: "0.0.1" }, { spaces: 2 });

    const cwd = process.cwd();
    process.chdir(projectDir);
    cleanup.push(async () => {
      process.chdir(cwd);
    });

    const exitCode = await syncProject(
      { language: "typescript", force: true } as SyncOptions,
      baseConfig(projectDir),
    );

    expect(exitCode).toBe(0);
    const updatedPkg = await fs.readJSON(pkgPath);
    // Check for scripts that are actually added by getArbiterPackageUpdates
    expect(updatedPkg.scripts["arbiter:status"]).toBe("arbiter status");
    expect(updatedPkg.arbiter?.coverage?.threshold).toBe(0.8);
  });
});
