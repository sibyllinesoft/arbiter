import { describe, expect, it } from "bun:test";
import { GitHubSyncClient } from "@/utils/github-sync.js";

describe("GitHubSyncClient mapSemanticLabels", () => {
  it("maps defaults, type-specific labels, prefixes, and context", () => {
    process.env.GITHUB_TOKEN = "token";
    const client = new GitHubSyncClient({
      repository: { owner: "me", repo: "demo" },
      templates: {},
      labels: {
        default: ["base"],
        epics: { "kind/epic": ["E1", "common"] },
        tasks: { "kind/task": ["T1"] },
      },
      prefixes: { epic: "pref-epic", task: "pref-task" },
      automation: {},
    } as any);

    const epicLabels = (client as any).mapSemanticLabels(["kind/epic", "extra"], "epic", {
      priority: "high",
      status: "active",
    } as any);

    expect(epicLabels).toEqual(
      expect.arrayContaining([
        "pref-epic",
        "base",
        "E1",
        "common",
        "extra",
        "priority:high",
        "status:active",
        "type:epic",
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
