import { describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import { createUtilitiesCommands } from "@/cli/utilities.js";
import * as importSvc from "@/services/import/index.js";
import * as testsSvc from "@/services/tests/index.js";

const baseConfig = {
  apiUrl: "https://api",
  timeout: 1,
  format: "json",
  color: false,
  localMode: true,
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
  createUtilitiesCommands(program);
  return program;
}

describe("utilities CLI", () => {
  it("validates imports with registry options", async () => {
    const importSpy = spyOn(importSvc, "importCommand").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["import", "validate", "file1.cue", "file2.cue", "--global"], {
      from: "user",
    });

    expect(importSpy).toHaveBeenCalledWith(
      "validate",
      undefined,
      expect.objectContaining({ files: ["file1.cue", "file2.cue"], global: true }),
    );

    importSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("scaffolds tests with options", async () => {
    const scaffoldSpy = spyOn(testsSvc, "scaffoldCommand").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(
      [
        "tests",
        "scaffold",
        "--output",
        "custom",
        "--format",
        "vitest",
        "--include-integration",
        "--include-e2e",
      ],
      { from: "user" },
    );

    expect(scaffoldSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        output: "custom",
        format: "vitest",
        includeIntegration: true,
        includeE2e: true,
      }),
      baseConfig,
    );

    scaffoldSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("runs coverage with numeric thresholds", async () => {
    const coverSpy = spyOn(testsSvc, "coverCommand").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(
      ["tests", "cover", "--threshold", "90", "--format", "json", "--include-branches"],
      {
        from: "user",
      },
    );

    expect(coverSpy).toHaveBeenCalledWith(
      expect.objectContaining({ threshold: 90, format: "json", includeBranches: true }),
      baseConfig,
    );

    coverSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
