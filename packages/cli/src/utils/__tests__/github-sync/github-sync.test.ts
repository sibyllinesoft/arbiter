/** @packageDocumentation GitHub sync tests */
import { describe, expect, it } from "bun:test";
import { GitHubSyncClient } from "@/utils/github/sync/github-sync.js";

describe("GitHubSyncClient", () => {
  it("constructs when token env exists", () => {
    const tokenEnv = "NON_EXISTENT_ENV";
    process.env[tokenEnv] = "token";
    const client = new GitHubSyncClient({
      repository: { owner: "me", repo: "demo", tokenEnv },
      templates: {},
    } as any);
    expect(client).toBeInstanceOf(GitHubSyncClient);
    delete process.env[tokenEnv];
  });

  it("throws when token env is missing", () => {
    const originalToken = process.env.GITHUB_TOKEN;
    const originalArb = process.env.ARBITER_GITHUB_TOKEN;
    const customVar = "NON_EXISTENT_ENV";
    const originalCustom = process.env[customVar];
    delete process.env.GITHUB_TOKEN;
    delete process.env.ARBITER_GITHUB_TOKEN;
    delete process.env[customVar];

    expect(() => {
      new GitHubSyncClient({
        repository: { owner: "me", repo: "demo", tokenEnv: customVar },
        templates: {},
      } as any);
    }).toThrow(/token/i);

    // restore env
    if (originalToken !== undefined) process.env.GITHUB_TOKEN = originalToken;
    if (originalArb !== undefined) process.env.ARBITER_GITHUB_TOKEN = originalArb;
    if (originalCustom !== undefined) process.env[customVar] = originalCustom;
  });
});
