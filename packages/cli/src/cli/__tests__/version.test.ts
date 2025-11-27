import { describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import * as versionSvc from "../../services/version/index.js";
import { createVersionCommands } from "../version.js";

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
  createVersionCommands(program);
  return program;
}

describe("version CLI", () => {
  it("invokes version plan with flags", async () => {
    const planSpy = spyOn(versionSvc, "versionPlanCommand").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["version", "plan", "--breaking", "--format", "json"], {
      from: "user",
    });

    expect(planSpy).toHaveBeenCalledWith(
      expect.objectContaining({ breaking: true, format: "json" }),
      baseConfig,
    );

    planSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("invokes version release with apply flag", async () => {
    const releaseSpy = spyOn(versionSvc, "versionReleaseCommand").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["version", "release", "--version", "1.2.3", "--apply", "--tag"], {
      from: "user",
    });

    expect(releaseSpy).toHaveBeenCalledWith(
      expect.objectContaining({ version: "1.2.3", apply: true, tag: true }),
      baseConfig,
    );

    releaseSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
