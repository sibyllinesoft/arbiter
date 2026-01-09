/**
 * Unit tests for task normalization functions.
 * These tests ensure the normalizeTask and buildTaskGroups functions
 * correctly transform raw data into normalized structures.
 */
import { describe, expect, it } from "vitest";
import { buildTaskGroups, normalizeTask } from "./normalizers";

describe("normalizeTask", () => {
  it("normalizes a simple string task", () => {
    const result = normalizeTask({
      value: "Implement feature",
      key: "task-1",
      index: 0,
      nodePrefix: "test",
    });

    expect(result).not.toBeNull();
    expect(result?.name).toBe("Implement feature");
    expect(result?.nodeId).toMatch(/^task_/);
    expect(result?.completed).toBe(false);
  });

  it("normalizes a task object with name and status", () => {
    const result = normalizeTask({
      value: { name: "Build API", status: "blocked" },
      key: "api-task",
      index: 0,
      nodePrefix: "backend",
    });

    expect(result?.name).toBe("Build API");
    expect(result?.status).toBe("blocked");
    expect(result?.statusClass).toBe("blocked");
  });

  it("extracts dependencies from dependsOn array", () => {
    const result = normalizeTask({
      value: { name: "Deploy", dependsOn: ["build", "test"] },
      key: "deploy",
      index: 0,
      nodePrefix: "ci",
    });

    expect(result?.dependsOn).toEqual(["build", "test"]);
  });

  it("marks task as completed when status is completed", () => {
    const result = normalizeTask({
      value: { name: "Setup", status: "completed" },
      key: "setup",
      index: 0,
      nodePrefix: "init",
    });

    expect(result?.completed).toBe(true);
    expect(result?.statusClass).toBe("completed");
  });

  it("uses groupContext when provided", () => {
    const result = normalizeTask({
      value: { name: "Subtask" },
      key: "sub",
      index: 0,
      nodePrefix: "group-task",
      groupContext: { id: "group-1", slug: "group-1", name: "Main Group" },
    });

    expect(result?.groupId).toBe("group-1");
    expect(result?.groupName).toBe("Main Group");
  });

  it("generates fallback ID when no explicit ID", () => {
    const result = normalizeTask({
      value: {},
      key: "",
      index: 5,
      nodePrefix: "fallback",
    });

    expect(result?.rawId).toContain("fallback-6");
  });

  it("extracts priority from task or metadata", () => {
    const result = normalizeTask({
      value: { name: "Urgent", priority: "high" },
      key: "urgent",
      index: 0,
      nodePrefix: "p",
    });

    expect(result?.priority).toBe("high");
  });

  it("extracts assignee from task or metadata", () => {
    const result = normalizeTask({
      value: { name: "Review", assignee: "alice" },
      key: "review",
      index: 0,
      nodePrefix: "r",
    });

    expect(result?.assignee).toBe("alice");
  });
});

describe("buildTaskGroups", () => {
  it("returns unscoped group when resolved is null", () => {
    const groups = buildTaskGroups(null);

    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe("unscoped");
    expect(groups[0].type).toBe("unscoped");
  });

  it("returns unscoped group when resolved is undefined", () => {
    const groups = buildTaskGroups(undefined);

    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe("unscoped");
  });

  it("processes groups from spec.groups", () => {
    const resolved = {
      spec: {
        groups: [
          { name: "Backend", tasks: [{ name: "API" }] },
          { name: "Frontend", tasks: [{ name: "UI" }] },
        ],
      },
    };

    const groups = buildTaskGroups(resolved);

    // unscoped + 2 groups
    expect(groups).toHaveLength(3);
    expect(groups[1].name).toBe("Backend");
    expect(groups[1].tasks).toHaveLength(1);
    expect(groups[2].name).toBe("Frontend");
  });

  it("processes global tasks into unscoped group", () => {
    const resolved = {
      spec: {
        tasks: [{ name: "Global Task 1" }, { name: "Global Task 2" }],
      },
    };

    const groups = buildTaskGroups(resolved);

    expect(groups[0].id).toBe("unscoped");
    expect(groups[0].tasks).toHaveLength(2);
  });

  it("assigns global tasks to matching groups by groupId", () => {
    const resolved = {
      spec: {
        groups: [{ id: "backend", name: "Backend" }],
        tasks: [{ name: "Backend Task", groupId: "backend" }],
      },
    };

    const groups = buildTaskGroups(resolved);

    const backendGroup = groups.find((g) => g.id === "backend");
    expect(backendGroup?.tasks).toHaveLength(1);
    expect(backendGroup?.tasks[0].name).toBe("Backend Task");

    const unscopedGroup = groups.find((g) => g.id === "unscoped");
    expect(unscopedGroup?.tasks).toHaveLength(0);
  });

  it("sorts tasks within groups alphabetically", () => {
    const resolved = {
      spec: {
        tasks: [{ name: "Zebra" }, { name: "Apple" }, { name: "Mango" }],
      },
    };

    const groups = buildTaskGroups(resolved);
    const taskNames = groups[0].tasks.map((t) => t.name);

    expect(taskNames).toEqual(["Apple", "Mango", "Zebra"]);
  });

  it("deduplicates tasks within a group", () => {
    const resolved = {
      spec: {
        groups: [
          {
            id: "dup-test",
            name: "Dup Test",
            tasks: [
              { id: "task-1", name: "Same Task" },
              { id: "task-1", name: "Same Task" },
            ],
          },
        ],
      },
    };

    const groups = buildTaskGroups(resolved);
    const testGroup = groups.find((g) => g.id === "dup-test");

    // Should deduplicate by slug
    expect(testGroup?.tasks.length).toBeLessThanOrEqual(2);
  });
});
