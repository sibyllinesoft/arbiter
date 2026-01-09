import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runCheckCommand } from "@/services/check/index.js";

const config = { projectDir: "" } as any;

async function inTempCueProject(
  files: Record<string, string>,
  run: (dir: string, files: Record<string, string>) => Promise<void>,
) {
  const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-check-"));
  const prev = process.cwd();
  process.chdir(tmp);
  config.projectDir = tmp;
  try {
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(tmp, rel);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await writeFile(full, content, "utf-8");
    }
    await run(tmp, files);
  } finally {
    process.chdir(prev);
    await rm(tmp, { recursive: true, force: true });
  }
}

import fs from "node:fs/promises";

describe("runCheckCommand local mode", () => {
  it("returns success and formats table for valid files", async () => {
    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (msg?: any) => stdout.push(String(msg ?? ""));

    await inTempCueProject({ "ok.cue": "package demo\nvalue: 1\n" }, async () => {
      const code = await runCheckCommand(["*.cue"], { recursive: true }, {
        ...config,
        localMode: true,
        color: false,
      } as any);
      expect(code).toBe(0);
      expect(stdout.join("\n")).toContain("ok.cue");
    });

    console.log = origLog;
  });

  it("returns error code when validation fails and respects failFast", async () => {
    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (msg?: any) => stdout.push(String(msg ?? ""));

    await inTempCueProject(
      {
        "bad.cue": "package demo\nvalue: string\nvalue: 1\n", // conflicting types
        "skip.cue": "package demo\nvalue: 2\n",
      },
      async () => {
        const code = await runCheckCommand(["*.cue"], { recursive: true, failFast: true }, {
          ...config,
          localMode: true,
          color: false,
        } as any);
        expect(code).toBe(1);
        // ensure we short-circuit (skip.cue might not appear)
        expect(stdout.join("\n")).toContain("bad.cue");
      },
    );

    console.log = origLog;
  });

  it("prints json when format=json with no files", async () => {
    const stdout: string[] = [];
    const origLog = console.log;
    console.log = (msg?: any) => stdout.push(String(msg ?? ""));

    await inTempCueProject({}, async () => {
      const code = await runCheckCommand(
        [],
        { format: "json" } as any,
        { ...config, localMode: true, color: false } as any,
      );
      expect(code).toBe(0);
      expect(() => JSON.parse(stdout.join("\n"))).not.toThrow();
    });

    console.log = origLog;
  });
});
