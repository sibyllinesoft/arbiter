import { describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import * as addSvc from "../../services/add/index.js";
import { createAddCommands } from "../add.js";

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
  createAddCommands(program);
  return program;
}

describe("add CLI", () => {
  it("dispatches service with parsed port", async () => {
    const addSpy = spyOn(addSvc, "runAddCommand").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["add", "service", "api", "--port", "8080", "--language", "python"], {
      from: "user",
    });

    expect(addSpy).toHaveBeenCalledWith(
      "service",
      "api",
      expect.objectContaining({ port: 8080, language: "python" }),
      baseConfig,
    );

    addSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("dispatches route and contract-operation", async () => {
    const addSpy = spyOn(addSvc, "runAddCommand").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["add", "route", "/home", "--id", "home"], { from: "user" });
    await program.parseAsync(
      ["add", "contract-operation", "payments", "capture", "--input-key", "body"],
      { from: "user" },
    );

    expect(addSpy).toHaveBeenCalledWith("route", "/home", expect.anything(), baseConfig);
    expect(addSpy).toHaveBeenCalledWith(
      "contract-operation",
      "capture",
      expect.objectContaining({ contract: "payments", inputKey: "body" }),
      baseConfig,
    );

    addSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("dispatches client creation", async () => {
    const addSpy = spyOn(addSvc, "runAddCommand").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["add", "client", "web", "--framework", "react", "--port", "3000"], {
      from: "user",
    });

    expect(addSpy).toHaveBeenCalledWith(
      "client",
      "web",
      expect.objectContaining({ framework: "react", port: 3000 }),
      baseConfig,
    );

    addSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
