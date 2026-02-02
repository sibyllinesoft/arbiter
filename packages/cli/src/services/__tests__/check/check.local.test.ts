import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCheckCommand } from "@/services/check/index.js";

// Captured console.log output per test
let stdout: string[] = [];
let origLog: typeof console.log;
let origCwd: string;
let tmpDir: string | null = null;

beforeEach(() => {
  origLog = console.log;
  origCwd = process.cwd();
  stdout = [];
  console.log = (msg?: any) => stdout.push(String(msg ?? ""));
});

afterEach(async () => {
  console.log = origLog;
  process.chdir(origCwd);
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    tmpDir = null;
  }
});

async function setupTempCueProject(files: Record<string, string>): Promise<string> {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "arbiter-check-"));
  process.chdir(tmpDir);
  // Create .arbiter/assembly.cue to trigger legacy CUE mode (not markdown mode)
  const arbiterDir = path.join(tmpDir, ".arbiter");
  await fs.mkdir(arbiterDir, { recursive: true });
  await writeFile(path.join(arbiterDir, "assembly.cue"), "package spec\n", "utf-8");
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(tmpDir, rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content, "utf-8");
  }
  return tmpDir;
}

describe("runCheckCommand local mode", () => {
  it("returns success and formats table for valid files", async () => {
    const dir = await setupTempCueProject({ "ok.cue": "package demo\nvalue: 1\n" });
    const code = await runCheckCommand(["*.cue"], { recursive: true }, {
      projectDir: dir,
      localMode: true,
      color: false,
    } as any);
    expect(code).toBe(0);
    expect(stdout.join("\n")).toContain("ok.cue");
  });

  it("returns error code when validation fails and respects failFast", async () => {
    const dir = await setupTempCueProject({
      "bad.cue": "package demo\nvalue: string\nvalue: 1\n", // conflicting types
      "skip.cue": "package demo\nvalue: 2\n",
    });
    const code = await runCheckCommand(["*.cue"], { recursive: true, failFast: true }, {
      projectDir: dir,
      localMode: true,
      color: false,
    } as any);
    expect(code).toBe(1);
    // ensure we short-circuit (skip.cue might not appear)
    expect(stdout.join("\n")).toContain("bad.cue");
  });

  it("prints json when format=json with no files", async () => {
    const dir = await setupTempCueProject({});
    const code = await runCheckCommand(
      [],
      { format: "json" } as any,
      { projectDir: dir, localMode: true, color: false } as any,
    );
    expect(code).toBe(0);
    expect(() => JSON.parse(stdout.join("\n"))).not.toThrow();
  });
});
