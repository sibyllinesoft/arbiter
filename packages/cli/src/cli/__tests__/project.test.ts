import { describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import * as check from "../../services/check/index.js";
import * as diff from "../../services/diff/index.js";
import * as init from "../../services/init/index.js";
import * as list from "../../services/list/index.js";
import * as specImport from "../../services/spec-import/index.js";
import * as status from "../../services/status/index.js";
import * as surface from "../../services/surface/index.js";
import { createProjectCommands } from "../project.js";

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
  it("lists templates or presets without exiting", async () => {
    const listAllSpy = spyOn(init, "listAll").mockImplementation(() => {});
    const program = buildProgram();
    await program.parseAsync(["init", "--list-templates", "--list-presets"], { from: "user" });
    expect(listAllSpy).toHaveBeenCalled();
    listAllSpy.mockRestore();
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

  it("calls check command with provided patterns", async () => {
    const checkSpy = spyOn(check, "runCheckCommand").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["check", "src/**/*.cue", "--format", "json"], { from: "user" });

    expect(checkSpy).toHaveBeenCalledWith(
      ["src/**/*.cue"],
      expect.objectContaining({ format: "json" }),
      baseConfig,
    );

    checkSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("imports specs with provided options", async () => {
    const importSpy = spyOn(specImport, "importSpec").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(
      [
        "spec-import",
        "./fragment.cue",
        "--project",
        "demo",
        "--remote-path",
        "services/api",
        "--message",
        "update",
      ],
      { from: "user" },
    );

    expect(importSpy).toHaveBeenCalledWith(
      "./fragment.cue",
      expect.objectContaining({ project: "demo", remotePath: "services/api", message: "update" }),
      baseConfig,
    );

    importSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("surfaces code with correct options", async () => {
    const surfaceSpy = spyOn(surface, "surfaceCommand").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(
      [
        "surface",
        "typescript",
        "--output",
        "out.cue",
        "--format",
        "json",
        "--project-name",
        "demo",
        "--diff",
      ],
      { from: "user" },
    );

    expect(surfaceSpy).toHaveBeenCalledWith(
      expect.objectContaining({ language: "typescript", output: "out.cue", diff: true }),
      baseConfig,
    );

    surfaceSpy.mockRestore();
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
