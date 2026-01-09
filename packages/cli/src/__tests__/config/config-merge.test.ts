import { describe, expect, it } from "bun:test";
import { execSync } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

import { DEFAULT_CONFIG, applyCliOverrides, loadConfig, saveConfig } from "@/io/config/config.js";

describe("config helpers", () => {
  it("applies CLI overrides with trimming and parsing", () => {
    const base = { ...DEFAULT_CONFIG };
    const overridden = applyCliOverrides(base, {
      apiUrl: "https://api.example.com///",
      timeout: "20",
      color: false,
      local: true,
      verbose: true,
    });

    expect(overridden.apiUrl).toBe("https://api.example.com");
    expect(overridden.timeout).toBe(20);
    expect(overridden.color).toBe(false);
    expect(overridden.localMode).toBe(true);
    expect(overridden.verbose).toBe(true);
  });

  it("saves config to json and omits runtime-only fields", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "arb-config-"));
    const filePath = path.join(tmpDir, "config.json");

    await saveConfig(
      {
        apiUrl: "https://api.save",
        authSession: { token: "secret" } as any,
        projectDir: "/workspace",
      },
      filePath,
    );

    const saved = JSON.parse(await readFile(filePath, "utf-8"));
    expect(saved.arbiter_url).toBe("https://api.save");
    expect(saved.authSession).toBeUndefined();
  });

  it("loads config file and merges with defaults", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "arb-load-"));
    const filePath = path.join(tmpDir, "config.json");
    await fs.ensureDir(tmpDir);
    await fs.writeJson(filePath, {
      apiUrl: "https://config",
      projectStructure: { testsDirectory: "spec" },
    });

    const cfg = await loadConfig(filePath);
    expect(cfg.apiUrl).toBe("https://config");
    expect(cfg.projectStructure.testsDirectory).toBe("spec");
    expect(cfg.configFilePath).toBe(filePath);
    expect(cfg.configDir).toBe(tmpDir);
  });

  it("excludes loadedConfigPaths when saving config", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "arb-save-"));
    const filePath = path.join(tmpDir, "config.json");

    await saveConfig(
      {
        apiUrl: "https://test",
        loadedConfigPaths: ["/home/user/.arbiter/config.json", "/project/.arbiter/config.json"],
      },
      filePath,
    );

    const saved = JSON.parse(await readFile(filePath, "utf-8"));
    expect(saved.loadedConfigPaths).toBeUndefined();
    expect(saved.arbiter_url).toBe("https://test");
  });
});

describe("config search order and merging", () => {
  it("merges configs from multiple levels in correct order", async () => {
    // Create a temp git repo with configs at different levels
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "arb-multi-"));
    const repoDir = path.join(tmpDir, "repo");
    const subDir = path.join(repoDir, "sub", "project");

    await fs.ensureDir(subDir);

    // Initialize git repo
    execSync("git init", { cwd: repoDir, stdio: "ignore" });

    // Create configs at different levels
    // Repo root config
    await fs.ensureDir(path.join(repoDir, ".arbiter"));
    await fs.writeJson(path.join(repoDir, ".arbiter", "config.json"), {
      apiUrl: "https://repo-root",
      timeout: 5000,
      projectStructure: { testsDirectory: "tests" },
    });

    // Subdirectory config
    await fs.ensureDir(path.join(subDir, ".arbiter"));
    await fs.writeJson(path.join(subDir, ".arbiter", "config.json"), {
      apiUrl: "https://sub-project",
      projectStructure: { docsDirectory: "documentation" },
    });

    // Change to subdirectory and load config
    const originalCwd = process.cwd();
    process.chdir(subDir);

    try {
      const cfg = await loadConfig();

      // Most specific (subDir) should win for apiUrl
      expect(cfg.apiUrl).toBe("https://sub-project");

      // Repo root timeout should be preserved (not overridden)
      expect(cfg.timeout).toBe(5000);

      // Both projectStructure values should be merged
      expect(cfg.projectStructure.testsDirectory).toBe("tests");
      expect(cfg.projectStructure.docsDirectory).toBe("documentation");

      // configFilePath should point to most specific
      expect(cfg.configFilePath).toBe(path.join(subDir, ".arbiter", "config.json"));

      // loadedConfigPaths should contain both configs
      expect(cfg.loadedConfigPaths).toBeDefined();
      expect(cfg.loadedConfigPaths?.length).toBeGreaterThanOrEqual(2);
      expect(cfg.loadedConfigPaths).toContain(path.join(repoDir, ".arbiter", "config.json"));
      expect(cfg.loadedConfigPaths).toContain(path.join(subDir, ".arbiter", "config.json"));
    } finally {
      process.chdir(originalCwd);
      await fs.remove(tmpDir);
    }
  });

  it("does not climb directories outside git repo", async () => {
    // Create a directory structure outside a git repo
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "arb-nogit-"));
    const parentDir = path.join(tmpDir, "parent");
    const childDir = path.join(parentDir, "child");

    await fs.ensureDir(childDir);

    // Create config in parent (should NOT be found when not in git repo)
    await fs.ensureDir(path.join(parentDir, ".arbiter"));
    await fs.writeJson(path.join(parentDir, ".arbiter", "config.json"), {
      apiUrl: "https://parent-config",
    });

    const originalCwd = process.cwd();
    process.chdir(childDir);

    try {
      const cfg = await loadConfig();

      // Parent config should NOT be loaded since we're not in a git repo
      expect(cfg.apiUrl).toBe(DEFAULT_CONFIG.apiUrl);

      // loadedConfigPaths should not include parent
      if (cfg.loadedConfigPaths) {
        expect(cfg.loadedConfigPaths).not.toContain(
          path.join(parentDir, ".arbiter", "config.json"),
        );
      }
    } finally {
      process.chdir(originalCwd);
      await fs.remove(tmpDir);
    }
  });

  it("loads only cwd config when not in git repo", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "arb-cwd-"));

    // Create config in cwd (no git repo)
    await fs.ensureDir(path.join(tmpDir, ".arbiter"));
    await fs.writeJson(path.join(tmpDir, ".arbiter", "config.json"), {
      apiUrl: "https://cwd-only",
      timeout: 3000,
    });

    const originalCwd = process.cwd();
    process.chdir(tmpDir);

    try {
      const cfg = await loadConfig();

      expect(cfg.apiUrl).toBe("https://cwd-only");
      expect(cfg.timeout).toBe(3000);
      expect(cfg.configFilePath).toBe(path.join(tmpDir, ".arbiter", "config.json"));

      // loadedConfigPaths should contain only cwd config (possibly home too)
      expect(cfg.loadedConfigPaths).toBeDefined();
      expect(cfg.loadedConfigPaths).toContain(path.join(tmpDir, ".arbiter", "config.json"));
    } finally {
      process.chdir(originalCwd);
      await fs.remove(tmpDir);
    }
  });
});
