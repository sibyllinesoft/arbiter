import { describe, expect, it } from "bun:test";

import { type Epic, type ShardedCUEStorage, type Task } from "../../utils/sharded-storage.js";
import {
  blockedTasksData,
  completeTaskData,
  createEpicData,
  createTaskData,
  deleteEpicData,
  dependencyGraphData,
  getEpicById,
  getStatsData,
  getTaskById,
  listEpicsData,
  listTasksData,
  readyTasksData,
  updateEpicData,
  updateTaskData,
} from "../epic/data.js";

const baseEpic: Epic = {
  id: "epic-1",
  name: "First Epic",
  status: "planning",
  priority: "high",
  tasks: [],
};

const sampleTasks: Task[] = [
  {
    id: "task-1",
    name: "One",
    status: "todo",
    priority: "medium",
    type: "feature",
    epicId: "epic-1",
  },
  {
    id: "task-2",
    name: "Two",
    status: "in_progress",
    priority: "high",
    type: "bug",
    epicId: "epic-1",
    assignee: "alice",
  },
];

function track<T extends (...args: any[]) => any>(impl: T) {
  const calls: any[] = [];
  const wrapped = ((...args: any[]) => {
    calls.push(args);
    return impl(...args);
  }) as T & { calls: any[][] };
  wrapped.calls = calls;
  return wrapped;
}

function createStorageMock(overrides: Partial<ShardedCUEStorage> = {}): ShardedCUEStorage & {
  [k: string]: any;
} {
  const storage: any = {
    initialize: track(async () => {}),
    close: track(async () => {}),
    listEpics: track(async () => [] as Epic[]),
    getEpic: track(async () => null as any),
    addEpic: track(async () => "shard-1"),
    updateEpic: track(async () => {}),
    getOrderedTasks: track(async () => [] as Task[]),
    getStats: track(async () => ({
      totalShards: 0,
      totalEpics: 0,
      totalTasks: 0,
      avgEpicsPerShard: 0,
      shardUtilization: 0,
    })),
    getDependencyGraph: track(() => ({ nodes: [], edges: [] })),
    getReadyTasks: track(() => [] as Task[]),
    getBlockedTasks: track(() => [] as Task[]),
  };

  Object.assign(storage, overrides);
  return storage as ShardedCUEStorage & { [k: string]: any };
}

describe("epic data accessors", () => {
  it("filters epics by all supported filters", async () => {
    const storage = createStorageMock({
      listEpics: track(async () => [
        { ...baseEpic, assignee: "alice", priority: "high", arbiter: { shard: "s1" } },
        {
          ...baseEpic,
          id: "epic-2",
          assignee: "alice",
          priority: "high",
          arbiter: { shard: "s2" },
        },
        { ...baseEpic, id: "epic-3", assignee: "bob", priority: "low", arbiter: { shard: "s1" } },
      ]),
    });

    const result = await listEpicsData(
      { status: "planning", assignee: "alice", priority: "high", shard: "s2" },
      {} as any,
      storage,
    );

    expect(result.map((e) => e.id)).toEqual(["epic-2"]);
    expect(storage.initialize.calls.length).toBe(1);
    expect(storage.close.calls.length).toBe(1);
    expect(storage.listEpics.calls[0][0]).toBe("planning");
  });

  it("creates an epic with slugified id and default status", async () => {
    const storage = createStorageMock({
      getEpic: track(async () => null as any),
      addEpic: track(async () => "shard-9"),
    });

    const { epic, shardId } = await createEpicData(
      {
        name: "New Epic!",
        description: "demo",
        priority: "critical",
        labels: "L1, L2",
        tags: "alpha,beta",
        allowParallelTasks: true,
      } as any,
      {} as any,
      storage,
    );

    expect(storage.getEpic.calls[0][0]).toBe("new-epic");
    expect(storage.addEpic.calls.length).toBe(1);
    expect(epic.id).toBe("new-epic");
    expect(epic.status).toBe("planning");
    expect(epic.labels).toEqual(["L1", "L2"]);
    expect(epic.tags).toEqual(["alpha", "beta"]);
    expect(shardId).toBe("shard-9");
  });

  it("throws when epic already exists", async () => {
    const storage = createStorageMock({ getEpic: track(async () => baseEpic) });

    await expect(
      createEpicData({ name: "Existing Epic" } as any, {} as any, storage),
    ).rejects.toThrow("already exists");
  });

  it("updates epic fields or errors when none provided", async () => {
    const storage = createStorageMock({
      getEpic: track(async () => ({ ...baseEpic })),
      updateEpic: track(async () => {}),
    });

    const updated = await updateEpicData(
      "epic-1",
      { status: "completed", priority: "low", assignee: "bob" },
      {} as any,
      storage,
    );
    expect(updated.status).toBe("completed");
    expect(updated.priority).toBe("low");
    expect(updated.assignee).toBe("bob");
    expect(storage.updateEpic.calls[0][0].status).toBe("completed");

    const storageNoUpdate = createStorageMock({
      getEpic: track(async () => ({ ...baseEpic })),
    });
    await expect(updateEpicData("epic-1", {}, {} as any, storageNoUpdate)).rejects.toThrow(
      "No updates specified",
    );
  });

  it("errors when epic is missing", async () => {
    const storage = createStorageMock({
      getEpic: track(async () => null as any),
    });

    await expect(
      updateEpicData("missing", { status: "completed" }, {} as any, storage),
    ).rejects.toThrow("not found");
  });

  it("delegates delete to update with cancelled status", async () => {
    const storage = createStorageMock({
      getEpic: track(async () => ({ ...baseEpic })),
      updateEpic: track(async () => {}),
    });

    const result = await deleteEpicData("epic-1", {}, {} as any, storage);
    expect(result.status).toBe("cancelled");
    expect(storage.updateEpic.calls[0][0].status).toBe("cancelled");
  });

  it("lists tasks with filters applied", async () => {
    const storage = createStorageMock({
      getOrderedTasks: track(async () => [
        sampleTasks[0],
        { ...sampleTasks[1], status: "todo", type: "docs", priority: "high", assignee: "alice" },
      ]),
    });

    const tasks = await listTasksData(
      { status: "todo", type: "docs", assignee: "alice", priority: "high", epicId: "epic-1" },
      {} as any,
      storage,
    );

    expect(storage.getOrderedTasks.calls[0][0]).toBe("epic-1");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("task-2");
    expect(storage.close.calls.length).toBe(1);
  });

  it("creates tasks and validates uniqueness", async () => {
    const epicWithTasks = { ...baseEpic, tasks: [sampleTasks[0]] };
    const storage = createStorageMock({
      getEpic: track(async () => epicWithTasks),
      updateEpic: track(async () => {}),
    });

    const task = await createTaskData(
      "epic-1",
      {
        name: "Second Task",
        type: "bug",
        priority: "high",
        description: "desc",
        dependsOn: "task-1",
        acceptanceCriteria: "done, tested",
      } as any,
      {} as any,
      storage,
    );

    expect(storage.getEpic.calls[0][0]).toBe("epic-1");
    expect(task.id).toBe("second-task");
    expect(task.dependsOn).toEqual(["task-1"]);
    expect(task.acceptanceCriteria).toEqual(["done", "tested"]);
    expect(storage.updateEpic.calls[0][0].tasks.some((t: Task) => t.id === "second-task")).toBe(
      true,
    );

    const duplicateStorage = createStorageMock({
      getEpic: track(async () => epicWithTasks),
    });
    await expect(
      createTaskData("epic-1", { name: "Task 1" } as any, {} as any, duplicateStorage),
    ).rejects.toThrow("already exists");
  });

  it("requires an epic for task creation", async () => {
    const storage = createStorageMock({
      getEpic: track(async () => null as any),
    });

    await expect(
      createTaskData("missing", { name: "No epic" } as any, {} as any, storage),
    ).rejects.toThrow("not found");
  });

  it("updates tasks across shards and validates options", async () => {
    const epic = { ...baseEpic, tasks: [structuredClone(sampleTasks[0])] };
    const storage = createStorageMock({
      listEpics: track(async () => [epic]),
      updateEpic: track(async () => {}),
    });

    const updated = await updateTaskData(
      "task-1",
      { status: "completed", priority: "low", type: "docs", assignee: "casey" },
      {} as any,
      storage,
    );

    expect(updated.status).toBe("completed");
    expect(updated.type).toBe("docs");
    expect(updated.assignee).toBe("casey");
    expect(storage.updateEpic.calls[0][0].tasks.length).toBeGreaterThan(0);

    const missingStorage = createStorageMock({
      listEpics: track(async () => [baseEpic]),
    });
    await expect(
      updateTaskData("missing", { status: "todo" }, {} as any, missingStorage),
    ).rejects.toThrow("not found");
  });

  it("completes tasks via helper", async () => {
    const epic = { ...baseEpic, tasks: [structuredClone(sampleTasks[0])] };
    const storage = createStorageMock({
      listEpics: track(async () => [epic]),
      updateEpic: track(async () => {}),
    });

    const task = await completeTaskData("task-1", {}, {} as any, storage);
    expect(task.status).toBe("completed");
    expect(storage.updateEpic.calls.length).toBe(1);
  });

  it("builds dependency graph and returns tasks", async () => {
    const tasks = [structuredClone(sampleTasks[0])];
    const storage = createStorageMock({
      getOrderedTasks: track(async () => tasks),
      getDependencyGraph: track(() => ({
        nodes: [{ id: "task-1", label: "One", status: "todo", priority: "medium" }],
        edges: [],
      })),
    });

    const result = await dependencyGraphData("epic-1", storage);

    expect(storage.getOrderedTasks.calls[0][0]).toBe("epic-1");
    expect(storage.getDependencyGraph.calls[0][0]).toEqual(tasks);
    expect(result.tasks).toEqual(tasks);
    expect(result.nodes[0].id).toBe("task-1");
  });

  it("returns ready and blocked tasks using storage helpers", async () => {
    const tasks = [structuredClone(sampleTasks[0])];
    const storage = createStorageMock({
      getOrderedTasks: track(async () => tasks),
      getReadyTasks: track(() => tasks),
      getBlockedTasks: track(() => tasks),
    });

    const readyResult = await readyTasksData(undefined, storage);
    const blockedResult = await blockedTasksData("epic-1", storage);

    expect(storage.getOrderedTasks.calls.length).toBeGreaterThan(0);
    expect(readyResult).toEqual(tasks);
    expect(blockedResult).toEqual(tasks);
    expect(storage.getReadyTasks.calls.length).toBe(1);
    expect(storage.getBlockedTasks.calls.length).toBe(1);
  });

  it("returns individual epic or task and storage stats", async () => {
    const storage = createStorageMock({
      getEpic: track(async () => baseEpic),
      getStats: track(async () => ({
        totalShards: 1,
        totalEpics: 1,
        totalTasks: 2,
        avgEpicsPerShard: 1,
        shardUtilization: 0.5,
      })),
      listEpics: track(async () => [{ ...baseEpic, tasks: sampleTasks }]),
    });

    const epic = await getEpicById("epic-1", storage);
    const statResult = await getStatsData(storage);
    const task = await getTaskById("task-2", storage);

    expect(storage.getEpic.calls[0][0]).toBe("epic-1");
    expect(epic?.id).toBe("epic-1");
    expect(statResult.totalTasks).toBe(2);
    expect(storage.listEpics.calls.length).toBe(1);
    expect(task?.task.id).toBe("task-2");
  });
});
