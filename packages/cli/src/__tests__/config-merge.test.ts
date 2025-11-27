import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

import { DEFAULT_CONFIG, applyCliOverrides, loadConfig, saveConfig } from "../config.js";

describe("config helpers", () => {
  it("applies CLI overrides with trimming and parsing", () => {
    const base = { ...DEFAULT_CONFIG };
    const overridden = applyCliOverrides(base, {
      arbiterUrl: "https://api.example.com///",
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
});
