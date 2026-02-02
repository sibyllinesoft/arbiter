import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as cue from "@/constraints/cli-integration.js";
import * as cueValidate from "@/cue/index.js";
import { ApiClient } from "@/io/api/api-client.js";
import { SpecificationRepository } from "@/repositories/specification-repository.js";
import { runAddCommand } from "@/services/add/index.js";
import * as markdownHandlers from "@/services/add/markdown-handlers.js";
import * as projectUtils from "@/utils/api/project.js";

let origCwd: string;
let tmpDir: string | null = null;

beforeEach(() => {
  origCwd = process.cwd();
});

afterEach(async () => {
  mock.restore();
  process.chdir(origCwd);
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    tmpDir = null;
  }
});

describe("runAddCommand dispatcher", () => {
  it("initializes local assembly when missing and runs subcommand", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "arbiter-add-"));
    process.chdir(tmpDir);

    // Force legacy CUE mode for this test
    spyOn(markdownHandlers, "isMarkdownStorage").mockResolvedValue(false);
    spyOn(cue, "getCueManipulator").mockReturnValue({
      cleanup: async () => {},
      addRoute: async () => "package spec\n// route",
    } as any);
    spyOn(cueValidate, "formatCUE").mockImplementation(async (c: string) => c);
    spyOn(SpecificationRepository.prototype, "getSpecification").mockResolvedValue({
      success: false,
    } as any);
    spyOn(cueValidate, "validateCUE").mockResolvedValue({
      valid: true,
      errors: [],
    } as any);
    spyOn(ApiClient.prototype, "listProjects").mockResolvedValue({
      success: true,
      data: [],
    } as any);
    spyOn(ApiClient.prototype, "createProject").mockResolvedValue({
      success: true,
      data: { id: "cli-project" },
    } as any);

    const code = await runAddCommand("route", "demo", { verbose: true }, {
      projectDir: tmpDir,
      localMode: true,
      apiUrl: "https://api",
    } as any);

    expect(code).toBe(0);
    const assembly = await readFile(path.join(tmpDir, ".arbiter", "assembly.cue"), "utf-8");
    expect(assembly).toContain("package");
  });

  it("falls back to local spec when service retrieval fails", async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "arbiter-add-"));
    process.chdir(tmpDir);

    const arbDir = path.join(tmpDir, ".arbiter");
    await fs.mkdir(arbDir, { recursive: true });
    await writeFile(path.join(arbDir, "assembly.cue"), "package spec\n", "utf-8");

    spyOn(cue, "getCueManipulator").mockReturnValue({
      cleanup: async () => {},
      addRoute: async () => "package spec\n// updated",
    } as any);
    spyOn(cueValidate, "formatCUE").mockImplementation(async (c: string) => c);
    spyOn(SpecificationRepository.prototype, "getSpecification").mockResolvedValue({
      success: false,
    } as any);
    const apiStoreSpy = spyOn(
      SpecificationRepository.prototype,
      "storeSpecification",
    ).mockResolvedValue({
      success: true,
      data: { shard: "route" },
    } as any);
    spyOn(projectUtils, "ensureProjectExists").mockResolvedValue("cli-project");
    spyOn(ApiClient.prototype, "listProjects").mockResolvedValue({
      success: true,
      data: [],
    } as any);
    spyOn(ApiClient.prototype, "createProject").mockResolvedValue({
      success: true,
      data: { id: "cli-project" },
    } as any);
    spyOn(ApiClient.prototype, "getProject").mockResolvedValue({
      success: true,
      data: { spec: { services: {} } },
    } as any);
    spyOn(ApiClient.prototype, "createProjectEntity").mockResolvedValue({
      success: true,
      data: { id: "ent-1" },
    } as any);
    spyOn(ApiClient.prototype, "updateProjectEntity").mockResolvedValue({
      success: true,
    } as any);
    spyOn(cueValidate, "validateCUE").mockResolvedValue({
      valid: true,
      errors: [],
    } as any);

    const code = await runAddCommand("route", "demo", {}, {
      projectDir: tmpDir,
      localMode: false,
      apiUrl: "https://api",
    } as any);

    expect(code).toBe(0);
    const storedArgs = (apiStoreSpy as any).mock.calls[0][0];
    expect(storedArgs.content).toContain("// updated");
  });
});
