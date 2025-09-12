import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  parseGitHubUrl, 
  detectRepositoryConflicts, 
  validateRepositoryConfig,
  createRepositoryConfig,
  getSmartRepositoryConfig 
} from "../git-detection.js";
import type { GitHubRepo } from "../../types.js";

describe("git-detection", () => {
  describe("parseGitHubUrl", () => {
    it("should parse HTTPS GitHub URLs", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo.git");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo", 
        url: "https://github.com/owner/repo.git",
        type: "https"
      });
    });

    it("should parse HTTPS GitHub URLs without .git extension", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        url: "https://github.com/owner/repo", 
        type: "https"
      });
    });

    it("should parse SSH GitHub URLs", () => {
      const result = parseGitHubUrl("git@github.com:owner/repo.git");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        url: "git@github.com:owner/repo.git",
        type: "ssh"
      });
    });

    it("should parse SSH GitHub URLs without .git extension", () => {
      const result = parseGitHubUrl("git@github.com:owner/repo");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        url: "git@github.com:owner/repo",
        type: "ssh"
      });
    });

    it("should return null for non-GitHub URLs", () => {
      expect(parseGitHubUrl("https://gitlab.com/owner/repo.git")).toBeNull();
      expect(parseGitHubUrl("https://bitbucket.org/owner/repo.git")).toBeNull();
      expect(parseGitHubUrl("not-a-url")).toBeNull();
    });
  });

  describe("detectRepositoryConflicts", () => {
    it("should return null when there are no conflicts", () => {
      const configRepo: GitHubRepo = { owner: "owner", repo: "repo" };
      const detectedRepo = {
        owner: "owner",
        repo: "repo",
        url: "https://github.com/owner/repo.git",
        type: "https" as const
      };

      const conflict = detectRepositoryConflicts(configRepo, detectedRepo);
      expect(conflict).toBeNull();
    });

    it("should detect owner conflicts", () => {
      const configRepo: GitHubRepo = { owner: "config-owner", repo: "repo" };
      const detectedRepo = {
        owner: "detected-owner",
        repo: "repo",
        url: "https://github.com/detected-owner/repo.git",
        type: "https" as const
      };

      const conflict = detectRepositoryConflicts(configRepo, detectedRepo);
      expect(conflict).toEqual({
        configRepo,
        detectedRepo,
        conflictType: "owner"
      });
    });

    it("should detect repo conflicts", () => {
      const configRepo: GitHubRepo = { owner: "owner", repo: "config-repo" };
      const detectedRepo = {
        owner: "owner",
        repo: "detected-repo",
        url: "https://github.com/owner/detected-repo.git",
        type: "https" as const
      };

      const conflict = detectRepositoryConflicts(configRepo, detectedRepo);
      expect(conflict).toEqual({
        configRepo,
        detectedRepo,
        conflictType: "repo"
      });
    });

    it("should detect both owner and repo conflicts", () => {
      const configRepo: GitHubRepo = { owner: "config-owner", repo: "config-repo" };
      const detectedRepo = {
        owner: "detected-owner",
        repo: "detected-repo", 
        url: "https://github.com/detected-owner/detected-repo.git",
        type: "https" as const
      };

      const conflict = detectRepositoryConflicts(configRepo, detectedRepo);
      expect(conflict).toEqual({
        configRepo,
        detectedRepo,
        conflictType: "both"
      });
    });
  });

  describe("validateRepositoryConfig", () => {
    it("should validate valid repository config", () => {
      const config: GitHubRepo = {
        owner: "owner",
        repo: "repo",
        baseUrl: "https://api.github.com",
        tokenEnv: "GITHUB_TOKEN"
      };

      const result = validateRepositoryConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.suggestions).toHaveLength(0);
    });

    it("should require owner and repo", () => {
      const config: GitHubRepo = {};

      const result = validateRepositoryConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Repository owner is required");
      expect(result.errors).toContain("Repository name is required");
    });

    it("should validate base URL format", () => {
      const config: GitHubRepo = {
        owner: "owner",
        repo: "repo",
        baseUrl: "invalid-url"
      };

      const result = validateRepositoryConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Base URL must start with https://");
    });

    it("should provide suggestions for common mistakes", () => {
      const config: GitHubRepo = {
        owner: "owner/repo",
        repo: "repo.git"
      };

      const result = validateRepositoryConfig(config);
      expect(result.valid).toBe(false);
      expect(result.suggestions).toContain(`Did you mean owner: "owner", repo: "repo"?`);
      expect(result.suggestions).toContain(`Repository name should not include .git extension: "repo"`);
    });
  });

  describe("createRepositoryConfig", () => {
    it("should create repository config with defaults", () => {
      const result = createRepositoryConfig("owner", "repo");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        tokenEnv: "GITHUB_TOKEN"
      });
    });

    it("should merge with base config", () => {
      const baseConfig = {
        baseUrl: "https://github.enterprise.com/api/v3",
        tokenEnv: "ENTERPRISE_TOKEN"
      };

      const result = createRepositoryConfig("owner", "repo", baseConfig);
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        baseUrl: "https://github.enterprise.com/api/v3",
        tokenEnv: "ENTERPRISE_TOKEN"
      });
    });
  });

  describe("getSmartRepositoryConfig", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should use config when no Git detection", () => {
      // Mock execSync to throw (no Git remote)
      vi.doMock("node:child_process", () => ({
        execSync: vi.fn().mockImplementation(() => {
          throw new Error("Not a git repository");
        })
      }));

      const configRepo: GitHubRepo = { owner: "config-owner", repo: "config-repo" };
      const result = getSmartRepositoryConfig(configRepo, { verbose: false });
      
      expect(result).toEqual({
        repo: configRepo,
        source: "config"
      });
    });

    it("should use detected when no config", () => {
      // Mock successful Git detection
      vi.doMock("node:child_process", () => ({
        execSync: vi.fn().mockReturnValue("https://github.com/detected-owner/detected-repo.git\n")
      }));

      const result = getSmartRepositoryConfig(undefined, { verbose: false });
      
      expect(result).toEqual({
        repo: {
          owner: "detected-owner",
          repo: "detected-repo"
        },
        source: "detected"
      });
    });

    it("should return null when neither config nor detection available", () => {
      // Mock execSync to throw (no Git remote)
      vi.doMock("node:child_process", () => ({
        execSync: vi.fn().mockImplementation(() => {
          throw new Error("Not a git repository");
        })
      }));

      const result = getSmartRepositoryConfig(undefined, { verbose: false });
      expect(result).toBeNull();
    });
  });
});