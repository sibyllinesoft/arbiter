import { describe, expect, it, spyOn } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import * as validation from "../../../validation/warnings.js";
import { generateCommand } from "../index.js";

const baseOptions: any = { force: false, verbose: false };
const baseConfig: any = {
  projectDir: undefined,
  configDir: undefined,
  generator: {},
  github: {},
  projectStructure: {},
};

async function withCwd<T>(cwd: string, run: () => Promise<T>): Promise<T> {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return await run();
  } finally {
    process.chdir(previous);
  }
}

describe("generateCommand guards", () => {
  it("fails when no specs are present", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-gen-none-"));
    const code = await withCwd(tmp, () => generateCommand(baseOptions, { ...baseConfig }));
    expect(code).toBe(1);
    await rm(tmp, { recursive: true, force: true });
  });

  it("requires explicit spec when multiple specs exist", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-gen-multi-"));
    const specA = path.join(tmp, ".arbiter", "alpha");
    const specB = path.join(tmp, ".arbiter", "beta");
    await mkdir(specA, { recursive: true });
    await mkdir(specB, { recursive: true });
    await writeFile(path.join(specA, "assembly.cue"), 'product: { name: "Alpha" }');
    await writeFile(path.join(specB, "assembly.cue"), 'product: { name: "Beta" }');

    const code = await withCwd(tmp, () => generateCommand(baseOptions, { ...baseConfig }));
    expect(code).toBe(1);

    await rm(tmp, { recursive: true, force: true });
  });

  it("stops on validation warnings when force is not set", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-gen-warn-"));
    const specDir = path.join(tmp, ".arbiter", "single");
    await mkdir(specDir, { recursive: true });
    await writeFile(path.join(specDir, "assembly.cue"), 'product: { name: "WarnApp" }');

    const validateSpy = spyOn(validation, "validateSpecification").mockReturnValue({
      hasErrors: false,
      hasWarnings: true,
      warnings: [],
      errors: [],
    } as any);

    const code = await withCwd(tmp, () => generateCommand(baseOptions, { ...baseConfig }));
    expect(code).toBe(1);

    validateSpy.mockRestore();
    await rm(tmp, { recursive: true, force: true });
  });
});
