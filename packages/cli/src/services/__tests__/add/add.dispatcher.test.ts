import { describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as cue from "@/constraints/cli-integration.js";
import * as cueValidate from "@/cue/index.js";
import { ApiClient } from "@/io/api/api-client.js";
import { SpecificationRepository } from "@/repositories/specification-repository.js";
import { runAddCommand } from "@/services/add/index.js";
import * as projectUtils from "@/utils/api/project.js";

describe("runAddCommand dispatcher", () => {
  it("initializes local assembly when missing and runs subcommand", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-add-"));
    const prev = process.cwd();
    process.chdir(tmp);

    try {
      const manipSpy = spyOn(cue, "getCueManipulator").mockReturnValue({
        cleanup: async () => {},
        addRoute: async () => "package spec\n// route",
      } as any);
      const formatSpy = spyOn(cueValidate, "formatCUE").mockImplementation(async (c: string) => c);
      const apiSpy = spyOn(SpecificationRepository.prototype, "getSpecification").mockResolvedValue(
        {
          success: false,
        } as any,
      );
      const validateSpy = spyOn(cueValidate, "validateCUE").mockResolvedValue({
        valid: true,
        errors: [],
      } as any);
      const listSpy = spyOn(ApiClient.prototype, "listProjects").mockResolvedValue({
        success: true,
        data: [],
      } as any);
      const createProjSpy = spyOn(ApiClient.prototype, "createProject").mockResolvedValue({
        success: true,
        data: { id: "cli-project" },
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
      formatSpy.mockRestore();
      apiSpy.mockRestore();
      validateSpy.mockRestore();
      listSpy.mockRestore();
      createProjSpy.mockRestore();
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
        addRoute: async () => "package spec\n// updated",
      } as any);
      const formatSpy = spyOn(cueValidate, "formatCUE").mockImplementation(async (c: string) => c);
      const apiGetSpy = spyOn(
        SpecificationRepository.prototype,
        "getSpecification",
      ).mockResolvedValue({
        success: false,
      } as any);
      const apiStoreSpy = spyOn(
        SpecificationRepository.prototype,
        "storeSpecification",
      ).mockResolvedValue({
        success: true,
        data: { shard: "route" },
      } as any);
      const projectSpy = spyOn(projectUtils, "ensureProjectExists").mockResolvedValue(
        "cli-project",
      );
      const listSpy = spyOn(ApiClient.prototype, "listProjects").mockResolvedValue({
        success: true,
        data: [],
      } as any);
      const createProjSpy = spyOn(ApiClient.prototype, "createProject").mockResolvedValue({
        success: true,
        data: { id: "cli-project" },
      } as any);
      const getProjectSpy = spyOn(ApiClient.prototype, "getProject").mockResolvedValue({
        success: true,
        data: { spec: { services: {} } },
      } as any);
      const createEntitySpy = spyOn(ApiClient.prototype, "createProjectEntity").mockResolvedValue({
        success: true,
        data: { id: "ent-1" },
      } as any);
      const updateEntitySpy = spyOn(ApiClient.prototype, "updateProjectEntity").mockResolvedValue({
        success: true,
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
      formatSpy.mockRestore();
      apiGetSpy.mockRestore();
      apiStoreSpy.mockRestore();
      projectSpy.mockRestore();
      listSpy.mockRestore();
      createProjSpy.mockRestore();
      getProjectSpy.mockRestore();
      createEntitySpy.mockRestore();
      updateEntitySpy.mockRestore();
      validateSpy.mockRestore();
    } finally {
      process.chdir(prev);
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
