import { afterAll, describe, expect, it, mock, spyOn } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

import { DEFAULT_PROJECT_STRUCTURE } from "../../../config.js";
import type { CLIConfig } from "../../../types.js";
import { generateProjectTemplates, listTemplates, showTemplate } from "../index.js";

const tempDirs: string[] = [];

function makeConfig(baseDir: string): CLIConfig {
  return {
    apiUrl: "http://localhost:5050",
    timeout: 1_000,
    format: "json",
    color: false,
    localMode: true,
    projectDir: baseDir,
    projectStructure: { ...DEFAULT_PROJECT_STRUCTURE },
  };
}

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arbiter-github-templates-"));
  tempDirs.push(dir);
  return dir;
}

afterAll(async () => {
  await Promise.all(tempDirs.map((dir) => fs.remove(dir)));
});

describe("github templates command helpers", () => {
  it("lists templates in json format", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    const exit = await listTemplates(undefined, "json");
    expect(exit).toBe(0);
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("returns error when template is missing", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    const error = spyOn(console, "error").mockImplementation(() => {});
    const code = await showTemplate(undefined, "nonexistent", "json");
    expect(code).toBe(1);
    error.mockRestore();
    log.mockRestore();
  });

  it("generates template files into target directory", async () => {
    const dir = makeTempDir();
    const output = path.join(dir, ".github");
    const log = spyOn(console, "log").mockImplementation(() => {});
    const consoleError = spyOn(console, "error").mockImplementation(() => {});

    await generateProjectTemplates(output, makeConfig(dir));

    const entries = await fs.readdir(output);
    expect(entries.length).toBeGreaterThan(0);
    log.mockRestore();
    consoleError.mockRestore();
  });
});
