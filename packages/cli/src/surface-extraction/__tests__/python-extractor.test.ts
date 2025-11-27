import { describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as globModule from "glob";
import { extractPythonSurface } from "../python-extractor.js";

describe("extractPythonSurface", () => {
  it("returns null when no python files are found", async () => {
    const globSpy = spyOn(globModule, "glob").mockResolvedValue([] as any);
    const surface = await extractPythonSurface({ language: "python" } as any);
    globSpy.mockRestore();
    expect(surface).toBeNull();
  });

  it("parses python files via AST strategy when other strategies cannot execute", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-python-"));
    const previousCwd = process.cwd();
    process.chdir(tmp);

    try {
      const pythonFile = path.join(tmp, "main.py");
      await writeFile(
        pythonFile,
        `
def public_fn(x: int) -> int:
    return x

def _private_helper():
    return 0

class Example:
    pass
`,
        "utf-8",
      );

      let callCount = 0;
      const globSpy = spyOn(globModule, "glob").mockImplementation(async (pattern: any) => {
        callCount += 1;
        if (pattern === "**/*.py") {
          // Map specific calls to simulate validate -> execution phases
          const responses: Record<number, string[]> = {
            7: [pythonFile], // AST validate pass
            14: [pythonFile], // AST execute pass
            15: [pythonFile], // AST file discovery
          };
          return responses[callCount] ?? [];
        }
        return [];
      });

      const surface = await extractPythonSurface({ language: "python" } as any);
      expect(surface).not.toBeNull();
      expect(surface?.symbols?.some((s) => s.name === "public_fn")).toBe(true);
      expect(surface?.symbols?.some((s) => s.name === "_private_helper")).toBe(false);
      expect(surface?.symbols?.some((s) => s.name === "Example")).toBe(true);

      globSpy.mockRestore();
    } finally {
      process.chdir(previousCwd);
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
