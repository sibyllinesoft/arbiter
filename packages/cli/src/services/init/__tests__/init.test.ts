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

let origCwd: string;
let tmpDir: string | null = null;

describe("initCommand", () => {
  beforeEach(() => {
    origCwd = process.cwd();
  });

  afterEach(async () => {
    mock.restore();
    process.chdir(origCwd);
    if (tmpDir) {
      await fs.remove(tmpDir).catch(() => {});
      tmpDir = null;
    }
  });

  it("requires a preset to be specified", async () => {
    const timestamp = Date.now();
    const { initCommand } = await import(`@/services/init/index.js?require=${timestamp}`);
    const error = spyOn(console, "error").mockReturnValue();

    const code = await initCommand("demo", {} as any);

    expect(code).toBe(1);
    expect(error).toHaveBeenCalled();

    error.mockRestore();
  });

  it("prints available presets for unknown preset id", async () => {
    const log = spyOn(console, "log").mockReturnValue();
    const error = spyOn(console, "error").mockReturnValue();

    const timestamp = Date.now();
    const { initCommand } = await import(`@/services/init/index.js?unknown=${timestamp}`);
    const code = await initCommand("demo", { preset: "nope" } as any, minimalConfig);

    expect(code).toBe(1);
    expect(error).toHaveBeenCalled();
    expect(log.mock.calls.some((c) => String(c[0]).includes("Available presets"))).toBe(true);

    log.mockRestore();
    error.mockRestore();
  });

  it("fails when config is missing for preset initialization", async () => {
    const timestamp = Date.now();
    const { initCommand } = await import(`@/services/init/index.js?missing=${timestamp}`);
    const error = spyOn(console, "error").mockReturnValue();

    const code = await initCommand("demo", { preset: "web-app" } as any);

    // Returns 1 when preset init fails due to missing config
    expect(code).toBe(1);
    expect(error).toHaveBeenCalled();

    error.mockRestore();
  });

  it("creates project via preset using local mode", async () => {
    // Create a temp directory for the test
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-init-"));
    process.chdir(tmpDir);

    // Import with cache buster
    const timestamp = Date.now();
    const { initCommand } = await import(`@/services/init/index.js?preset=${timestamp}`);

    // web-app preset supports local mode, so it will use createProjectLocally
    // No need to mock ApiClient since it won't be called in local mode
    const code = await initCommand(undefined, { preset: "web-app" } as any, {
      ...minimalConfig,
      projectDir: tmpDir,
      localMode: true, // Explicitly use local mode
    });

    expect(code).toBe(0);

    // Verify markdown-first storage was created (.arbiter/README.md)
    const readmePath = path.join(tmpDir, ".arbiter", "README.md");
    expect(await fs.pathExists(readmePath)).toBe(true);
  });
});
