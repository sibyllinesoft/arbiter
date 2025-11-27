import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GitHubSyncClient } from "../github-sync.js";

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
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-gh-task-"));
    const prev = process.cwd();
    process.chdir(tmp);
    process.env.GITHUB_TOKEN = "token";

    try {
      const stub = makeStubOctokit();
      const client = new GitHubSyncClient({
        repository: { owner: "me", repo: "demo" },
        templates: {},
        automation: { syncAssignees: true },
      } as any);

      (client as any).octokit = stub as any;
      (client as any).templateManager = {
        generateEpicTemplate: async (epic: any) => ({
          title: `Epic: ${epic.name}`,
          body: "",
          labels: [],
        }),
        generateTaskTemplate: async (task: any, epic: any) => ({
          title: `Task: ${task.title}`,
          body: `Updated body for ${epic.id}`,
          labels: ["kind/task"],
        }),
      };

      const epic = {
        id: "e-task",
        name: "Epic",
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

      const results = await (client as any).syncTask(epic.tasks[0], epic);
      expect(results.some((r: any) => r.action === "updated" && r.type === "task")).toBe(true);
      expect(stub.updated.length).toBe(1);
    } finally {
      process.chdir(prev);
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
