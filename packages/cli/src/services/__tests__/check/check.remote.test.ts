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

/**
 * Stub ApiClient for testing - no global mock pollution
 */
class StubApiClient {
  private healthResponse = { success: true };
  private validateResponse: any = {
    success: true,
    data: { success: true, errors: [], warnings: [] },
  };

  setHealthResponse(response: any) {
    this.healthResponse = response;
    return this;
  }

  setValidateResponse(response: any) {
    this.validateResponse = response;
    return this;
  }

  async health() {
    return this.healthResponse;
  }

  async validate(_content: string) {
    return this.validateResponse;
  }
}

async function setupTempCueProject(files: Record<string, string>): Promise<string> {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "arbiter-check-remote-"));
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

describe("runCheckCommand remote mode", () => {
  it("returns success when api validate succeeds", async () => {
    const dir = await setupTempCueProject({ "ok.cue": "package demo\nx: 1\n" });
    const stubClient = new StubApiClient();
    const code = await runCheckCommand(
      ["*.cue"],
      { recursive: true },
      { projectDir: dir, color: false, localMode: false, apiUrl: "https://api" } as any,
      stubClient as any,
    );
    expect(code).toBe(0);
    expect(stdout.join("\n")).toContain("ok.cue");
  });

  it("returns error when api validate fails and respects failFast", async () => {
    const dir = await setupTempCueProject({ "bad.cue": "package demo\nx: 1\n" });
    const stubClient = new StubApiClient().setValidateResponse({
      success: false,
      error: "validation failed",
    });
    const code = await runCheckCommand(
      ["*.cue"],
      { recursive: true, failFast: true },
      { projectDir: dir, color: false, localMode: false, apiUrl: "https://api" } as any,
      stubClient as any,
    );
    expect(code).toBe(1);
    expect(stdout.join("\n")).toContain("bad.cue");
  });
});
