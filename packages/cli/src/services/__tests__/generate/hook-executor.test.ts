import { afterEach, describe, expect, it, mock } from "bun:test";
import os from "node:os";
import path from "node:path";
import {
  ensureDirectory,
  setActiveHookManager,
  writeFileWithHooks,
} from "@/services/generate/util/hook-executor.js";
import fs from "fs-extra";
import type { GenerationHookManager } from "../../../utils/generation-hooks.js";

const createdPaths: string[] = [];

afterEach(async () => {
  setActiveHookManager(null);
  await Promise.all(
    createdPaths.splice(0).map(async (target) => {
      if (await fs.pathExists(target)) {
        await fs.remove(target);
      }
    }),
  );
});

describe("hook executor", () => {
  it("writes files and invokes hooks in order", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-hooks-"));
    createdPaths.push(tmpDir);
    const target = path.join(tmpDir, "sample.txt");

    const afterSpy = mock((_: string, __: string) => Promise.resolve());
    const manager = {
      beforeFileWrite: async (_filePath: string, content: string) => content.toUpperCase(),
      afterFileWrite: async (filePath: string, content: string) => afterSpy(filePath, content),
      runBeforeGenerate: async () => {},
      runAfterGenerate: async () => {},
    } as unknown as GenerationHookManager;

    setActiveHookManager(manager);

    await writeFileWithHooks(target, "hello world", { dryRun: false });

    const written = await fs.readFile(target, "utf-8");
    expect(written).toBe("HELLO WORLD");
    expect(afterSpy).toHaveBeenCalledTimes(1);
    expect(afterSpy.mock.calls[0][0]).toBe(target);
  });

  it("respects dry run mode for directories and files", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-hooks-"));
    createdPaths.push(tmpDir);
    const dir = path.join(tmpDir, "nested");
    const filePath = path.join(tmpDir, "noop.txt");

    await ensureDirectory(dir, { dryRun: true });
    await writeFileWithHooks(filePath, "noop", { dryRun: true });

    expect(await fs.pathExists(dir)).toBeFalse();
    expect(await fs.pathExists(filePath)).toBeFalse();
  });
});
