import { describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ApiClient } from "../../api-client.js";
import { runCheckCommand } from "../check/index.js";

const baseConfig = { projectDir: "", color: false, localMode: false, apiUrl: "https://api" } as any;

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

import fs from "node:fs/promises";

describe("runCheckCommand remote mode", () => {
  it("returns success when api validate succeeds", async () => {
    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (msg?: any) => stdout.push(String(msg ?? ""));

    const healthSpy = spyOn(ApiClient.prototype, "health").mockResolvedValue({
      success: true,
    } as any);
    const validateSpy = spyOn(ApiClient.prototype, "validate").mockImplementation(
      async () =>
        ({
          success: true,
          data: { success: true, errors: [], warnings: [] },
        }) as any,
    );

    await inTempCueProject({ "ok.cue": "package demo\nx: 1\n" }, async () => {
      const code = await runCheckCommand(["*.cue"], { recursive: true }, { ...baseConfig } as any);
      expect(code).toBe(0);
      expect(stdout.join("\n")).toContain("ok.cue");
    });

    healthSpy.mockRestore();
    validateSpy.mockRestore();
    console.log = origLog;
  });

  it("returns error when api validate fails and respects failFast", async () => {
    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (msg?: any) => stdout.push(String(msg ?? ""));

    const healthSpy = spyOn(ApiClient.prototype, "health").mockResolvedValue({
      success: true,
    } as any);
    const validateSpy = spyOn(ApiClient.prototype, "validate").mockImplementation(
      async () =>
        ({
          success: false,
          error: "validation failed",
        }) as any,
    );

    await inTempCueProject({ "bad.cue": "package demo\nx: 1\n" }, async () => {
      const code = await runCheckCommand(["*.cue"], { recursive: true, failFast: true }, {
        ...baseConfig,
      } as any);
      expect(code).toBe(1);
      expect(stdout.join("\n")).toContain("bad.cue");
    });

    healthSpy.mockRestore();
    validateSpy.mockRestore();
    console.log = origLog;
  });
});
