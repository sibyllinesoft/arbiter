import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCheckCommand } from "@/services/check/index.js";

const baseConfig = { projectDir: "", color: false, localMode: false, apiUrl: "https://api" } as any;

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

async function inTempCueProject(
  files: Record<string, string>,
  run: (dir: string) => Promise<void>,
) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-check-remote-"));
  const prev = process.cwd();
  process.chdir(tmp);
  baseConfig.projectDir = tmp;
  try {
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(tmp, rel);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, content, "utf-8");
    }
    await run(tmp);
  } finally {
    process.chdir(prev);
    await rm(tmp, { recursive: true, force: true });
  }
}

describe("runCheckCommand remote mode", () => {
  it("returns success when api validate succeeds", async () => {
    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (msg?: any) => stdout.push(String(msg ?? ""));

    // Create a stub client with success response
    const stubClient = new StubApiClient();

    await inTempCueProject({ "ok.cue": "package demo\nx: 1\n" }, async () => {
      const code = await runCheckCommand(
        ["*.cue"],
        { recursive: true },
        { ...baseConfig } as any,
        stubClient as any,
      );
      expect(code).toBe(0);
      expect(stdout.join("\n")).toContain("ok.cue");
    });

    console.log = origLog;
  });

  it("returns error when api validate fails and respects failFast", async () => {
    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (msg?: any) => stdout.push(String(msg ?? ""));

    // Create a stub client with failure response
    const stubClient = new StubApiClient().setValidateResponse({
      success: false,
      error: "validation failed",
    });

    await inTempCueProject({ "bad.cue": "package demo\nx: 1\n" }, async () => {
      const code = await runCheckCommand(
        ["*.cue"],
        { recursive: true, failFast: true },
        { ...baseConfig } as any,
        stubClient as any,
      );
      expect(code).toBe(1);
      expect(stdout.join("\n")).toContain("bad.cue");
    });

    console.log = origLog;
  });
});
