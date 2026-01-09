import { describe, expect, it, spyOn } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as cliIntegration from "@/constraints/cli-integration.js";
import * as cue from "@/cue/index.js";
import { statusCommand } from "@/services/status/index.js";

const baseConfig = (dir: string) =>
  ({
    localMode: true,
    format: "json",
    projectDir: dir,
    apiUrl: "http://localhost",
    timeout: 1,
    color: false,
  }) as any;

describe("statusCommand (local mode)", () => {
  it("emits json and returns 0 when local spec is valid", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "arb-status-"));
    const arbDir = path.join(dir, ".arbiter");
    await fs.mkdir(arbDir);
    const assemblyPath = path.join(arbDir, "assembly.cue");
    await fs.writeFile(assemblyPath, "package demo\nservices: {}\n", "utf8");

    const validateSpy = spyOn(cue, "validateCUE").mockResolvedValue({
      valid: true,
      errors: [],
    } as any);
    const manipulator = { parse: async () => ({ services: {} }), cleanup: async () => {} };
    const manipSpy = spyOn(cliIntegration, "getCueManipulator").mockReturnValue(manipulator as any);

    const logs: string[] = [];
    const orig = console.log;
    console.log = (m?: any) => logs.push(String(m));

    const code = await statusCommand({ detailed: false }, baseConfig(dir));

    console.log = orig;
    validateSpy.mockRestore();
    manipSpy.mockRestore();

    expect(code).toBe(0);
    expect(logs.join("")).toContain("health");
  });
});
