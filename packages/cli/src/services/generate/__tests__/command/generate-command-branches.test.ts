import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const baseConfig = {
  localMode: true,
  projectDir: undefined,
  format: "table",
};

let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
  process.env.ARBITER_SKIP_CUE = "1";
});

afterEach(async () => {
  process.chdir(originalCwd);
  delete process.env.ARBITER_SKIP_CUE;
  vi.clearAllMocks();
});

describe("generateCommand early branches", () => {
  it("returns 1 when multiple specs are discovered without selection", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-gen-multi-"));
    process.chdir(tmp);
    // create two specs
    await fs.ensureDir(path.join(tmp, ".arbiter", "one"));
    await fs.writeFile(
      path.join(tmp, ".arbiter", "one", "assembly.cue"),
      'product: { name: "One" }\n',
    );
    await fs.ensureDir(path.join(tmp, ".arbiter", "two"));
    await fs.writeFile(
      path.join(tmp, ".arbiter", "two", "assembly.cue"),
      'product: { name: "Two" }\n',
    );

    const reporter = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const { generateCommand } = await import("@/services/generate/io/index.js");
    const code = await generateCommand({ reporter }, { ...baseConfig, projectDir: tmp } as any);

    expect(code).toBe(1);
  });

  it("stops on validation warnings when --force is not provided", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-gen-warn-"));
    process.chdir(tmp);
    await fs.ensureDir(path.join(tmp, ".arbiter"));
    await fs.writeFile(
      path.join(tmp, ".arbiter", "assembly.cue"),
      'product: { name: "WarnApp" }\nconfig: { language: "typescript" }\nui: { routes: [] }\nflows: []\n',
    );

    vi.mock("@/services/validation/warnings.js", () => ({
      validateSpecification: vi.fn().mockReturnValue({ hasErrors: false, hasWarnings: true }),
      formatWarnings: () => "warn",
    }));

    const reporter = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const { generateCommand } = await import(`../../io/index.js?warn=${Date.now()}`);
    const code = await generateCommand({ reporter }, { ...baseConfig, projectDir: tmp } as any);

    expect(code).toBe(1);
  });
});
