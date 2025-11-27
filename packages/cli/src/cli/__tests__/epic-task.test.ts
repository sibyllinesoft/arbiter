import { describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import * as epicSvc from "../../services/epic/commands.js";
import { createEpicTaskCommands } from "../epic-task.js";

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
  const addCmd = new Command("add");
  program.addCommand(addCmd);
  createEpicTaskCommands(addCmd);
  return program;
}

describe("epic/task CLI", () => {
  it("dispatches epic list and create", async () => {
    const epicSpy = spyOn(epicSvc, "epicCommand").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(["add", "epic", "list", "--status", "planning"], { from: "user" });
    await program.parseAsync(["add", "epic", "create", "--name", "Roadmap"], { from: "user" });

    expect(epicSpy).toHaveBeenCalledWith(
      "list",
      undefined,
      expect.objectContaining({ status: "planning" }),
      baseConfig,
    );
    expect(epicSpy).toHaveBeenCalledWith(
      "create",
      undefined,
      expect.objectContaining({ name: "Roadmap" }),
      baseConfig,
    );

    epicSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("dispatches task create and complete", async () => {
    const taskSpy = spyOn(epicSvc, "taskCommand").mockResolvedValue(0);
    const exitSpy = spyOn(process, "exit").mockImplementation((() => undefined) as any);

    const program = buildProgram();
    await program.parseAsync(
      ["add", "task", "create", "--epic", "epic-1", "--name", "Login page", "--type", "feature"],
      { from: "user" },
    );

    await program.parseAsync(["add", "task", "complete", "task-1"], { from: "user" });

    expect(taskSpy).toHaveBeenCalledWith(
      "create",
      undefined,
      expect.objectContaining({ epic: "epic-1", name: "Login page" }),
      baseConfig,
    );
    expect(taskSpy).toHaveBeenCalledWith("complete", "task-1", expect.anything(), baseConfig);

    taskSpy.mockRestore();
    exitSpy.mockRestore();
  });
});
