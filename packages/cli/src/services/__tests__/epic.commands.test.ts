import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { epicCommand, taskCommand } from "@/services/epic/commands.js";
import * as data from "@/services/epic/data.js";
import type { CLIConfig, EpicOptions, TaskOptions } from "@/types.js";

const baseConfig: CLIConfig = {
  apiUrl: "http://localhost",
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

const noopOpts: EpicOptions = {};
const taskOpts: TaskOptions = { epic: "e1" };

afterEach(() => {
  mock.restore();
});

describe("epicCommand", () => {
  it("returns error on unknown action", async () => {
    const err = spyOn(console, "error").mockImplementation(() => {});
    const code = await epicCommand("nope", undefined, noopOpts, baseConfig);
    err.mockRestore();
    expect(code).toBe(1);
  });

  it("lists epics and prints json", async () => {
    spyOn(data, "listEpicsData").mockResolvedValue([
      { id: "e1", name: "Epic One", status: "planning", priority: "high" },
    ] as any);
    const log: string[] = [];
    const orig = console.log;
    console.log = (m?: any) => log.push(String(m));
    const code = await epicCommand("list", undefined, { format: "json" }, baseConfig);
    console.log = orig;
    expect(code).toBe(0);
    expect(log.join("")).toContain("Epic One");
  });
});

describe("taskCommand", () => {
  it("errors on unknown action", async () => {
    const err = spyOn(console, "error").mockImplementation(() => {});
    const code = await taskCommand("nope", undefined, taskOpts, baseConfig);
    err.mockRestore();
    expect(code).toBe(1);
  });

  it("shows a task in json format", async () => {
    spyOn(data, "getTaskById").mockResolvedValue({
      id: "t1",
      name: "Demo Task",
      status: "ready",
      priority: "medium",
    } as any);
    const log: string[] = [];
    const orig = console.log;
    console.log = (m?: any) => log.push(String(m));
    const code = await taskCommand("show", "t1", { format: "json" } as TaskOptions, baseConfig);
    console.log = orig;
    expect(code).toBe(0);
    expect(log.join("")).toContain("Demo Task");
  });
});
