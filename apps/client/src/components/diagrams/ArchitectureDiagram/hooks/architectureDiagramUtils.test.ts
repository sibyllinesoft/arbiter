import { describe, expect, it } from "bun:test";
import { computeTaskOptions, syncOptimisticRemovals } from "./architectureDiagramUtils";

describe("computeTaskOptions", () => {
  it("returns empty arrays for null project data", () => {
    const result = computeTaskOptions(null);
    expect(result.openTaskOptions).toEqual([]);
    expect(result.groupSelectionOptions).toEqual([]);
  });

  it("returns empty arrays for undefined project data", () => {
    const result = computeTaskOptions(undefined);
    expect(result.openTaskOptions).toEqual([]);
    expect(result.groupSelectionOptions).toEqual([]);
  });

  it("processes groups array from spec", () => {
    const projectData = {
      spec: {
        groups: [{ id: "group-1", name: "Sprint 1", tasks: [{ id: "task-1", name: "Task One" }] }],
      },
    };
    const result = computeTaskOptions(projectData);
    expect(result.groupSelectionOptions).toHaveLength(1);
    expect(result.groupSelectionOptions[0].id).toBe("group-1");
    expect(result.groupSelectionOptions[0].name).toBe("Sprint 1");
    expect(result.openTaskOptions).toHaveLength(1);
    expect(result.openTaskOptions[0].id).toBe("task-1");
    expect(result.openTaskOptions[0].name).toBe("Task One");
  });

  it("processes groups object from spec", () => {
    const projectData = {
      spec: {
        groups: {
          "sprint-1": { name: "Sprint 1", tasks: [{ id: "task-1", name: "Task One" }] },
        },
      },
    };
    const result = computeTaskOptions(projectData);
    expect(result.groupSelectionOptions).toHaveLength(1);
    expect(result.openTaskOptions).toHaveLength(1);
  });

  it("filters out completed tasks", () => {
    const projectData = {
      spec: {
        groups: [
          {
            id: "group-1",
            name: "Sprint 1",
            tasks: [
              { id: "task-1", name: "Open Task" },
              { id: "task-2", name: "Completed Task", completed: true },
              { id: "task-3", name: "Done Task", done: true },
              { id: "task-4", name: "Status Completed", status: "completed" },
            ],
          },
        ],
      },
    };
    const result = computeTaskOptions(projectData);
    expect(result.openTaskOptions).toHaveLength(1);
    expect(result.openTaskOptions[0].id).toBe("task-1");
  });

  it("deduplicates groups", () => {
    const projectData = {
      spec: {
        groups: [
          { id: "group-1", name: "Sprint 1", tasks: [] },
          { id: "group-1", name: "Sprint 1 Duplicate", tasks: [] },
        ],
      },
    };
    const result = computeTaskOptions(projectData);
    expect(result.groupSelectionOptions).toHaveLength(1);
    expect(result.groupSelectionOptions[0].name).toBe("Sprint 1");
  });

  it("deduplicates tasks within groups", () => {
    const projectData = {
      spec: {
        groups: [
          {
            id: "group-1",
            name: "Sprint 1",
            tasks: [
              { id: "task-1", name: "Task One" },
              { id: "task-1", name: "Task One Duplicate" },
            ],
          },
        ],
      },
    };
    const result = computeTaskOptions(projectData);
    expect(result.openTaskOptions).toHaveLength(1);
    expect(result.openTaskOptions[0].name).toBe("Task One");
  });

  it("handles string tasks", () => {
    const projectData = {
      spec: {
        groups: [{ id: "group-1", name: "Sprint 1", tasks: ["Simple task"] }],
      },
    };
    const result = computeTaskOptions(projectData);
    expect(result.openTaskOptions).toHaveLength(1);
    expect(result.openTaskOptions[0].name).toBe("Simple task");
  });

  it("handles tasks object", () => {
    const projectData = {
      spec: {
        groups: [
          {
            id: "group-1",
            name: "Sprint 1",
            tasks: {
              "task-1": { name: "Task from object" },
            },
          },
        ],
      },
    };
    const result = computeTaskOptions(projectData);
    expect(result.openTaskOptions).toHaveLength(1);
  });

  it("includes task status when available", () => {
    const projectData = {
      spec: {
        groups: [
          {
            id: "group-1",
            name: "Sprint 1",
            tasks: [{ id: "task-1", name: "In Progress Task", status: "in_progress" }],
          },
        ],
      },
    };
    const result = computeTaskOptions(projectData);
    expect(result.openTaskOptions[0].status).toBe("in_progress");
  });

  it("falls back to top-level groups", () => {
    const projectData = {
      groups: [{ id: "group-1", name: "Sprint 1", tasks: [{ id: "task-1", name: "Task" }] }],
    };
    const result = computeTaskOptions(projectData);
    expect(result.groupSelectionOptions).toHaveLength(1);
    expect(result.openTaskOptions).toHaveLength(1);
  });
});

describe("syncOptimisticRemovals", () => {
  it("returns original set when project data is null", () => {
    const removals = new Set(["id-1", "id-2"]);
    const result = syncOptimisticRemovals(null, removals);
    expect(result).toBe(removals);
  });

  it("returns original set when optimistic removals is empty", () => {
    const projectData = { artifacts: [] };
    const removals = new Set<string>();
    const result = syncOptimisticRemovals(projectData, removals);
    expect(result).toBe(removals);
  });

  it("keeps removals for existing artifacts", () => {
    const projectData = {
      artifacts: [{ id: "art-1" }, { id: "art-2" }],
    };
    const removals = new Set(["art-1"]);
    const result = syncOptimisticRemovals(projectData, removals);
    expect(result.has("art-1")).toBe(true);
    expect(result.size).toBe(1);
  });

  it("removes entries for non-existing artifacts", () => {
    const projectData = {
      artifacts: [{ id: "art-1" }],
    };
    const removals = new Set(["art-1", "art-deleted"]);
    const result = syncOptimisticRemovals(projectData, removals);
    expect(result.has("art-1")).toBe(true);
    expect(result.has("art-deleted")).toBe(false);
    expect(result.size).toBe(1);
  });

  it("extracts IDs from artifactId field", () => {
    const projectData = {
      artifacts: [{ artifactId: "art-1" }],
    };
    const removals = new Set(["art-1"]);
    const result = syncOptimisticRemovals(projectData, removals);
    expect(result.has("art-1")).toBe(true);
  });

  it("extracts IDs from artifact_id field", () => {
    const projectData = {
      artifacts: [{ artifact_id: "art-1" }],
    };
    const removals = new Set(["art-1"]);
    const result = syncOptimisticRemovals(projectData, removals);
    expect(result.has("art-1")).toBe(true);
  });

  it("extracts IDs from metadata.artifactId", () => {
    const projectData = {
      artifacts: [{ metadata: { artifactId: "art-1" } }],
    };
    const removals = new Set(["art-1"]);
    const result = syncOptimisticRemovals(projectData, removals);
    expect(result.has("art-1")).toBe(true);
  });

  it("returns same set reference when no changes needed", () => {
    const projectData = {
      artifacts: [{ id: "art-1" }, { id: "art-2" }],
    };
    const removals = new Set(["art-1"]);
    const result = syncOptimisticRemovals(projectData, removals);
    expect(result).toBe(removals);
  });

  it("handles non-array artifacts gracefully", () => {
    const projectData = { artifacts: "not-an-array" };
    const removals = new Set(["art-1"]);
    const result = syncOptimisticRemovals(projectData, removals);
    // All removals should be cleared since no artifacts exist
    expect(result.size).toBe(0);
  });
});
