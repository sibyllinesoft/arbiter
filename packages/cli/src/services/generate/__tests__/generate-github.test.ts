import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import type { Mock } from "bun:test";

const storageInstances: any[] = [];
const githubClients: any[] = [];

// Mock modules before importing
mock.module("@/utils/io/git-detection.js", () => ({
  getSmartRepositoryConfig: mock(() => null),
  validateRepositoryConfig: mock(() => ({ valid: true, errors: [], suggestions: [] })),
}));

mock.module("@/utils/github/sharded-storage.js", () => ({
  ShardedCUEStorage: mock(() => {
    const instance = {
      initialize: mock(() => Promise.resolve(undefined)),
      listGroups: mock(() => Promise.resolve([])),
    };
    storageInstances.push(instance);
    return instance;
  }),
}));

mock.module("@/utils/github/github-sync.js", () => ({
  GitHubSyncClient: mock(() => {
    const client = {
      generateSyncPreview: mock(() =>
        Promise.resolve({
          groups: { create: [], update: [], close: [] },
          tasks: { create: [], update: [], close: [] },
          milestones: { create: [], update: [], close: [] },
        }),
      ),
      syncToGitHub: mock(() => Promise.resolve([])),
    };
    githubClients.push(client);
    return client;
  }),
}));

import { __generateTesting } from "@/services/generate/io/index.js";
import { GitHubSyncClient } from "@/utils/github/sync/github-sync.js";
import { getSmartRepositoryConfig, validateRepositoryConfig } from "@/utils/io/git-detection.js";

describe("handleGitHubSync", () => {
  beforeEach(() => {
    storageInstances.length = 0;
    githubClients.length = 0;
  });

  it("exits early when repository cannot be determined", async () => {
    (getSmartRepositoryConfig as Mock<typeof getSmartRepositoryConfig>).mockReturnValue(
      null as any,
    );
    const logError = spyOn(console, "error").mockImplementation(() => {});

    await __generateTesting.handleGitHubSync({ githubDryRun: true } as any, { github: {} } as any);

    expect(logError).toHaveBeenCalled();
    expect(GitHubSyncClient as Mock<any>).not.toHaveBeenCalled();
  });

  it("shows dry-run preview using detected groups", async () => {
    (getSmartRepositoryConfig as Mock<typeof getSmartRepositoryConfig>).mockReturnValue({
      repo: { owner: "acme", repo: "shop" },
      source: "config",
    } as any);
    (validateRepositoryConfig as Mock<typeof validateRepositoryConfig>).mockReturnValue({
      valid: true,
      errors: [],
      suggestions: [],
    } as any);

    const consoleLog = spyOn(console, "log").mockImplementation(() => {});

    const groups = [
      { name: "Group A", tasks: [{ name: "Task 1", type: "feature" }] },
      { name: "Group B", tasks: [] },
    ];

    // configure storage mock to return groups
    const storageFactory = (await import("@/utils/github/sharded-storage.js")) as any;
    spyOn(storageFactory, "ShardedCUEStorage").mockImplementation(() => {
      const instance = {
        initialize: mock(() => Promise.resolve(undefined)),
        listGroups: mock(() => Promise.resolve(groups)),
      };
      storageInstances.push(instance);
      return instance;
    });

    // configure GitHub preview output with data to hit loops
    spyOn(await import("@/utils/github/github-sync.js"), "GitHubSyncClient").mockImplementation(
      () => {
        const client = {
          generateSyncPreview: mock(() =>
            Promise.resolve({
              groups: {
                create: [{ name: "New Group" }],
                update: [{ group: { name: "Group A" } }],
                close: [{ group: { name: "Group B", status: "done" } }],
              },
              tasks: {
                create: [{ name: "Task X", type: "bug" }],
                update: [{ task: { name: "Task Y", type: "feature" } }],
                close: [{ task: { name: "Task Z", status: "done", type: "bug" } }],
              },
              milestones: {
                create: [{ name: "MS1" }],
                update: [{ group: { name: "Group B" } }],
                close: [{ group: { name: "Group A", status: "done" } }],
              },
            }),
          ),
          syncToGitHub: mock(() => Promise.resolve()),
        };
        githubClients.push(client);
        return client as any;
      },
    );

    await __generateTesting.handleGitHubSync({ githubDryRun: true } as any, { github: {} } as any);

    expect(storageInstances.at(-1)?.listGroups).toHaveBeenCalled();
    expect(githubClients.at(-1)?.generateSyncPreview).toHaveBeenCalled();
    expect(consoleLog).toHaveBeenCalled();
  });
});
