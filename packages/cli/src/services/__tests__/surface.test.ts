import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { extractAPISurface, findSourceFiles, surfaceCommand } from "@/services/surface/index.js";
import { registerExtractor } from "@/surface-extraction/index.js";
import type { APISurface } from "@/surface-extraction/types.js";

const makeTmp = () => fs.mkdtemp(path.join(os.tmpdir(), "arb-surface-"));

describe("surface helpers", () => {
  it("findSourceFiles returns matches for language patterns", async () => {
    const dir = await makeTmp();
    const file = path.join(dir, "demo.ts");
    await fs.writeFile(file, "export function hello() { return 1; }");
    const cwd = process.cwd();
    process.chdir(dir);
    try {
      const files = await findSourceFiles("typescript");
      expect(files.map((f) => path.resolve(f))).toContain(path.resolve(file));
    } finally {
      process.chdir(cwd);
    }
  });

  it("extractAPISurface uses registered extractor", async () => {
    const fakeSurface: APISurface = {
      language: "typescript",
      version: "test",
      timestamp: Date.now(),
      symbols: [],
      statistics: { totalSymbols: 0, publicSymbols: 0, privateSymbols: 0, byType: {} },
    };
    registerExtractor("typescript", async () => fakeSurface);
    const result = await extractAPISurface({ language: "typescript" } as any, ["a.ts"]);
    expect(result).toBe(fakeSurface);
  });
});

describe("surfaceCommand", () => {
  it("writes surface output using registered extractor", async () => {
    const dir = await makeTmp();
    const cwd = process.cwd();
    process.chdir(dir);

    const surface: APISurface = {
      language: "typescript",
      version: "test",
      timestamp: Date.now(),
      symbols: [
        {
          name: "hello",
          type: "function",
          visibility: "public",
          signature: "function hello()",
          location: { file: "demo.ts", line: 1, column: 1 },
        },
      ],
      statistics: { totalSymbols: 1, publicSymbols: 1, privateSymbols: 0, byType: { function: 1 } },
    };
    registerExtractor("typescript", async () => surface);
    await fs.writeFile(path.join(dir, "demo.ts"), "export function hello() {}");

    const code = await surfaceCommand(
      { language: "typescript", outputDir: dir, projectName: "demo" } as any,
      { projectDir: dir } as any,
    );
    process.chdir(cwd);
    expect(code).toBe(0);
    const out = await fs.readFile(path.join(dir, "demo-surface.json"), "utf8");
    expect(out).toContain('"Surface"');
  });
});
