import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
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
  afterEach(() => {
    mock.restore();
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
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-init-"));
    const origDir = process.cwd();
    process.chdir(tmpDir);

    try {
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

      // Verify .arbiter/assembly.cue was created
      const assemblyPath = path.join(tmpDir, ".arbiter", "assembly.cue");
      expect(await fs.pathExists(assemblyPath)).toBe(true);
    } finally {
      process.chdir(origDir);
      await fs.remove(tmpDir);
    }
  });
});
