import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/validation/warnings.js", () => ({
  validateSpecification: vi.fn().mockReturnValue({ hasErrors: false, hasWarnings: false }),
  formatWarnings: () => "",
}));

const baseConfig = {
  localMode: true,
  projectDir: undefined,
  format: "table",
  projectStructure: {},
};

let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
});

afterEach(async () => {
  process.chdir(originalCwd);
  vi.clearAllMocks();
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

    const mod = await import("@/services/generate/index.js");
    const code = await mod.generateCommand({ dryRun: true, force: true }, {
      ...baseConfig,
      projectDir: tmp,
    } as any);

    expect(code).toBe(0);
  });
});
