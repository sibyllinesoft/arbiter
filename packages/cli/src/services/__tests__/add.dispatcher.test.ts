import { describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ApiClient } from "../../api-client.js";
import * as cue from "../../constraints/cli-integration.js";
import * as cueValidate from "../../cue/index.js";
import { runAddCommand } from "../add/index.js";
import * as routeModule from "../add/subcommands/route.js";

describe("runAddCommand dispatcher", () => {
  it("initializes local assembly when missing and runs subcommand", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-add-"));
    const prev = process.cwd();
    process.chdir(tmp);

    try {
      const manipSpy = spyOn(cue, "getCueManipulator").mockReturnValue({
        cleanup: async () => {},
      } as any);
      const routeSpy = spyOn(routeModule, "addRoute").mockResolvedValue("package spec\n// route");
      const apiSpy = spyOn(ApiClient.prototype, "getSpecification").mockResolvedValue({
        success: false,
      } as any);
      const validateSpy = spyOn(cueValidate, "validateCUE").mockResolvedValue({
        valid: true,
        errors: [],
      } as any);

      const code = await runAddCommand("route", "demo", { verbose: true }, {
        projectDir: tmp,
        localMode: true,
        apiUrl: "https://api",
      } as any);

      expect(code).toBe(0);
      const assembly = await readFile(path.join(tmp, ".arbiter", "assembly.cue"), "utf-8");
      expect(assembly).toContain("package");

      manipSpy.mockRestore();
      routeSpy.mockRestore();
      apiSpy.mockRestore();
      validateSpy.mockRestore();
    } finally {
      process.chdir(prev);
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("falls back to local spec when service retrieval fails", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-add-"));
    const prev = process.cwd();
    process.chdir(tmp);

    try {
      const arbDir = path.join(tmp, ".arbiter");
      await fs.mkdir(arbDir, { recursive: true });
      await writeFile(path.join(arbDir, "assembly.cue"), "package spec\n", "utf-8");

      const manipSpy = spyOn(cue, "getCueManipulator").mockReturnValue({
        cleanup: async () => {},
      } as any);
      const routeSpy = spyOn(routeModule, "addRoute").mockResolvedValue("package spec\n// updated");
      const apiGetSpy = spyOn(ApiClient.prototype, "getSpecification").mockResolvedValue({
        success: false,
      } as any);
      const apiStoreSpy = spyOn(ApiClient.prototype, "storeSpecification").mockResolvedValue({
        success: true,
        data: { shard: "route" },
      } as any);
      const validateSpy = spyOn(cueValidate, "validateCUE").mockResolvedValue({
        valid: true,
        errors: [],
      } as any);

      const code = await runAddCommand("route", "demo", {}, {
        projectDir: tmp,
        localMode: false,
        apiUrl: "https://api",
      } as any);

      expect(code).toBe(0);
      const storedArgs = (apiStoreSpy as any).mock.calls[0][0];
      expect(storedArgs.content).toContain("// updated");

      manipSpy.mockRestore();
      routeSpy.mockRestore();
      apiGetSpy.mockRestore();
      apiStoreSpy.mockRestore();
      validateSpy.mockRestore();
    } finally {
      process.chdir(prev);
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
