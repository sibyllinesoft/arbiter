/** @packageDocumentation GitHub sync tests */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GitHubSyncClient } from "@/utils/github/sync/github-sync.js";

// Store original env/cwd for restoration
let originalCwd: string;
let originalGithubToken: string | undefined;
let tmpDir: string | null = null;

beforeEach(() => {
  originalCwd = process.cwd();
  originalGithubToken = process.env.GITHUB_TOKEN;
});

afterEach(async () => {
  process.chdir(originalCwd);
  if (originalGithubToken !== undefined) {
    process.env.GITHUB_TOKEN = originalGithubToken;
  } else {
    delete process.env.GITHUB_TOKEN;
  }
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    tmpDir = null;
  }
});

function makeStubOctokit() {
  const updated: any[] = [];
  const rest = {
    issues: {
      update: async (args: any) => {
        updated.push(args);
        return { data: args };
      },
      listForRepo: {},
      listMilestones: {},
      create: async () => ({
        data: { number: 1, title: "issue", body: "", state: "open", labels: [] },
      }),
    },
  };
  const paginate = async () => [];
  return { rest, paginate, updated };
}

describe("GitHubSyncClient task updates", () => {
  it("updates task when body/title differ", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "arbiter-gh-task-"));
    process.chdir(tmpDir);
    process.env.GITHUB_TOKEN = "token";

    const stub = makeStubOctokit();
    const client = new GitHubSyncClient({
      repository: { owner: "me", repo: "demo" },
      templates: {},
      automation: { syncAssignees: true },
    } as any);

    (client as any).octokit = stub as any;
    (client as any).templateManager = {
      generateGroupTemplate: async (group: any) => ({
        title: `Group: ${group.name}`,
        body: "",
        labels: [],
      }),
      generateTaskTemplate: async (task: any, group: any) => ({
        title: `Task: ${task.title}`,
        body: `Updated body for ${group.id}`,
        labels: ["kind/task"],
      }),
    };

    const group = {
      id: "e-task",
      name: "Group",
      tasks: [{ id: "t1", title: "Task One", status: "active" }],
    } as any;

    // Seed existing issue with stale body/title
    (client as any).syncState.issues["t1"] = 50;
    (client as any).issueCache.set("id:50", {
      number: 50,
      title: "Task: Old title",
      body: "stale",
      state: "open",
      labels: [],
    });

    const results = await (client as any).syncTask(group.tasks[0], group);
    expect(results.some((r: any) => r.action === "updated" && r.type === "task")).toBe(true);
    expect(stub.updated.length).toBe(1);
  });
});
