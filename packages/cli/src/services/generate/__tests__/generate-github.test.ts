import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageInstances: any[] = [];
const githubClients: any[] = [];

vi.mock("../../utils/git-detection.js", () => ({
  getSmartRepositoryConfig: vi.fn(),
  validateRepositoryConfig: vi.fn(),
}));

vi.mock("../../utils/sharded-storage.js", () => ({
  ShardedCUEStorage: vi.fn().mockImplementation(() => {
    const instance = {
      initialize: vi.fn().mockResolvedValue(undefined),
      listEpics: vi.fn().mockResolvedValue([]),
    };
    storageInstances.push(instance);
    return instance;
  }),
}));

vi.mock("../../utils/github-sync.js", () => ({
  GitHubSyncClient: vi.fn().mockImplementation(() => {
    const client = {
      generateSyncPreview: vi.fn().mockResolvedValue({
        epics: { create: [], update: [], close: [] },
        tasks: { create: [], update: [], close: [] },
        milestones: { create: [], update: [], close: [] },
      }),
      syncToGitHub: vi.fn().mockResolvedValue([]),
    };
    githubClients.push(client);
    return client;
  }),
}));

import { getSmartRepositoryConfig, validateRepositoryConfig } from "../../utils/git-detection.js";
import { GitHubSyncClient } from "../../utils/github-sync.js";
import { __generateTesting } from "../index.js";

describe("handleGitHubSync", () => {
  beforeEach(() => {
    storageInstances.length = 0;
    githubClients.length = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exits early when repository cannot be determined", async () => {
    vi.mocked(getSmartRepositoryConfig).mockReturnValue(null as any);
    const logError = vi.spyOn(console, "error").mockImplementation(() => {});

    await __generateTesting.handleGitHubSync({ githubDryRun: true } as any, { github: {} } as any);

    expect(logError).toHaveBeenCalled();
    expect(vi.mocked(GitHubSyncClient)).not.toHaveBeenCalled();
  });

  it("shows dry-run preview using detected epics", async () => {
    vi.mocked(getSmartRepositoryConfig).mockReturnValue({
      repo: { owner: "acme", repo: "shop" },
      source: "config",
    } as any);
    vi.mocked(validateRepositoryConfig).mockReturnValue({
      valid: true,
      errors: [],
      suggestions: [],
    } as any);

    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});

    const epics = [
      { name: "Epic A", tasks: [{ name: "Task 1", type: "feature" }] },
      { name: "Epic B", tasks: [] },
    ];

    // configure storage mock to return epics
    const storageFactory = (await import("../../utils/sharded-storage.js")) as any;
    vi.spyOn(storageFactory, "ShardedCUEStorage").mockImplementation(() => {
      const instance = {
        initialize: vi.fn().mockResolvedValue(undefined),
        listEpics: vi.fn().mockResolvedValue(epics),
      };
      storageInstances.push(instance);
      return instance;
    });

    // configure GitHub preview output with data to hit loops
    vi.spyOn(await import("../../utils/github-sync.js"), "GitHubSyncClient").mockImplementation(
      () => {
        const client = {
          generateSyncPreview: vi.fn().mockResolvedValue({
            epics: {
              create: [{ name: "New Epic" }],
              update: [{ epic: { name: "Epic A" } }],
              close: [{ epic: { name: "Epic B", status: "done" } }],
            },
            tasks: {
              create: [{ name: "Task X", type: "bug" }],
              update: [{ task: { name: "Task Y", type: "feature" } }],
              close: [{ task: { name: "Task Z", status: "done", type: "bug" } }],
            },
            milestones: {
              create: [{ name: "MS1" }],
              update: [{ epic: { name: "Epic B" } }],
              close: [{ epic: { name: "Epic A", status: "done" } }],
            },
          }),
          syncToGitHub: vi.fn(),
        };
        githubClients.push(client);
        return client as any;
      },
    );

    await __generateTesting.handleGitHubSync({ githubDryRun: true } as any, { github: {} } as any);

    expect(storageInstances.at(-1)?.listEpics).toHaveBeenCalled();
    expect(githubClients.at(-1)?.generateSyncPreview).toHaveBeenCalled();
    expect(consoleLog).toHaveBeenCalled();
  });
});
