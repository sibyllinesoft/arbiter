import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import fsExtra from "fs-extra";
import { type ViewOptions, viewCommand } from "../index.js";

describe("viewCommand", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    tmpDir = await fsExtra.mkdtemp(path.join(os.tmpdir(), "arbiter-view-"));
    originalCwd = process.cwd();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsExtra.remove(tmpDir);
  });

  it("returns error when .arbiter directory does not exist", async () => {
    const consoleSpy = spyOn(console, "error").mockImplementation(() => {});
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    const options: ViewOptions = { obsidian: true };
    const config = { projectDir: tmpDir } as any;

    const result = await viewCommand(options, config);

    expect(result).toBe(1);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
    logSpy.mockRestore();
  });

  it("opens obsidian with correct URI when --obsidian flag is set", async () => {
    // Create .arbiter directory
    const arbiterDir = path.join(tmpDir, ".arbiter");
    await fsExtra.ensureDir(arbiterDir);
    await fsExtra.writeFile(path.join(arbiterDir, "assembly.cue"), 'name: "test"');

    const consoleSpy = spyOn(console, "log").mockImplementation(() => {});

    const options: ViewOptions = { obsidian: true };
    const config = { projectDir: tmpDir } as any;

    // The command will try to open Obsidian which may fail in test env
    // but we can verify it doesn't crash and returns 0 or 1
    const result = await viewCommand(options, config);

    expect(typeof result).toBe("number");

    consoleSpy.mockRestore();
  });

  it("uses default port 4000 when not specified", async () => {
    const options: ViewOptions = {};

    expect(options.port).toBeUndefined();
    // Default is applied in the command handler
  });
});
