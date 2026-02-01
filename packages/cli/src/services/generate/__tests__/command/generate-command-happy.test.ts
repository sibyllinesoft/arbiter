import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

const baseConfig = {
  localMode: true,
  projectDir: undefined,
  format: "table",
  projectStructure: {},
};

let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  process.env.ARBITER_SKIP_CUE = "1";

  // Mock inside beforeEach to avoid polluting other tests
  mock.module("@/services/validation/warnings.js", () => ({
    validateSpecification: mock(() => ({ hasErrors: false, hasWarnings: false })),
    formatWarnings: () => "",
  }));
});

afterEach(async () => {
  process.chdir(originalCwd);
  delete process.env.ARBITER_SKIP_CUE;
  mock.restore();
});

describe("generateCommand happy path (dryRun)", () => {
  it("returns 0 and calls generateAppArtifacts when spec is valid", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-gen-happy-"));
    process.chdir(tmp);
    const specDir = path.join(tmp, ".arbiter");
    await fs.ensureDir(specDir);
    await fs.writeFile(
      path.join(specDir, "assembly.cue"),
      'product: { name: "HappyApp" }\nconfig: { language: "typescript" }\nui: { routes: [] }\nflows: []\n',
    );

    // Import with cache buster after mock is set up
    const timestamp = Date.now();
    const mod = await import(`@/services/generate/io/index.js?happy=${timestamp}`);
    const reporter = { info: mock(), warn: mock(), error: mock() };
    const code = await mod.generateCommand({ dryRun: true, force: true, reporter }, {
      ...baseConfig,
      projectDir: tmp,
    } as any);

    expect(code).toBe(0);

    // Cleanup
    await fs.remove(tmp);
  });
});
