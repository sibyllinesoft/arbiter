/** @packageDocumentation GitHub sync tests */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { GitHubSyncClient } from "@/utils/github/sync/github-sync.js";

const tokenEnv = "GITHUB_TOKEN";
let originalToken: string | undefined;

function createClient(overrides: any = {}): GitHubSyncClient {
  process.env[tokenEnv] = "token";
  const client = new GitHubSyncClient({
    repository: { owner: "me", repo: "demo", tokenEnv },
    templates: {},
    ...overrides,
  } as any);
  return client;
}

describe("GitHubSyncClient preview", () => {
  beforeEach(() => {
    originalToken = process.env[tokenEnv];
    mock.restore();
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env[tokenEnv] = originalToken;
    } else {
      delete process.env[tokenEnv];
    }
  });

  it("classifies groups into create/update/close buckets", async () => {
    const client = createClient();

    // Stub template manager to avoid filesystem reads
    (client as any).templateManager = {
      generateGroupTemplate: async (group: any) => ({
        title: `Group: ${group.name || group.title}`,
        body: "body",
        labels: [],
      }),
      generateTaskTemplate: async (task: any, _group: any) => ({
        title: `Task: ${task.title}`,
        body: "task body",
        labels: [],
      }),
    };

    // Avoid hitting GitHub; seed caches directly
    (client as any).loadExistingData = async () => {
      (client as any).issueCache.set("Group: Existing", {
        number: 1,
        title: "Group: Existing",
        state: "open",
        labels: [],
      });
      (client as any).issueCache.set("arbiter:group-closed", {
        number: 2,
        title: "Group: Closed",
        state: "open",
        labels: [],
      });
      (client as any).syncState.issues["group-closed"] = 2;
    };

    const groups = [
      { id: "group-new", title: "New", name: "New", tasks: [], status: "active" },
      { id: "group-update", title: "Existing", name: "Existing", tasks: [], status: "active" },
      { id: "group-closed", title: "Closed", name: "Closed", tasks: [], status: "completed" },
    ] as any[];

    // Existing group should be found by title
    (client as any).issueCache.set("Group: Existing", {
      number: 10,
      title: "Group: Existing",
      body: "body",
      state: "open",
      labels: [],
    });

    const preview = await client.generateSyncPreview(groups);
    expect(preview.groups.create.map((e) => e.id)).toContain("group-new");
    expect(preview.groups.update.map((e) => e.group.id)).toContain("group-update");
    expect(preview.groups.close.map((e) => e.group.id)).toContain("group-closed");
  });

  it("persists sync state when mappings change", async () => {
    const dir = path.join(process.cwd(), ".arbiter");
    await mkdir(dir, { recursive: true });
    const statePath = path.join(dir, "sync-state.json");
    await rm(statePath, { force: true });

    const client = createClient();
    (client as any).templateManager = {
      generateGroupTemplate: async (group: any) => ({
        title: `Group: ${group.id}`,
        body: "",
        labels: [],
      }),
      generateTaskTemplate: async (task: any) => ({ title: task.id, body: "", labels: [] }),
    };
    (client as any).loadExistingData = async () => {};

    const groups = [
      { id: "group-save", title: "Save", name: "Save", tasks: [], status: "active" },
    ] as any[];
    await client.generateSyncPreview(groups);
    // Force a mapping and save
    (client as any).rememberIssueMapping("group-save", 42);
    await (client as any).saveSyncState();

    const persisted = JSON.parse(
      await (await import("node:fs/promises")).readFile(statePath, "utf-8"),
    );
    expect(persisted.issues["group-save"]).toBe(42);
  });
});
