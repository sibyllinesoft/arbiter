import { describe, expect, it, spyOn } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { importCommand } from "@/services/import/index.js";

async function tmpDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "arb-import-"));
}

describe("import registry CLI", () => {
  it("lists registry with defaults when file is missing", async () => {
    const dir = await tmpDir();
    const prev = process.cwd();
    process.chdir(dir);

    const log = spyOn(console, "log").mockImplementation(() => {});
    const code = await importCommand("list", undefined, {});
    expect(code).toBe(0);
    log.mockRestore();
    process.chdir(prev);
  });

  it("updates registry with allowed patterns and validates", async () => {
    const dir = await tmpDir();
    const prev = process.cwd();
    process.chdir(dir);
    await fs.mkdir(path.join(dir, ".arbiter"));

    try {
      const addCode = await importCommand("update", undefined, { allow: ["github.com/*"] });
      expect(addCode).toBe(0);

      const registryPath = path.join(dir, ".arbiter", "registry.json");
      const saved = JSON.parse(await fs.readFile(registryPath, "utf-8"));
      expect(saved.allowed_imports["github.com/*"]).toBeDefined();

      const validateOk = await importCommand("validate", undefined, {
        allow: ["github.com/arbiter"],
      });
      expect(validateOk).toBe(0);

      const validateFail = await importCommand("validate", undefined, {
        allow: ["bitbucket.org/foo"],
      });
      expect(validateFail).toBe(1);
    } finally {
      process.chdir(prev);
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});
