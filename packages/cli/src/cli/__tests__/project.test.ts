/** @packageDocumentation CLI command tests */
import { describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import { createProjectCommands } from "@/cli/commands/project.js";
import * as diff from "@/services/diff/index.js";
import * as init from "@/services/init/index.js";
import * as list from "@/services/list/index.js";
import * as status from "@/services/status/index.js";

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
  createProjectCommands(program);
  return program;
}

describe("project CLI", () => {
  it("lists presets without exiting", async () => {
    const listPresetsSpy = spyOn(init, "listPresets").mockImplementation(() => {});
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["init", "--list-presets"], { from: "user" });

    expect(listPresetsSpy).toHaveBeenCalled();

    listPresetsSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("runs list with format override and passes config", async () => {
    const listSpy = spyOn(list, "listCommand").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["list", "services", "--format", "table"], { from: "user" });

    expect(listSpy).toHaveBeenCalledWith(
      "services",
      expect.anything(),
      expect.objectContaining({
        format: "table",
      }),
    );

    listSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("runs status and diff commands", async () => {
    const statusSpy = spyOn(status, "statusCommand").mockResolvedValue(0);
    const diffSpy = spyOn(diff, "diffCommand").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["status", "--format", "json"], { from: "user" });
    await program.parseAsync(["diff", "a.cue", "b.cue", "--context", "5"], { from: "user" });

    expect(statusSpy).toHaveBeenCalled();
    expect(diffSpy).toHaveBeenCalledWith("a.cue", "b.cue", expect.objectContaining({ context: 5 }));

    statusSpy.mockRestore();
    diffSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
