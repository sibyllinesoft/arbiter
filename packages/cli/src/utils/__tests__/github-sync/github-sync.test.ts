/** @packageDocumentation GitHub sync tests */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { GitHubSyncClient } from "@/utils/github/sync/github-sync.js";

// Store original env for restoration
let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    ARBITER_GITHUB_TOKEN: process.env.ARBITER_GITHUB_TOKEN,
  };
});

afterEach(() => {
  // Restore all saved env vars
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value !== undefined) {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
});

describe("GitHubSyncClient", () => {
  it("constructs when token env exists", () => {
    const tokenEnv = "TEST_GH_TOKEN_UNIQUE";
    process.env[tokenEnv] = "token";
    savedEnv[tokenEnv] = undefined; // Mark for cleanup

    const client = new GitHubSyncClient({
      repository: { owner: "me", repo: "demo", tokenEnv },
      templates: {},
    } as any);
    expect(client).toBeInstanceOf(GitHubSyncClient);
  });

  it("throws when token env is missing", () => {
    const customVar = "TEST_GH_TOKEN_MISSING";
    delete process.env.GITHUB_TOKEN;
    delete process.env.ARBITER_GITHUB_TOKEN;
    delete process.env[customVar];

    expect(() => {
      new GitHubSyncClient({
        repository: { owner: "me", repo: "demo", tokenEnv: customVar },
        templates: {},
      } as any);
    }).toThrow(/token/i);
  });
});
