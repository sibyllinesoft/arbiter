import { describe, expect, it, spyOn } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as cliIntegration from "@/constraints/cli-integration.js";
import { getCueManipulator } from "@/constraints/cli-integration.js";
import * as cue from "@/cue/index.js";
import { removeCommand } from "@/services/remove/index.js";

describe("removeCommand success path", () => {
  it("removes declaration and writes updated file", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "arb-remove-"));
    const arbDir = path.join(dir, ".arbiter");
    await fs.mkdir(arbDir);
    const assemblyPath = path.join(arbDir, "assembly.cue");
    await fs.writeFile(assemblyPath, "package demo\nservice: {}\n");

    // Stub validation to always pass
    const valSpy = spyOn(cue, "validateCUE").mockResolvedValue({ valid: true, errors: [] } as any);

    // Stub manipulator to return modified content
    const stubManipulator = {
      removeDeclaration: async () => "package demo\n",
      cleanup: async () => {},
    };
    const manipSpy = spyOn(cliIntegration, "getCueManipulator").mockReturnValue(
      stubManipulator as any,
    );

    const code = await removeCommand("service", "service", { verbose: true }, {
      localMode: true,
      projectDir: dir,
    } as any);

    const updated = await fs.readFile(assemblyPath, "utf8");
    expect(code).toBe(0);
    expect(updated.trim()).toBe("package demo");

    valSpy.mockRestore();
    manipSpy.mockRestore();
  });
});
