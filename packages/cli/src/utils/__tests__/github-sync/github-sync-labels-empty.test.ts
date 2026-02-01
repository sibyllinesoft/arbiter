/** @packageDocumentation GitHub sync tests */
import { describe, expect, it } from "bun:test";
import type { GitHubSyncConfig } from "@/types.js";
import type { Group } from "@/utils/github/sharded-storage.js";
import { mapSemanticLabels } from "@/utils/github/sync/github-sync-helpers.js";

describe("mapSemanticLabels empty input", () => {
  it("applies defaults and prefixes even without semantic labels", () => {
    const config: GitHubSyncConfig = {
      repository: { owner: "me", repo: "demo" },
      templates: {},
      labels: { default: ["base"] },
      prefixes: { group: "pref-group", issue: "pref-task" },
      automation: {},
    };

    const groupItem: Partial<Group> = {
      id: "g-1",
      name: "test-group",
      priority: "medium",
      status: "active",
      tasks: [],
    };

    const groupLabels = mapSemanticLabels(config, [], "group", groupItem as Group);

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
