/** @packageDocumentation Service tests */
import { describe, expect, it, spyOn } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { coverCommand, scaffoldCommand } from "@/services/tests/index.js";

describe("tests service", () => {
  const config = {} as any;

  async function withTempDir(run: (dir: string) => Promise<void>) {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-tests-"));
    const previous = process.cwd();
    process.chdir(tmp);
    try {
      await run(tmp);
    } finally {
      process.chdir(previous);
      await rm(tmp, { recursive: true, force: true });
    }
  }

  it("scaffolds invariant tests and skips existing files without force", async () => {
    await withTempDir(async (tmp) => {
      const consoleSpy = spyOn(console, "log").mockImplementation(() => {});
      const invariantsDir = path.join(tmp, "specs");
      await mkdir(invariantsDir, { recursive: true });
      const invariantPath = path.join(invariantsDir, "latency.invariant.cue");
      await writeFile(invariantPath, "x > 0\n", "utf-8");

      const outputDir = path.join(tmp, "tests");

      const firstRun = await scaffoldCommand({ output: outputDir }, config);
      expect(firstRun).toBe(0);

      const generatedPath = path.join(outputDir, "latency.test.ts");
      const generatedContents = await readFile(generatedPath, "utf-8");
      expect(generatedContents).toContain("latency");
      expect(generatedContents).toContain("Auto-generated test");

      // Create a sentinel that should remain when force is not provided
      await writeFile(generatedPath, "// existing", "utf-8");

      const secondRun = await scaffoldCommand({ output: outputDir }, config);
      expect(secondRun).toBe(0);
      const contentsAfterSkip = await readFile(generatedPath, "utf-8");
      expect(contentsAfterSkip).toBe("// existing");

      consoleSpy.mockRestore();
    });
  });

  it("enforces coverage threshold when requested", async () => {
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    const result = await coverCommand({ threshold: 90 }, config);
    expect(result).toBe(1);
    errorSpy.mockRestore();
  });

  it("returns success when coverage meets the implicit threshold", async () => {
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const result = await coverCommand({ threshold: 80 }, config);
    expect(result).toBe(0);
    logSpy.mockRestore();
  });
});
