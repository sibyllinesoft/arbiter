import { describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import { requireCommandConfig } from "@/cli/context.js";
import { createGenerationCommands } from "@/cli/generation.js";
import * as configSvc from "@/config.js";
import * as docsSvc from "@/services/docs/index.js";
import * as examplesSvc from "@/services/examples/index.js";
import * as executeSvc from "@/services/execute/index.js";
import * as explainSvc from "@/services/explain/index.js";
import * as generateSvc from "@/services/generate/index.js";
import * as renameSvc from "@/services/rename/index.js";

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

  it("routes docs subcommands", async () => {
    const docsSpy = spyOn(docsSvc, "docsCommand").mockResolvedValue(0 as any);
    const docsGenSpy = spyOn(docsSvc, "docsGenerateCommand").mockResolvedValue(0 as any);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["docs", "schema", "--format", "html"], { from: "user" });
    await program.parseAsync(["docs", "cli", "--formats", "json"], { from: "user" });

    expect(docsSpy).toHaveBeenCalledWith("schema", expect.anything(), baseConfig);
    expect(docsGenSpy).toHaveBeenCalledWith(
      expect.objectContaining({ formats: "json" }),
      baseConfig,
    );

    docsSpy.mockRestore();
    docsGenSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("runs examples, execute, explain, and rename", async () => {
    const examplesSpy = spyOn(examplesSvc, "examplesCommand").mockResolvedValue(0 as any);
    const executeSpy = spyOn(executeSvc, "executeCommand").mockResolvedValue(0 as any);
    const explainSpy = spyOn(explainSvc, "explainCommand").mockResolvedValue(0 as any);
    const renameSpy = spyOn(renameSvc, "renameCommand").mockResolvedValue(0 as any);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["examples", "profile", "--language", "typescript"], { from: "user" });
    await program.parseAsync(["execute", "epic-1", "--dry-run"], { from: "user" });
    await program.parseAsync(["explain", "--format", "text"], { from: "user" });
    await program.parseAsync(["rename", "--pattern", "*.ts", "--dry-run"], { from: "user" });

    expect(examplesSpy).toHaveBeenCalled();
    expect(executeSpy).toHaveBeenCalledWith({ epic: "epic-1" });
    expect(explainSpy).toHaveBeenCalledWith(
      expect.objectContaining({ format: "text" }),
      baseConfig,
    );
    expect(renameSpy).toHaveBeenCalledWith(
      expect.objectContaining({ pattern: "*.ts", dryRun: true }),
      baseConfig,
    );

    examplesSpy.mockRestore();
    executeSpy.mockRestore();
    explainSpy.mockRestore();
    renameSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("shows naming help without requiring config", async () => {
    const helpSpy = spyOn(renameSvc, "showNamingHelp").mockImplementation(() => {});
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["rename", "--help-naming"], { from: "user" });

    expect(helpSpy).toHaveBeenCalled();

    helpSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
