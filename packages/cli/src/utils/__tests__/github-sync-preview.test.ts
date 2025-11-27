import { beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { GitHubSyncClient } from "../github-sync.js";

const tokenEnv = "GITHUB_TOKEN";

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
    mock.restore();
  });

  it("classifies epics into create/update/close buckets", async () => {
    const client = createClient();

    // Stub template manager to avoid filesystem reads
    (client as any).templateManager = {
      generateEpicTemplate: async (epic: any) => ({
        title: `Epic: ${epic.name || epic.title}`,
        body: "body",
        labels: [],
      }),
      generateTaskTemplate: async (task: any, _epic: any) => ({
        title: `Task: ${task.title}`,
        body: "task body",
        labels: [],
      }),
    };

    // Avoid hitting GitHub; seed caches directly
    (client as any).loadExistingData = async () => {
      (client as any).issueCache.set("Epic: Existing", {
        number: 1,
        title: "Epic: Existing",
        state: "open",
        labels: [],
      });
      (client as any).issueCache.set("arbiter:epic-closed", {
        number: 2,
        title: "Epic: Closed",
        state: "open",
        labels: [],
      });
      (client as any).syncState.issues["epic-closed"] = 2;
    };

    const epics = [
      { id: "epic-new", title: "New", name: "New", tasks: [], status: "active" },
      { id: "epic-update", title: "Existing", name: "Existing", tasks: [], status: "active" },
      { id: "epic-closed", title: "Closed", name: "Closed", tasks: [], status: "completed" },
    ] as any[];

    // Existing epic should be found by title
    (client as any).issueCache.set("Epic: Existing", {
      number: 10,
      title: "Epic: Existing",
      body: "body",
      state: "open",
      labels: [],
    });

    const preview = await client.generateSyncPreview(epics);
    expect(preview.epics.create.map((e) => e.id)).toContain("epic-new");
    expect(preview.epics.update.map((e) => e.epic.id)).toContain("epic-update");
    expect(preview.epics.close.map((e) => e.epic.id)).toContain("epic-closed");
  });

  it("persists sync state when mappings change", async () => {
    const dir = path.join(process.cwd(), ".arbiter");
    await mkdir(dir, { recursive: true });
    const statePath = path.join(dir, "sync-state.json");
    await rm(statePath, { force: true });

    const client = createClient();
    (client as any).templateManager = {
      generateEpicTemplate: async (epic: any) => ({
        title: `Epic: ${epic.id}`,
        body: "",
        labels: [],
      }),
      generateTaskTemplate: async (task: any) => ({ title: task.id, body: "", labels: [] }),
    };
    (client as any).loadExistingData = async () => {};

    const epics = [
      { id: "epic-save", title: "Save", name: "Save", tasks: [], status: "active" },
    ] as any[];
    await client.generateSyncPreview(epics);
    // Force a mapping and save
    (client as any).rememberIssueMapping("epic-save", 42);
    await (client as any).saveSyncState();

    const persisted = JSON.parse(
      await (await import("node:fs/promises")).readFile(statePath, "utf-8"),
    );
    expect(persisted.issues["epic-save"]).toBe(42);
  });
});
