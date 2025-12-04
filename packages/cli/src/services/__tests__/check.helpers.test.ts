import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { findCueFiles, isJsonFormat } from "@/services/check/index.js";

describe("check helpers", () => {
  it("detects json format flag", () => {
    expect(isJsonFormat({ format: "json" } as any)).toBe(true);
    expect(isJsonFormat({} as any)).toBe(false);
  });

  it("finds cue files with glob patterns", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "arb-check-"));
    const file = path.join(dir, "foo.cue");
    await fs.writeFile(file, "package demo");
    const files = await findCueFiles(["**/*.cue"], { recursive: true, cwd: dir });
    expect(files).toContain(file);
  });
});
