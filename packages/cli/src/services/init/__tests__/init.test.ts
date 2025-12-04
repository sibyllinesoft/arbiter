import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

const minimalConfig = {
  apiUrl: "http://localhost:3000",
  format: "text",
  color: true,
  timeout: 30_000,
  token: "test-token",
} as any;

describe("initCommand", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-init-"));
    process.chdir(tmpDir);
  });

  afterEach(async () => {
    mock.restore();
    process.chdir(originalCwd);
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  });

  it("creates a basic template project with config and readme", async () => {
    const { initCommand } = await import("@/services/init/index.js");
    const targetDir = path.join(tmpDir, "demo");

    const code = await initCommand("demo", { template: "basic", directory: targetDir } as any);

    const readme = await fs.readFile(path.join(targetDir, "README.md"), "utf-8");
    const config = await fs.readJson(path.join(targetDir, ".arbiter", "config.json"));

    expect(code).toBe(0);
    expect(readme).toContain("# demo");
    expect(config.apiUrl).toBeTruthy();
  });

  it("warns when directory already exists without force", async () => {
    const { initCommand } = await import("@/services/init/index.js");
    const targetDir = path.join(tmpDir, "existing");
    await fs.ensureDir(targetDir);
    const log = spyOn(console, "log").mockReturnValue();

    const code = await initCommand("existing", { directory: targetDir } as any);

    expect(code).toBe(1);
    expect(log.mock.calls[0][0]).toContain("already exists");
  });

  it("throws on unknown template", async () => {
    const { initCommand } = await import("@/services/init/index.js");

    const code = await initCommand("demo", {
      template: "does-not-exist",
      directory: tmpDir,
    } as any);
    expect(code).toBe(2);
  });

  it("prints available presets for unknown preset id", async () => {
    mock.module("@/services/api-client.js", () => ({
      ApiClient: class MockApiClient {},
    }));
    mock.module("@/services/utils/progress.js", () => ({
      withProgress: async (_opts: any, fn: any) => fn(),
    }));

    const log = spyOn(console, "log").mockReturnValue();
    const error = spyOn(console, "error").mockReturnValue();

    const { initCommand } = await import(`../index.js?unknown=${Date.now()}`);
    const code = await initCommand("demo", { preset: "nope" } as any, minimalConfig);

    expect(code).toBe(1);
    expect(error).toHaveBeenCalled(); // printed error message
    expect(log.mock.calls.some((c) => String(c[0]).includes("Available presets"))).toBe(true);
  });

  it("creates project via preset using ApiClient", async () => {
    mock.module("@/api-client.js", () => ({
      ApiClient: class MockApiClient {
        async createProject() {
          return { success: true } as any;
        }
      },
    }));
    mock.module("@/utils/progress.js", () => ({
      withProgress: async (_opts: any, fn: any) => fn(),
    }));

    const { initCommand } = await import(`../index.js?preset=${Date.now()}`);

    const code = await initCommand(undefined, { preset: "web-app" } as any, minimalConfig);

    expect(code).toBe(0);
  });
});
