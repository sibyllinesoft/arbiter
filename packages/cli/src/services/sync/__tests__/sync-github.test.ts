import path from "node:path";
import fs from "fs-extra";
import { Mock, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Store mock functions for assertions
let mockDetectGitHubRepository: Mock;
let mockGitHubSyncClient: Mock;
let mockGenerateSyncPreview: Mock;
let mockSyncToGitHub: Mock;

// Mock the GitHub sync dependencies
vi.mock("@/utils/io/git-detection.js", () => {
  mockDetectGitHubRepository = vi.fn().mockReturnValue({
    detected: false,
    error: "Not in a git repository",
  });
  return {
    detectGitHubRepository: mockDetectGitHubRepository,
  };
});

vi.mock("@/utils/github/sync/github-sync.js", () => {
  mockGenerateSyncPreview = vi.fn().mockResolvedValue({
    groups: { create: [], update: [], close: [] },
    tasks: { create: [], update: [], close: [] },
    milestones: { create: [], update: [], close: [] },
  });
  mockSyncToGitHub = vi.fn().mockResolvedValue([]);
  mockGitHubSyncClient = vi.fn().mockImplementation(() => ({
    generateSyncPreview: mockGenerateSyncPreview,
    syncToGitHub: mockSyncToGitHub,
  }));
  return {
    GitHubSyncClient: mockGitHubSyncClient,
  };
});

// Only import Group type from sharded-storage (no mock needed for the class)
vi.mock("@/utils/github/sharded-storage.js", () => ({}));

vi.mock("@/utils/storage/markdown-storage.js", () => ({
  MarkdownStorage: vi.fn().mockImplementation(() => ({
    isInitialized: vi.fn().mockResolvedValue(false),
    load: vi.fn().mockResolvedValue({ nodes: new Map(), edges: [] }),
  })),
}));

vi.mock("@/cue/index.js", () => ({
  formatCUE: vi.fn((content) => content),
}));

vi.mock("@/constraints/cli-integration.js", () => ({
  getCueManipulator: vi.fn(() => ({
    parse: vi.fn().mockResolvedValue({}),
    addToSection: vi.fn((content) => content),
    cleanup: vi.fn(),
  })),
}));

import type { CLIConfig, SyncOptions } from "@/types.js";
import { syncProject } from "../index.js";

describe("GitHub Issue Sync", () => {
  const testDir = path.join(process.cwd(), ".test-sync-github");
  const originalEnv = process.env;

  beforeEach(async () => {
    await fs.ensureDir(testDir);
    await fs.ensureDir(path.join(testDir, ".arbiter"));
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await fs.remove(testDir);
    process.env = originalEnv;
  });

  it("skips GitHub sync when --github flag is not provided", async () => {
    const config: CLIConfig = {
      projectDir: testDir,
      localMode: true,
    };

    const options: SyncOptions = {
      dryRun: true,
    };

    // Run sync without --github flag
    await syncProject(options, config);

    // GitHubSyncClient should not be instantiated
    expect(mockGitHubSyncClient).not.toHaveBeenCalled();
  });

  it("skips GitHub sync when GITHUB_TOKEN is not set", async () => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.ARBITER_GITHUB_TOKEN;

    const config: CLIConfig = {
      projectDir: testDir,
      localMode: true,
    };

    const options: SyncOptions = {
      dryRun: true,
      github: true,
    };

    // Mock repo detection
    mockDetectGitHubRepository.mockReturnValue({
      detected: true,
      remote: { owner: "test", repo: "repo", url: "https://github.com/test/repo", type: "https" },
    });

    await syncProject(options, config);

    // GitHubSyncClient should not be instantiated without token
    expect(mockGitHubSyncClient).not.toHaveBeenCalled();
  });

  it("skips GitHub sync when git remote is not detected", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    const config: CLIConfig = {
      projectDir: testDir,
      localMode: true,
    };

    const options: SyncOptions = {
      dryRun: true,
      github: true,
    };

    // Mock failed repo detection
    mockDetectGitHubRepository.mockReturnValue({
      detected: false,
      error: "Not a git repository",
    });

    await syncProject(options, config);

    // GitHubSyncClient should not be instantiated without repo
    expect(mockGitHubSyncClient).not.toHaveBeenCalled();
  });

  it("skips GitHubSyncClient when no groups/tasks are found", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    const config: CLIConfig = {
      projectDir: testDir,
      localMode: true,
    };

    const options: SyncOptions = {
      dryRun: true,
      github: true,
    };

    // Mock successful repo detection
    mockDetectGitHubRepository.mockReturnValue({
      detected: true,
      remote: {
        owner: "myorg",
        repo: "myproject",
        url: "https://github.com/myorg/myproject",
        type: "https",
      },
    });

    await syncProject(options, config);

    // GitHubSyncClient should NOT be instantiated when no groups are found
    // This is the correct behavior - no need to call GitHub API if nothing to sync
    expect(mockGitHubSyncClient).not.toHaveBeenCalled();
  });

  it("requires GITHUB_TOKEN even with valid repo detection", async () => {
    // Clear token
    delete process.env.GITHUB_TOKEN;
    delete process.env.ARBITER_GITHUB_TOKEN;

    mockDetectGitHubRepository.mockReturnValue({
      detected: true,
      remote: { owner: "test", repo: "repo", url: "https://github.com/test/repo", type: "https" },
    });

    const config: CLIConfig = {
      projectDir: testDir,
      localMode: true,
    };

    const options: SyncOptions = {
      dryRun: true,
      github: true,
    };

    await syncProject(options, config);

    // Token is checked before repo detection result is used
    expect(mockGitHubSyncClient).not.toHaveBeenCalled();
  });

  it("completes sync without errors when --github is enabled but no tasks exist", async () => {
    process.env.GITHUB_TOKEN = "test-token";

    mockDetectGitHubRepository.mockReturnValue({
      detected: true,
      remote: { owner: "test", repo: "repo", url: "https://github.com/test/repo", type: "https" },
    });

    const config: CLIConfig = {
      projectDir: testDir,
      localMode: true,
    };

    const options: SyncOptions = {
      dryRun: false,
      github: true,
    };

    // Should complete without throwing
    const result = await syncProject(options, config);
    expect(result).toBe(0); // Success exit code
  });
});
