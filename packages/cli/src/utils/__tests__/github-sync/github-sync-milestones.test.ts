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
  // Restore cwd first
  process.chdir(originalCwd);
  // Restore env
  if (originalGithubToken !== undefined) {
    process.env.GITHUB_TOKEN = originalGithubToken;
  } else {
    delete process.env.GITHUB_TOKEN;
  }
  // Clean up temp dir
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    tmpDir = null;
  }
});

function makeStubOctokit() {
  const createdMilestones: any[] = [];
  const updatedMilestones: any[] = [];

  const rest = {
    issues: {
      listForRepo: {},
      listMilestones: {},
      createMilestone: async (args: any) => {
        createdMilestones.push(args);
        return {
          data: { number: 7, title: args.title, description: args.description, state: "open" },
        };
      },
      updateMilestone: async (args: any) => {
        updatedMilestones.push(args);
        return { data: args };
      },
      create: async () => ({
        data: { number: 1, title: "issue", body: "", state: "open", labels: [] },
      }),
      update: async () => ({ data: { state: "open", labels: [] } }),
    },
  };

  const paginate = async () => [];
  return { rest, paginate, createdMilestones, updatedMilestones };
}

describe("GitHubSyncClient milestones", () => {
  it("creates and updates milestones when enabled", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "arbiter-gh-milestone-"));
    process.chdir(tmpDir);
    process.env.GITHUB_TOKEN = "token";

    const stub = makeStubOctokit();
    const client = new GitHubSyncClient({
      repository: { owner: "me", repo: "demo" },
      templates: {},
      automation: { createMilestones: true, autoClose: false },
    } as any);

    (client as any).octokit = stub as any;
    (client as any).templateManager = {
      generateGroupTemplate: async (group: any) => ({
        title: `Group: ${group.name}`,
        body: `<!-- arbiter-id: ${group.id} -->`,
        labels: [],
      }),
      generateTaskTemplate: async () => ({ title: "task", body: "task", labels: [] }),
    };

    const group = {
      id: "e-milestone",
      name: "Milestone Group",
      title: "Milestone Group",
      tasks: [],
      status: "active",
      description: "first",
    } as any;

    // First sync creates milestone
    const first = await (client as any).syncGroup(group);
    expect(first.some((r: any) => r.action === "created" && r.type === "milestone")).toBe(true);
    expect(stub.createdMilestones.length).toBe(1);

    // Seed cache/state to simulate existing milestone then update with changed description
    (client as any).milestoneCache.set("Group: Milestone Group", {
      number: 7,
      title: "Group: Milestone Group",
      state: "open",
      description: "first",
    });
    (client as any).syncState.milestones["e-milestone"] = 7;

    const updatedGroup = { ...group, description: "second" };
    const second = await (client as any).syncGroup(updatedGroup);
    expect(second.some((r: any) => r.action === "updated" && r.type === "milestone")).toBe(true);
    expect(stub.updatedMilestones.length).toBe(1);
  });

  it("closes milestone when group is cancelled and autoClose enabled", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "arbiter-gh-milestone-close-"));
    process.chdir(tmpDir);
    process.env.GITHUB_TOKEN = "token";

    const stub = makeStubOctokit();
    const client = new GitHubSyncClient({
      repository: { owner: "me", repo: "demo" },
      templates: {},
      automation: { createMilestones: true, autoClose: true },
    } as any);

    (client as any).octokit = stub as any;
    (client as any).templateManager = {
      generateGroupTemplate: async (group: any) => ({
        title: `Group: ${group.name}`,
        body: `<!-- arbiter-id: ${group.id} -->`,
        labels: [],
      }),
      generateTaskTemplate: async () => ({ title: "task", body: "task", labels: [] }),
    };

    // Seed existing milestone
    (client as any).milestoneCache.set("Group: Close", {
      number: 9,
      title: "Group: Close",
      state: "open",
      description: "desc",
    });
    (client as any).syncState.milestones["e-close"] = 9;

    const group = {
      id: "e-close",
      name: "Close",
      title: "Close",
      tasks: [],
      status: "cancelled",
      description: "desc",
    } as any;

    const results = await (client as any).syncGroup(group);
    expect(results.some((r: any) => r.action === "closed" && r.type === "milestone")).toBe(true);
    expect(stub.updatedMilestones.some((u) => u.state === "closed")).toBe(true);
  });
});
