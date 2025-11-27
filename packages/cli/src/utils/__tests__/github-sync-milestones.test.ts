import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GitHubSyncClient } from "../github-sync.js";

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
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-gh-milestone-"));
    const prev = process.cwd();
    process.chdir(tmp);
    process.env.GITHUB_TOKEN = "token";

    try {
      const stub = makeStubOctokit();
      const client = new GitHubSyncClient({
        repository: { owner: "me", repo: "demo" },
        templates: {},
        automation: { createMilestones: true, autoClose: false },
      } as any);

      (client as any).octokit = stub as any;
      (client as any).templateManager = {
        generateEpicTemplate: async (epic: any) => ({
          title: `Epic: ${epic.name}`,
          body: `<!-- arbiter-id: ${epic.id} -->`,
          labels: [],
        }),
        generateTaskTemplate: async () => ({ title: "task", body: "task", labels: [] }),
      };

      const epic = {
        id: "e-milestone",
        name: "Milestone Epic",
        title: "Milestone Epic",
        tasks: [],
        status: "active",
        description: "first",
      } as any;

      // First sync creates milestone
      const first = await (client as any).syncEpic(epic);
      expect(first.some((r: any) => r.action === "created" && r.type === "milestone")).toBe(true);
      expect(stub.createdMilestones.length).toBe(1);

      // Seed cache/state to simulate existing milestone then update with changed description
      (client as any).milestoneCache.set("Epic: Milestone Epic", {
        number: 7,
        title: "Epic: Milestone Epic",
        state: "open",
        description: "first",
      });
      (client as any).syncState.milestones["e-milestone"] = 7;

      const updatedEpic = { ...epic, description: "second" };
      const second = await (client as any).syncEpic(updatedEpic);
      expect(second.some((r: any) => r.action === "updated" && r.type === "milestone")).toBe(true);
      expect(stub.updatedMilestones.length).toBe(1);
    } finally {
      process.chdir(prev);
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("closes milestone when epic is cancelled and autoClose enabled", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-gh-milestone-close-"));
    const prev = process.cwd();
    process.chdir(tmp);
    process.env.GITHUB_TOKEN = "token";

    try {
      const stub = makeStubOctokit();
      const client = new GitHubSyncClient({
        repository: { owner: "me", repo: "demo" },
        templates: {},
        automation: { createMilestones: true, autoClose: true },
      } as any);

      (client as any).octokit = stub as any;
      (client as any).templateManager = {
        generateEpicTemplate: async (epic: any) => ({
          title: `Epic: ${epic.name}`,
          body: `<!-- arbiter-id: ${epic.id} -->`,
          labels: [],
        }),
        generateTaskTemplate: async () => ({ title: "task", body: "task", labels: [] }),
      };

      // Seed existing milestone
      (client as any).milestoneCache.set("Epic: Close", {
        number: 9,
        title: "Epic: Close",
        state: "open",
        description: "desc",
      });
      (client as any).syncState.milestones["e-close"] = 9;

      const epic = {
        id: "e-close",
        name: "Close",
        title: "Close",
        tasks: [],
        status: "cancelled",
        description: "desc",
      } as any;

      const results = await (client as any).syncEpic(epic);
      expect(results.some((r: any) => r.action === "closed" && r.type === "milestone")).toBe(true);
      expect(stub.updatedMilestones.some((u) => u.state === "closed")).toBe(true);
    } finally {
      process.chdir(prev);
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
