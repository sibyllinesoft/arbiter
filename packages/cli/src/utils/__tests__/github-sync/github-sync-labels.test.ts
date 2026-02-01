/** @packageDocumentation GitHub sync tests */
import { describe, expect, it } from "bun:test";
import type { GitHubSyncConfig } from "@/types.js";
import type { Group, Task } from "@/utils/github/sharded-storage.js";
import { mapSemanticLabels } from "@/utils/github/sync/github-sync-helpers.js";

describe("mapSemanticLabels", () => {
  it("maps defaults, type-specific labels, prefixes, and context", () => {
    const config: GitHubSyncConfig = {
      repository: { owner: "me", repo: "demo" },
      templates: {},
      labels: {
        default: ["base"],
        groups: { "kind/group": ["E1", "common"] },
        issues: { "kind/task": ["T1"] },
      },
      prefixes: { group: "pref-group", issue: "pref-task" },
      automation: {},
    };

    const groupItem: Partial<Group> = {
      id: "g-1",
      name: "test-group",
      priority: "high",
      status: "active",
      tasks: [],
    };

    const groupLabels = mapSemanticLabels(
      config,
      ["kind/group", "extra"],
      "group",
      groupItem as Group,
    );

    expect(groupLabels).toEqual(
      expect.arrayContaining([
        "pref-group",
        "base",
        "E1",
        "common",
        "extra",
        "priority:high",
        "status:active",
        "type:group",
      ]),
    );

    const taskItem: Partial<Task> = {
      id: "t-1",
      title: "test-task",
      priority: "low",
      status: "todo",
      type: "feature",
    };

    const taskLabels = mapSemanticLabels(config, ["kind/task", "misc"], "task", taskItem as Task);

    expect(taskLabels).toEqual(
      expect.arrayContaining([
        "pref-task",
        "base",
        "T1",
        "misc",
        "priority:low",
        "status:todo",
        "type:feature",
      ]),
    );
  });
});
