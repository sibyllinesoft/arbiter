import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";

let originalCwd: string;
let generateModule: any;

beforeEach(async () => {
  // Clear any lingering mocks from previous tests
  mock.restore();
  originalCwd = process.cwd();
  // Dynamic import to get fresh module after mock.restore()
  const timestamp = Date.now();
  generateModule = await import(`@/services/generate/io/index.js?t=${timestamp}`);
});

afterEach(async () => {
  process.chdir(originalCwd);
});

describe("spec discovery and parsing", () => {
  it("discovers specs under .arbiter with assembly.cue present", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-spec-"));
    const specDir = path.join(tmp, ".arbiter", "demo");
    await fs.ensureDir(specDir);
    await fs.writeFile(path.join(specDir, "assembly.cue"), 'product: { name: "Demo" }\n');

    process.chdir(tmp);
    const specs = generateModule.__generateTesting.discoverSpecs();
    expect(specs).toEqual([{ name: "demo", path: path.join(".arbiter", "demo", "assembly.cue") }]);
  });

  it("uses fallback parsing when cue evaluation fails", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-parse-"));
    const cuePath = path.join(tmp, "broken.cue");
    await fs.writeFile(cuePath, "this is not valid cue\n");

    const mockReporter = {
      info: () => {},
      warn: () => {},
      error: () => {},
      success: () => {},
    };

    const config = await generateModule.__generateTesting.parseAssemblyFile(cuePath, mockReporter);
    expect(config.schema.version).toBe("app");
    expect(config.app.product?.name).toBe("Unknown App");
  });

  it("parses app schema and normalizes capabilities", () => {
    const cueData = {
      product: { name: "Parsed" },
      capabilities: ["auth", { name: "billing", id: "billing" }],
      flows: [],
      ui: { routes: [] },
      locators: {},
    };

    const config = generateModule.parseAppSchema(cueData, {
      version: "app",
      detected_from: "metadata",
    });
    expect(Object.keys(config.app.capabilities || {})).toEqual(["auth", "billing"]);
    expect(config.app.product?.name).toBe("Parsed");
  });

  it("parses assembly.cue via cue eval when available", async () => {
    // Mock spawn to return valid JSON for cue eval
    const { EventEmitter } = await import("node:events");
    const childProcess = await import("node:child_process");
    mock.module("node:child_process", () => ({
      ...childProcess,
      spawn: () => {
        const proc: any = new EventEmitter();
        proc.stdout = new EventEmitter();
        proc.stderr = new EventEmitter();
        proc.kill = () => {};
        setImmediate(() => {
          proc.stdout.emit(
            "data",
            JSON.stringify({
              product: { name: "CueApp" },
              capabilities: ["search"],
            }),
          );
          proc.emit("close", 0);
        });
        return proc;
      },
    }));

    // Re-import to get fresh module with mocked child_process
    const timestamp = Date.now();
    const freshModule = await import(`@/services/generate/io/index.js?cue=${timestamp}`);

    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-cue-"));
    const cuePath = path.join(tmp, "assembly.cue");
    await fs.writeFile(cuePath, `product: { name: "CueApp" }\ncapabilities: ["search"]\n`);

    const mockReporter = {
      info: () => {},
      warn: () => {},
      error: () => {},
      success: () => {},
    };

    const config = await freshModule.__generateTesting.parseAssemblyFile(cuePath, mockReporter);
    expect(config.app.product?.name).toBe("CueApp");
    expect(Object.keys(config.app.capabilities || {})).toContain("search");
  });
});
