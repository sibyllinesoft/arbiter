/** @packageDocumentation CLI command tests */
import { afterEach, describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import { createUtilitiesCommands } from "@/cli/commands/utilities.js";
import { __contextTesting } from "@/cli/context.js";
import * as specImportSvc from "@/services/spec-import/index.js";

afterEach(() => {
  __contextTesting.setActiveConfig(null);
});

const baseConfig = {
  apiUrl: "https://api",
  timeout: 1,
  format: "json",
  color: false,
  localMode: false,
  projectDir: process.cwd(),
  projectStructure: {
    clientsDirectory: "clients",
    servicesDirectory: "services",
    packagesDirectory: "packages",
    toolsDirectory: "tools",
    docsDirectory: "docs",
    testsDirectory: "tests",
    infraDirectory: "infra",
  },
} as any;

function buildProgram(): Command {
  const program = new Command("arbiter");
  (program as any).config = baseConfig;
  __contextTesting.setActiveConfig(baseConfig as any);
  createUtilitiesCommands(program);
  return program;
}

describe("utilities CLI", () => {
  it("imports spec file with options", async () => {
    const importSpy = spyOn(specImportSvc, "importSpec").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(
      ["import", "myspec.cue", "--project", "my-project", "--message", "Initial import"],
      { from: "user" },
    );

    expect(importSpy).toHaveBeenCalledWith(
      "myspec.cue",
      expect.objectContaining({ project: "my-project", message: "Initial import" }),
      baseConfig,
    );

    importSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("imports default spec file when no file specified", async () => {
    const importSpy = spyOn(specImportSvc, "importSpec").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["import", "--skip-validate"], { from: "user" });

    expect(importSpy).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ skipValidate: true }),
      baseConfig,
    );

    importSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
