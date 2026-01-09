/** @packageDocumentation CLI command tests */
import { describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import { createGenerationCommands } from "@/cli/commands/generation.js";
import * as configSvc from "@/io/config/config.js";
import * as explainSvc from "@/services/explain/index.js";
import * as generateSvc from "@/services/generate/io/index.js";

// Minimal config to satisfy command lookups
const baseConfig: any = {
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
};

function buildProgram(): Command {
  const program = new Command("arbiter");
  (program as any).config = baseConfig;
  createGenerationCommands(program);
  return program;
}

describe("generation CLI", () => {
  it("invokes generate with git-detected config", async () => {
    const cfgSpy = spyOn(configSvc, "loadConfigWithGitDetection").mockResolvedValue(baseConfig);
    const genSpy = spyOn(generateSvc, "generateCommand").mockResolvedValue(0 as any);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["generate", "demo", "--force", "--dry-run"], { from: "user" });

    expect(cfgSpy).toHaveBeenCalled();
    expect(genSpy).toHaveBeenCalledWith(
      expect.objectContaining({ force: true, dryRun: true }),
      baseConfig,
      "demo",
    );

    cfgSpy.mockRestore();
    genSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("runs explain command", async () => {
    const explainSpy = spyOn(explainSvc, "explainCommand").mockResolvedValue(0 as any);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["explain", "--format", "text"], { from: "user" });

    expect(explainSpy).toHaveBeenCalledWith(
      expect.objectContaining({ format: "text" }),
      baseConfig,
    );

    explainSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
