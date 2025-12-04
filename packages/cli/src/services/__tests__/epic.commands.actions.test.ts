import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import chalk from "chalk";

import { epicCommand, taskCommand } from "@/services/epic/commands.js";
import * as data from "@/services/epic/data.js";
import type { CLIConfig, EpicOptions, TaskOptions } from "@/types.js";
import { ShardedCUEStorage } from "@/utils/sharded-storage.js";

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

afterEach(() => {
  mock.restore();
});

describe("epicCommand actions", () => {
  it("lists, shows, creates, updates, deletes and stats epics", async () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const createSpy = spyOn(data, "createEpicData").mockResolvedValue({
      epic: { id: "e1", name: "Epic 1" } as any,
      shardId: "s1",
    });
    const updateSpy = spyOn(data, "updateEpicData").mockResolvedValue({
      id: "e1",
      status: "completed",
    } as any);
    const deleteSpy = spyOn(data, "deleteEpicData").mockResolvedValue({
      id: "e1",
      status: "cancelled",
    } as any);
    const listSpy = spyOn(data, "listEpicsData").mockResolvedValue([
      { id: "e1", name: "Epic 1", status: "planning", priority: "high" },
    ] as any);
    const statsSpy = spyOn(data, "getStatsData").mockResolvedValue({
      totalShards: 1,
      totalEpics: 1,
      totalTasks: 2,
      avgEpicsPerShard: 1,
      shardUtilization: 0.5,
    });
    const showSpy = spyOn(data, "getEpicById").mockResolvedValue({
      id: "e1",
      name: "Epic One",
      status: "planning",
      priority: "high",
      tasks: [],
    } as any);

    expect(await epicCommand("list", undefined, {} as EpicOptions, baseConfig)).toBe(0);
    expect(await epicCommand("show", "e1", { format: "json" } as EpicOptions, baseConfig)).toBe(0);
    expect(await epicCommand("create", undefined, { name: "New" } as EpicOptions, baseConfig)).toBe(
      0,
    );
    expect(
      await epicCommand("update", "e1", { status: "completed" } as EpicOptions, baseConfig),
    ).toBe(0);
    expect(await epicCommand("delete", "e1", {} as EpicOptions, baseConfig)).toBe(0);
    expect(await epicCommand("stats", undefined, {} as EpicOptions, baseConfig)).toBe(0);

    expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
    expect(showSpy).toHaveBeenCalledWith("e1");
    expect(createSpy).toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith("e1", expect.any(Object));
    expect(deleteSpy).toHaveBeenCalledWith("e1", expect.any(Object));
    expect(statsSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("returns error when epic not found on show", async () => {
    spyOn(console, "error").mockImplementation(() => {});
    spyOn(data, "getEpicById").mockResolvedValue(null);
    expect(await epicCommand("show", "missing", {} as EpicOptions, baseConfig)).toBe(1);
  });
});

describe("taskCommand actions", () => {
  it("creates, updates, completes, lists, ready/blocked and dependency graph tasks", async () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const createSpy = spyOn(data, "createTaskData").mockResolvedValue({
      id: "t1",
      name: "Task",
    } as any);
    const updateSpy = spyOn(data, "updateTaskData").mockResolvedValue({
      id: "t1",
      status: "completed",
    } as any);
    const completeSpy = spyOn(data, "completeTaskData").mockResolvedValue({
      id: "t1",
      status: "completed",
    } as any);
    const listSpy = spyOn(data, "listTasksData").mockResolvedValue([
      { id: "t1", name: "Task" },
    ] as any);
    const showSpy = spyOn(data, "getTaskById").mockResolvedValue({
      id: "t1",
      name: "Task",
      status: "todo",
      priority: "medium",
    } as any);
    const depSpy = spyOn(data, "dependencyGraphData").mockResolvedValue({
      nodes: [],
      edges: [],
      tasks: [],
    } as any);
    const readySpy = spyOn(data, "readyTasksData").mockResolvedValue([{ id: "t1" }] as any);
    const blockedSpy = spyOn(data, "blockedTasksData").mockResolvedValue([{ id: "t2" }] as any);

    const baseTaskOpts = { epic: "e1", name: "Task" } as TaskOptions;
    expect(await taskCommand("create", undefined, baseTaskOpts, baseConfig)).toBe(0);
    expect(
      await taskCommand("update", "t1", { status: "completed" } as TaskOptions, baseConfig),
    ).toBe(0);
    expect(await taskCommand("complete", "t1", {} as TaskOptions, baseConfig)).toBe(0);
    expect(
      await taskCommand("list", undefined, { format: "json" } as TaskOptions, baseConfig),
    ).toBe(0);
    expect(await taskCommand("show", "t1", { format: "json" } as TaskOptions, baseConfig)).toBe(0);
    expect(await taskCommand("dependency-graph", undefined, {} as TaskOptions, baseConfig)).toBe(0);
    expect(await taskCommand("ready", undefined, {} as TaskOptions, baseConfig)).toBe(0);
    expect(await taskCommand("blocked", undefined, {} as TaskOptions, baseConfig)).toBe(0);

    expect(createSpy).toHaveBeenCalledWith("e1", baseTaskOpts);
    expect(updateSpy).toHaveBeenCalledWith("t1", expect.any(Object));
    expect(completeSpy).toHaveBeenCalledWith("t1", expect.any(Object));
    expect(listSpy).toHaveBeenCalled();
    expect(showSpy).toHaveBeenCalledWith("t1");
    expect(depSpy).toHaveBeenCalled();
    expect(readySpy).toHaveBeenCalled();
    expect(blockedSpy).toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("returns error when task not found on show", async () => {
    spyOn(console, "error").mockImplementation(() => {});
    spyOn(data, "getTaskById").mockResolvedValue(null);
    const code = await taskCommand("show", "missing", {} as TaskOptions, baseConfig);
    expect(code).toBe(1);
  });

  it("handles batch create from inline json", async () => {
    const originalInit = ShardedCUEStorage.prototype.initialize;
    const originalClose = ShardedCUEStorage.prototype.close;
    const originalAdd = (ShardedCUEStorage.prototype as any).addTasks;

    const initSpy = (ShardedCUEStorage.prototype.initialize = mock(async () => {}));
    const closeSpy = (ShardedCUEStorage.prototype.close = mock(async () => {}));
    const addSpy = ((ShardedCUEStorage.prototype as any).addTasks = mock(async () => {}));

    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    const code = await taskCommand(
      "batch",
      undefined,
      { epic: "e1", json: JSON.stringify([{ name: "Do thing", priority: "high" }]) } as TaskOptions,
      baseConfig,
    );

    expect(code).toBe(0);
    expect(addSpy).toHaveBeenCalledWith(
      "e1",
      expect.arrayContaining([
        expect.objectContaining({ id: "do-thing", name: "Do thing", priority: "high" }),
      ]),
    );
    expect(initSpy).toHaveBeenCalled();
    expect(closeSpy).toHaveBeenCalled();
    logSpy.mockRestore();

    ShardedCUEStorage.prototype.initialize = originalInit;
    ShardedCUEStorage.prototype.close = originalClose;
    (ShardedCUEStorage.prototype as any).addTasks = originalAdd;
  });
});
