/** @packageDocumentation GitHub sync tests */
import { describe, expect, it } from "bun:test";
import { GitHubSyncClient } from "@/utils/github/sync/github-sync.js";

describe("GitHubSyncClient mapSemanticLabels", () => {
  it("maps defaults, type-specific labels, prefixes, and context", () => {
    process.env.GITHUB_TOKEN = "token";
    const client = new GitHubSyncClient({
      repository: { owner: "me", repo: "demo" },
      templates: {},
      labels: {
        default: ["base"],
        groups: { "kind/group": ["E1", "common"] },
        tasks: { "kind/task": ["T1"] },
      },
      prefixes: { group: "pref-group", task: "pref-task" },
      automation: {},
    } as any);

    const groupLabels = (client as any).mapSemanticLabels(["kind/group", "extra"], "group", {
      priority: "high",
      status: "active",
    } as any);

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

    const taskLabels = (client as any).mapSemanticLabels(["kind/task", "misc"], "task", {
      priority: "low",
      status: "todo",
      type: "feature",
    } as any);

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
