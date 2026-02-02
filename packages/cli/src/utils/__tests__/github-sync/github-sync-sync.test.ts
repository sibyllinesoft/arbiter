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
  const created: any[] = [];
  const updated: any[] = [];

  const rest = {
    issues: {
      create: async (args: any) => {
        created.push(args);
        return {
          data: {
            number: 42,
            title: args.title,
            body: args.body,
            state: "open",
            labels: args.labels || [],
          },
        };
      },
      update: async (args: any) => {
        updated.push(args);
        return { data: { ...args, state: args.state || "open", labels: args.labels || [] } };
      },
      listForRepo: {},
      listMilestones: {},
      updateMilestone: async (args: any) => {
        updated.push(args);
        return { data: args };
      },
      createMilestone: async () => ({ data: { number: 5, title: "m" } }),
    },
  };

  const paginate = async () => [];

  return { rest, paginate, created, updated };
}

describe("GitHubSyncClient sync flows", () => {
  it("creates, updates, and closes groups and tasks using octokit", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "arbiter-gh-sync-"));
    process.chdir(tmpDir);
    process.env.GITHUB_TOKEN = "token";

    const stub = makeStubOctokit();
    const client = new GitHubSyncClient({
      repository: { owner: "me", repo: "demo" },
      templates: {},
      automation: { syncAssignees: true, createMilestones: false, autoClose: true },
    } as any);

    // Override internals for determinism
    (client as any).octokit = stub as any;
    (client as any).templateManager = {
      generateGroupTemplate: async (group: any) => ({
        title: `Group: ${group.name}`,
        body: `<!-- arbiter-id: ${group.id} --> body`,
        labels: ["kind/group"],
        assignees: ["alice"],
      }),
      generateTaskTemplate: async () => ({ title: "task", body: "task", labels: [] }),
    };

    const group = {
      id: "e1",
      name: "One",
      title: "One",
      tasks: [{ id: "t1", title: "Task 1", status: "active" }],
      status: "active",
      description: "d",
    } as any;

    // Create path
    const createdResults = await (client as any).syncGroup(group);
    expect(createdResults.some((r: any) => r.action === "created")).toBe(true);
    expect(stub.created.length).toBe(1);

    // Task create
    const taskCreate = await (client as any).syncTask(group.tasks[0], group);
    expect(taskCreate.some((r: any) => r.action === "created")).toBe(true);

    // Update path (mapped issue, different title/body)
    (client as any).syncState.issues["e1"] = 99;
    (client as any).issueCache.set("id:99", {
      number: 99,
      title: "Group: Old",
      body: "stale",
      state: "open",
      labels: [],
    });
    const updatedGroup = { ...group, name: "One Renamed" };
    const updatedResults = await (client as any).syncGroup(updatedGroup);
    expect(updatedResults.some((r: any) => r.action === "updated")).toBe(true);
    expect(stub.updated.length).toBeGreaterThanOrEqual(1);

    // Close path
    (client as any).issueCache.set("id:99", {
      number: 99,
      title: "Group: One Renamed",
      body: "body",
      state: "open",
      labels: [],
    });
    const closedGroup = { ...updatedGroup, status: "completed" };
    const closedResults = await (client as any).syncGroup(closedGroup);
    expect(closedResults.some((r: any) => r.action === "closed")).toBe(true);
    expect(stub.updated.some((u) => u.state === "closed")).toBe(true);

    // Task close path
    (client as any).syncState.issues["t1"] = 77;
    (client as any).issueCache.set("id:77", {
      number: 77,
      title: "Task: Task 1",
      body: "body",
      state: "open",
      labels: [],
    });
    const closedTaskResults = await (client as any).syncTask(
      { ...group.tasks[0], status: "completed" },
      updatedGroup,
    );
    expect(closedTaskResults.some((r: any) => r.action === "closed" && r.type === "task")).toBe(
      true,
    );
  });
});
