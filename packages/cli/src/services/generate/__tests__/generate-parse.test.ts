import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __generateTesting, parseAppSchema } from "../index.js";

let originalCwd: string;

beforeEach(() => {
  originalCwd = process.cwd();
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
    const specs = __generateTesting.discoverSpecs();
    expect(specs).toEqual([{ name: "demo", path: path.join(".arbiter", "demo", "assembly.cue") }]);
  });

  it("uses fallback parsing when cue evaluation fails", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-parse-"));
    const cuePath = path.join(tmp, "broken.cue");
    await fs.writeFile(cuePath, "this is not valid cue\n");

    const config = await __generateTesting.parseAssemblyFile(cuePath);
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

    const config = parseAppSchema(cueData, { version: "app", detected_from: "metadata" });
    expect(Object.keys(config.app.capabilities || {})).toEqual(["auth", "billing"]);
    expect(config.app.product?.name).toBe("Parsed");
  });

  it("parses assembly.cue via cue eval when available", async () => {
    // ensure cue binary is on PATH for this test
    process.env.PATH = `/tmp/cue-bin:${process.env.PATH}`;
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-cue-"));
    const cuePath = path.join(tmp, "assembly.cue");
    await fs.writeFile(cuePath, `product: { name: "CueApp" }\ncapabilities: ["search"]\n`);

    const config = await __generateTesting.parseAssemblyFile(cuePath);
    expect(config.app.product?.name).toBe("CueApp");
    expect(Object.keys(config.app.capabilities || {})).toContain("search");
  });
});
