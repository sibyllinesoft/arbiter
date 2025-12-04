import { afterAll, afterEach, describe, expect, it, mock } from "bun:test";

const execMock = mock(() => {
  throw new Error("no remote");
});

mock.module("node:child_process", () => ({
  __esModule: true,
  execSync: execMock,
}));

const gitModulePromise = import("@/utils/git-detection.js");

afterEach(() => {
  execMock.mockReset();
  execMock.mockImplementation(() => {
    throw new Error("no remote");
  });
});

afterAll(() => {
  mock.restore();
});

describe("git detection helpers", () => {
  it("parses https and ssh GitHub URLs", async () => {
    const { parseGitHubUrl, detectRepositoryConflicts, resolveRepositorySelection } =
      await gitModulePromise;

    const https = parseGitHubUrl("https://github.com/acme/api.git");
    expect(https).toMatchObject({ owner: "acme", repo: "api", type: "https" });

    const ssh = parseGitHubUrl("git@github.com:foo/bar.git");
    expect(ssh).toMatchObject({ owner: "foo", repo: "bar", type: "ssh" });

    expect(parseGitHubUrl("https://example.com/repo")).toBeNull();

    const conflict = detectRepositoryConflicts(
      { owner: "me", repo: "app", tokenEnv: "GITHUB_TOKEN" },
      { owner: "them", repo: "app", url: "u", type: "https" },
    )!;
    expect(conflict.conflictType).toBe("owner");

    const selection = resolveRepositorySelection(conflict, { useGitRemote: true });
    expect(selection.useDetected).toBe(true);
  });

  it("detects GitHub repository from git remote", async () => {
    execMock.mockImplementation(() => "https://github.com/acme/repo.git\n");
    const { detectGitHubRepository } = await gitModulePromise;
    const result = detectGitHubRepository();

    expect(execMock).toHaveBeenCalled();
    expect(result.detected).toBe(true);
    expect(result.remote).toMatchObject({ owner: "acme", repo: "repo", type: "https" });
  });

  it("returns failure details when git detection throws", async () => {
    execMock.mockImplementation(() => {
      throw new Error("fatal: not a git repo");
    });
    const { detectGitHubRepository } = await gitModulePromise;
    const result = detectGitHubRepository();

    expect(result.detected).toBe(false);
    expect(result.error).toContain("fatal");
  });

  it("marks detection as non-GitHub when remote URL is not GitHub", async () => {
    execMock.mockImplementation(() => "https://gitlab.com/foo/bar.git\n");
    const { detectGitHubRepository } = await gitModulePromise;
    const result = detectGitHubRepository();

    expect(result.detected).toBe(false);
    expect(result.error).toContain("not a GitHub repository");
  });

  it("merges config and detection to pick the right repo", async () => {
    const { getSmartRepositoryConfig } = await gitModulePromise;
    execMock.mockImplementation(() => "https://github.com/foo/bar.git\n");

    const verboseCalls: any[] = [];
    const originalLog = console.log;
    console.log = ((...args: any[]) => verboseCalls.push(args)) as any;

    const configRepo = { owner: "foo", repo: "bar", tokenEnv: "TOKEN" };
    const result = getSmartRepositoryConfig(configRepo, { verbose: true });
    expect(result?.source).toBe("config");
    expect(verboseCalls.length).toBeGreaterThan(0);

    execMock.mockImplementation(() => "https://github.com/foo/other.git\n");
    const conflictResult = getSmartRepositoryConfig(configRepo, { useGitRemote: true });
    expect(conflictResult?.repo.repo).toBe("other");
    expect(conflictResult?.source).toBe("detected");

    console.log = originalLog;
  });

  it("falls back to config or null when detection fails", async () => {
    const { getSmartRepositoryConfig } = await gitModulePromise;
    execMock.mockImplementation(() => {
      throw new Error("no git");
    });

    const verboseCalls: any[] = [];
    const originalLog = console.log;
    console.log = ((...args: any[]) => verboseCalls.push(args)) as any;

    const configRepo = { owner: "cfg", repo: "repo", tokenEnv: "TOKEN" };
    const configResult = getSmartRepositoryConfig(configRepo, { verbose: true });
    expect(configResult?.source).toBe("config");
    expect(verboseCalls.length).toBeGreaterThan(0);

    const nullResult = getSmartRepositoryConfig(undefined, { verbose: true });
    expect(nullResult).toBeNull();

    console.log = originalLog;
  });

  it("validates and builds repository configs with suggestions", async () => {
    const { validateRepositoryConfig, createRepositoryConfig, displayConflictResolution } =
      await gitModulePromise;

    const repo = createRepositoryConfig("me/you", "repo.git", { baseUrl: "http://bad" });
    const validation = validateRepositoryConfig(repo as any);

    expect(validation.valid).toBe(false);
    expect(validation.errors.some((e) => e.includes("https"))).toBe(true);
    expect(validation.suggestions.some((s) => s.includes("Did you mean"))).toBe(true);

    const conflict = {
      configRepo: { owner: "me", repo: "one", tokenEnv: "TOKEN" },
      detectedRepo: { owner: "you", repo: "two", url: "https://github.com/you/two", type: "https" },
      conflictType: "both" as const,
    };
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: any[]) => logs.push(args.join(" "));
    displayConflictResolution(conflict);
    expect(logs.join(" ")).toContain("Repository Configuration Conflict");
    console.log = originalLog;
  });
});
