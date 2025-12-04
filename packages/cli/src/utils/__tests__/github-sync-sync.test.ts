import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GitHubSyncClient } from "@/utils/github-sync.js";

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
  it("creates, updates, and closes epics and tasks using octokit", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-gh-sync-"));
    const prev = process.cwd();
    process.chdir(tmp);
    process.env.GITHUB_TOKEN = "token";

    try {
      const stub = makeStubOctokit();
      const client = new GitHubSyncClient({
        repository: { owner: "me", repo: "demo" },
        templates: {},
        automation: { syncAssignees: true, createMilestones: false, autoClose: true },
      } as any);

      // Override internals for determinism
      (client as any).octokit = stub as any;
      (client as any).templateManager = {
        generateEpicTemplate: async (epic: any) => ({
          title: `Epic: ${epic.name}`,
          body: `<!-- arbiter-id: ${epic.id} --> body`,
          labels: ["kind/epic"],
          assignees: ["alice"],
        }),
        generateTaskTemplate: async () => ({ title: "task", body: "task", labels: [] }),
      };

      const epic = {
        id: "e1",
        name: "One",
        title: "One",
        tasks: [{ id: "t1", title: "Task 1", status: "active" }],
        status: "active",
        description: "d",
      } as any;

      // Create path
      const createdResults = await (client as any).syncEpic(epic);
      expect(createdResults.some((r: any) => r.action === "created")).toBe(true);
      expect(stub.created.length).toBe(1);

      // Task create
      const taskCreate = await (client as any).syncTask(epic.tasks[0], epic);
      expect(taskCreate.some((r: any) => r.action === "created")).toBe(true);

      // Update path (mapped issue, different title/body)
      (client as any).syncState.issues["e1"] = 99;
      (client as any).issueCache.set("id:99", {
        number: 99,
        title: "Epic: Old",
        body: "stale",
        state: "open",
        labels: [],
      });
      const updatedEpic = { ...epic, name: "One Renamed" };
      const updatedResults = await (client as any).syncEpic(updatedEpic);
      expect(updatedResults.some((r: any) => r.action === "updated")).toBe(true);
      expect(stub.updated.length).toBeGreaterThanOrEqual(1);

      // Close path
      (client as any).issueCache.set("id:99", {
        number: 99,
        title: "Epic: One Renamed",
        body: "body",
        state: "open",
        labels: [],
      });
      const closedEpic = { ...updatedEpic, status: "completed" };
      const closedResults = await (client as any).syncEpic(closedEpic);
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
        { ...epic.tasks[0], status: "completed" },
        updatedEpic,
      );
      expect(closedTaskResults.some((r: any) => r.action === "closed" && r.type === "task")).toBe(
        true,
      );
    } finally {
      process.chdir(prev);
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
