/** @packageDocumentation Service tests */
import { afterEach, describe, expect, it, mock } from "bun:test";
import os from "node:os";
import path from "node:path";
import { safeFileOperation } from "@/constraints/index.js";
import { type SpecImportDependencies, importSpec } from "@/services/spec-import/index.js";
import type { CLIConfig } from "@/types.js";
import fs from "fs-extra";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.remove(dir)));
});

function createConfig(projectDir: string): CLIConfig {
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

describe("importSpec service", () => {
  it("uploads a validated spec fragment", async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-spec-"));
    tempDirs.push(projectDir);

    const specPath = path.join(projectDir, "assembly.cue");
    await safeFileOperation("write", specPath, async (validatedPath) => {
      await fs.writeFile(validatedPath, "spec: {}\n", "utf-8");
    });

    const updateMock = mock(async () => ({ success: true }));
    const ensureMock = mock(async () => "proj_123");

    const deps: SpecImportDependencies = {
      createApiClient: () =>
        ({
          updateFragment: updateMock,
        }) as any,
      validateCue: async () => ({ valid: true, errors: [] }),
      ensureProjectExists: ensureMock,
    };

    const exitCode = await importSpec(
      "assembly.cue",
      { project: "proj_123", author: "cli", message: "add spec" },
      createConfig(projectDir),
      deps,
    );

    expect(exitCode).toBe(0);
    expect(updateMock).toHaveBeenCalledTimes(1);
    const call = updateMock.mock.calls[0];
    expect(call[0]).toBe("proj_123");
    expect(call[1]).toBe("assembly.cue");
    expect(call[2]).toContain("spec");
    expect(ensureMock).toHaveBeenCalledTimes(1);
  });

  it("halts when validation fails", async () => {
    const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-spec-"));
    tempDirs.push(projectDir);
    const specPath = path.join(projectDir, "invalid.cue");
    await safeFileOperation("write", specPath, async (validatedPath) => {
      await fs.writeFile(validatedPath, "bad spec", "utf-8");
    });

    const updateMock = mock(async () => ({ success: true }));
    const deps: SpecImportDependencies = {
      createApiClient: () =>
        ({
          updateFragment: updateMock,
        }) as any,
      validateCue: async () => ({
        valid: false,
        errors: ["missing field"],
      }),
      ensureProjectExists: async () => "proj_123",
    };

    const exitCode = await importSpec("invalid.cue", {}, createConfig(projectDir), deps);

    expect(exitCode).toBe(1);
    expect(updateMock).not.toHaveBeenCalled();
  });
});
