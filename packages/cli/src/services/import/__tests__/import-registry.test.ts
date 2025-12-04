import { afterAll, beforeAll, describe, expect, it, spyOn } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

import { importCommand } from "@/services/import/index.js";

let originalCwd: string;
let tempDir: string;

beforeAll(() => {
  originalCwd = process.cwd();
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "arbiter-import-"));
  fs.ensureDirSync(path.join(tempDir, ".arbiter"));
  process.chdir(tempDir);
});

afterAll(async () => {
  process.chdir(originalCwd);
  await fs.remove(tempDir);
});

describe("import registry command", () => {
  it("fails validation when no imports are provided", async () => {
    const err = spyOn(console, "error").mockImplementation(() => {});
    const code = await importCommand("validate", undefined, { allow: [] });
    expect(code).toBe(1);
    err.mockRestore();
  });

  it("updates registry with allowed patterns and validates them", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    const err = spyOn(console, "error").mockImplementation(() => {});

    const updateCode = await importCommand("update", undefined, { allow: ["pkg/*"] });
    expect(updateCode).toBe(0);

    const validateCode = await importCommand("validate", undefined, { allow: ["pkg/foo"] });
    expect(validateCode).toBe(0);

    log.mockRestore();
    err.mockRestore();
  });

  it("lists registry entries", async () => {
    const log = spyOn(console, "log").mockImplementation(() => {});
    const code = await importCommand("list", undefined, {});
    expect(code).toBe(0);
    log.mockRestore();
  });
});
