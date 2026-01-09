/** @packageDocumentation GitHub sync tests */
import { describe, expect, it } from "bun:test";
import { GitHubSyncClient } from "@/utils/github/sync/github-sync.js";

describe("GitHubSyncClient mapSemanticLabels empty input", () => {
  it("applies defaults and prefixes even without semantic labels", () => {
    process.env.GITHUB_TOKEN = "token";
    const client = new GitHubSyncClient({
      repository: { owner: "me", repo: "demo" },
      templates: {},
      labels: { default: ["base"] },
      prefixes: { group: "pref-group", task: "pref-task" },
      automation: {},
    } as any);

    const groupLabels = (client as any).mapSemanticLabels([], "group", {
      priority: "medium",
      status: "active",
    } as any);
    expect(groupLabels).toEqual(
      expect.arrayContaining([
        "pref-group",
        "base",
        "priority:medium",
        "status:active",
        "type:group",
      ]),
    );
  });
});
