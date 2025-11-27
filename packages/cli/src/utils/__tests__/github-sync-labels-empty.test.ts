import { describe, expect, it } from "bun:test";
import { GitHubSyncClient } from "../github-sync.js";

describe("GitHubSyncClient mapSemanticLabels empty input", () => {
  it("applies defaults and prefixes even without semantic labels", () => {
    process.env.GITHUB_TOKEN = "token";
    const client = new GitHubSyncClient({
      repository: { owner: "me", repo: "demo" },
      templates: {},
      labels: { default: ["base"] },
      prefixes: { epic: "pref-epic", task: "pref-task" },
      automation: {},
    } as any);

    const epicLabels = (client as any).mapSemanticLabels([], "epic", {
      priority: "medium",
      status: "active",
    } as any);
    expect(epicLabels).toEqual(
      expect.arrayContaining([
        "pref-epic",
        "base",
        "priority:medium",
        "status:active",
        "type:epic",
      ]),
    );
  });
});
