import { describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import * as constraints from "@/constraints/index.js";
import { syncPyprojectToml } from "@/services/sync/index.js";

describe("sync pyproject", () => {
  it("preserves existing tool.arbiter unless forced", async () => {
    const tmp = await mkdtemp(path.join(import.meta.dir, "py-sync-"));
    const filePath = path.join(tmp, "pyproject.toml");
    await writeFile(filePath, '[tool.arbiter]\nfoo = "bar"\n');

    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const result = await syncPyprojectToml(filePath, false, false, false);
    expect(result.modified).toBe(false);
    expect(result.conflicts[0]?.resolution).toBe("preserved_existing");
    logSpy.mockRestore();

    await rm(tmp, { recursive: true, force: true });
  });

  it("replaces existing section when forced and writes via safeFileOperation", async () => {
    const tmp = await mkdtemp(path.join(import.meta.dir, "py-sync-"));
    const filePath = path.join(tmp, "pyproject.toml");
    await writeFile(filePath, '[tool.arbiter]\nfoo = "bar"\n[other]\nx=1\n');

    const safeSpy = spyOn(constraints, "safeFileOperation").mockImplementation(
      async (_op, p, writer) => writer(p),
    );
    const backupSpy = spyOn(console, "log").mockImplementation(() => {});

    const result = await syncPyprojectToml(filePath, false, true, true);
    expect(result.modified).toBe(true);
    expect(result.conflicts.some((c) => c.resolution === "replaced_with_template")).toBe(true);

    safeSpy.mockRestore();
    backupSpy.mockRestore();
    await rm(tmp, { recursive: true, force: true });
  });
});
