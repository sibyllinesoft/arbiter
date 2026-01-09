import * as childProcess from "node:child_process";
import { EventEmitter } from "node:events";
import os from "node:os";
import path from "node:path";
import { __generateTesting } from "@/services/generate/io/index.js";
import fs from "fs-extra";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("parseAssemblyFile", () => {
  let tempDir: string;

  afterEach(async () => {
    vi.restoreAllMocks();
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  const buildMockProc = () => {
    const proc: any = new EventEmitter();
    proc.stdout = new EventEmitter();
    proc.stderr = new EventEmitter();
    proc.kill = vi.fn();
    return proc;
  };

  it("falls back to file parsing when cue eval fails", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-assembly-"));
    const assemblyPath = path.join(tempDir, "assembly.cue");
    await fs.writeFile(assemblyPath, 'product: { name: "Fallback App" }\n');

    const proc = buildMockProc();
    vi.spyOn(childProcess, "spawn").mockReturnValue(proc as any);

    const mockReporter = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
    };

    const resultPromise = __generateTesting.parseAssemblyFile(assemblyPath, mockReporter);

    proc.stderr.emit("data", "boom");
    proc.emit("close", 1);

    const config = await resultPromise;
    expect(config.app.product?.name).toBe("Fallback App");
    expect(proc.kill).not.toHaveBeenCalled();
  });

  it("parses JSON output when cue eval succeeds", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "arbiter-assembly-"));
    const assemblyPath = path.join(tempDir, "assembly.cue");
    await fs.writeFile(assemblyPath, "// cue placeholder\n");

    const proc = buildMockProc();
    vi.spyOn(childProcess, "spawn").mockReturnValue(proc as any);

    const mockReporter = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      success: vi.fn(),
    };

    const resultPromise = __generateTesting.parseAssemblyFile(assemblyPath, mockReporter);

    proc.stdout.emit("data", JSON.stringify({ product: { name: "Cue App" } }));
    proc.emit("close", 0);

    const config = await resultPromise;
    expect(config.app.product?.name).toBe("Cue App");
    expect(config.schema.version).toBe("app");
  });
});
