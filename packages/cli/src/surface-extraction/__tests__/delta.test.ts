import { describe, expect, it } from "bun:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { calculateSurfaceDelta } from "@/surface-extraction/delta.js";
import type { APISurface } from "@/surface-extraction/types.js";

const baseSurface = (): APISurface => ({
  language: "typescript",
  version: "1.1.0",
  timestamp: Date.now(),
  symbols: [],
  statistics: {
    totalSymbols: 0,
    publicSymbols: 0,
    privateSymbols: 0,
    byType: {},
  },
});

describe("calculateSurfaceDelta", () => {
  it("returns undefined when no prior surface exists", async () => {
    const delta = await calculateSurfaceDelta(baseSurface(), path.join(os.tmpdir(), "nope.json"));
    expect(delta).toBeUndefined();
  });

  it("detects added, removed, and modified symbols", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "arb-surface-"));
    const priorPath = path.join(tmpDir, "surface.json");

    const existingSurface: APISurface = {
      language: "typescript",
      version: "1.0.0",
      timestamp: Date.now() - 1000,
      symbols: [
        {
          name: "keep",
          type: "function",
          visibility: "public",
          signature: "keep(): string",
          returnType: "string",
          location: { file: "a.ts", line: 1, column: 1 },
        },
        {
          name: "oldOnly",
          type: "function",
          visibility: "public",
          signature: "oldOnly(): void",
          returnType: "void",
          location: { file: "b.ts", line: 1, column: 1 },
        },
        {
          name: "changed",
          type: "function",
          visibility: "public",
          signature: "changed(): string",
          returnType: "string",
          location: { file: "c.ts", line: 1, column: 1 },
        },
      ],
      statistics: {
        totalSymbols: 3,
        publicSymbols: 3,
        privateSymbols: 0,
        byType: { function: 3 },
      },
    };

    await fs.writeFile(
      priorPath,
      JSON.stringify({ kind: "Surface", language: "typescript", surface: existingSurface }),
    );

    const current: APISurface = {
      ...baseSurface(),
      symbols: [
        existingSurface.symbols[0], // keep
        {
          name: "changed",
          type: "function",
          visibility: "internal",
          signature: "changed(): number",
          returnType: "number",
          location: { file: "c.ts", line: 1, column: 1 },
        },
        {
          name: "newOne",
          type: "function",
          visibility: "public",
          signature: "newOne(): void",
          returnType: "void",
          location: { file: "d.ts", line: 1, column: 1 },
        },
      ],
      statistics: {
        totalSymbols: 3,
        publicSymbols: 2,
        privateSymbols: 1,
        byType: { function: 3 },
      },
    };

    const delta = await calculateSurfaceDelta(current, priorPath);
    expect(delta).toEqual({
      added: 1,
      removed: 1,
      modified: 1,
      breaking: true, // removed + return type/visibility change
      requiredBump: "MAJOR",
    });
  });
});
