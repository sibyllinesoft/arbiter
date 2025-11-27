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

describe("GitHubSyncClient task autoClose", () => {
  it("closes task issue when task is completed and autoClose enabled", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-gh-task-close-"));
    const prev = process.cwd();
    process.chdir(tmp);
    process.env.GITHUB_TOKEN = "token";

    try {
      const stub = makeStubOctokit();
      const client = new GitHubSyncClient({
        repository: { owner: "me", repo: "demo" },
        templates: {},
        automation: { autoClose: true },
      } as any);

      (client as any).octokit = stub as any;
      (client as any).templateManager = {
        generateEpicTemplate: async (epic: any) => ({
          title: `Epic: ${epic.name}`,
          body: "",
          labels: [],
        }),
        generateTaskTemplate: async (task: any) => ({
          title: `Task: ${task.title}`,
          body: "body",
          labels: [],
        }),
      };

      const epic = { id: "e-close", name: "Close", tasks: [], status: "active" } as any;
      const task = {
        id: "t-close",
        title: "Close Task",
        status: "completed",
        priority: "low",
        type: "feature",
      } as any;

      // seed existing issue
      (client as any).syncState.issues["t-close"] = 55;
      (client as any).issueCache.set("id:55", {
        number: 55,
        title: "Task: Close Task",
        body: "body",
        state: "open",
        labels: [],
      });

      const results = await (client as any).syncTask(task, epic);
      expect(results.some((r: any) => r.action === "closed" && r.type === "task")).toBe(true);
      expect(stub.updated.some((u) => u.state === "closed")).toBe(true);
    } finally {
      process.chdir(prev);
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
