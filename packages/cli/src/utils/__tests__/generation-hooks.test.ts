/** @packageDocumentation Utility tests */
import { beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { GenerationHookManager } from "@/utils/api/generation-hooks";

const makeTmp = () => mkdtemp(path.join(os.tmpdir(), "arb-hooks-"));

describe("GenerationHookManager", () => {
  beforeEach(() => {
    // Ensure no module mocks from other tests leak into these hooks
    mock.restore();
  });

  it("skips hooks when dryRun is enabled", async () => {
    const mgr = new GenerationHookManager({
      hooks: { "before:generate": "echo should-not-run" },
      workspaceRoot: process.cwd(),
      outputDir: process.cwd(),
      dryRun: true,
    });

    await mgr.runBeforeGenerate(); // Should not throw or execute hook
    const content = await mgr.beforeFileWrite(path.join(process.cwd(), "file.txt"), "data");
    expect(content).toBe("data");
  });

  it("runs hooks with environment and captured output", async () => {
    const tmp = await makeTmp();
    const mgr = new GenerationHookManager({
      hooks: {
        "before:fileWrite": 'read body; echo "processed:$ARBITER_RELATIVE_PATH:$body"',
        "after:fileWrite": "echo $ARBITER_CONTENT_LENGTH > hook.log",
        "after:generate": "echo $ARBITER_GENERATED_FILES > files.log",
      },
      workspaceRoot: tmp,
      outputDir: path.join(tmp, "out"),
    });

    const rewritten = await mgr.beforeFileWrite(path.join(tmp, "foo/bar.txt"), "payload");
    expect(rewritten).toBe("processed:foo/bar.txt:payload");

    await mgr.afterFileWrite(path.join(tmp, "baz.txt"), "xyz");
    await mgr.runAfterGenerate(["one", "two"]);

    const contentLen = (await readFile(path.join(tmp, "hook.log"), "utf8")).trim();
    expect(contentLen).toBe("3");
    const filesLogged = (await readFile(path.join(tmp, "files.log"), "utf8")).trim();
    expect(filesLogged).toContain("one");
    expect(filesLogged).toContain("two");
  });
});
