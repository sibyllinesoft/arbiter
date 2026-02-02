import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { rm } from "node:fs/promises";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCheckCommand } from "@/services/check/index.js";

let stdout: string[] = [];
let origLog: typeof console.log;
let tmpDir: string | null = null;

beforeEach(() => {
  origLog = console.log;
  stdout = [];
  console.log = (m?: any) => stdout.push(String(m));
});

afterEach(async () => {
  console.log = origLog;
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    tmpDir = null;
  }
});

describe("runCheckCommand with no files", () => {
  it("returns success and prints empty json", async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "arb-check-"));
    // Create .arbiter/assembly.cue to trigger legacy CUE mode (not markdown mode)
    const arbiterDir = path.join(tmpDir, ".arbiter");
    await fs.mkdir(arbiterDir, { recursive: true });
    await fs.writeFile(path.join(arbiterDir, "assembly.cue"), "package spec\n", "utf-8");
    const config: any = {
      projectDir: tmpDir,
      apiUrl: "http://localhost",
      timeout: 1,
      format: "json",
      color: false,
      localMode: true,
    };

    const code = await runCheckCommand([], { format: "json" } as any, config);
    expect(code).toBe(0);
    expect(stdout.join("")).toContain("[]");
  });
});
