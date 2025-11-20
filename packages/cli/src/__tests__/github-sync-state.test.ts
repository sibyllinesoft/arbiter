import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { GitHubSyncClient } from "../utils/github-sync.js";
import type { GitHubIssue } from "../utils/github-sync.js";

const originalCwd = process.cwd();
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "arbiter-ghsync-"));
const syncStatePath = path.join(tempDir, ".arbiter", "sync-state.json");

beforeAll(() => {
  // Ensure dummy token is available for Octokit initialization
  process.env.GITHUB_TOKEN = process.env.GITHUB_TOKEN || "test-token";
  fs.ensureDirSync(path.dirname(syncStatePath));
  fs.writeJsonSync(syncStatePath, {
    repository: { owner: "me", repo: "demo" },
    issues: { "arbiter-123": 42 },
    milestones: {},
  });
  process.chdir(tempDir);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.removeSync(tempDir);
});

describe("GitHub sync state persistence", () => {
  it("uses local sync-state mapping even if titles/comments change", () => {
    const client = new GitHubSyncClient({ repository: { owner: "me", repo: "demo" } });

    // Seed cache only by GitHub number to simulate title/body changes
    const alteredIssue: GitHubIssue = {
      number: 42,
      title: "Renamed issue in GitHub",
      state: "open",
      labels: [],
    };
    (client as any).issueCache.set("id:42", alteredIssue);

    const found = (client as any).findExistingIssue("Original Arbiter Title", "arbiter-123");
    expect(found).not.toBeUndefined();
    expect(found.number).toBe(42);
  });
});
