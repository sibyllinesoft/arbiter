import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as cue from "@/constraints/cli-integration.js";
import * as cueValidate from "@/cue/index.js";
import { ApiClient } from "@/io/api/api-client.js";
import { SpecificationRepository } from "@/repositories/specification-repository.js";
import { runAddCommand } from "@/services/add/index.js";
import * as projectUtils from "@/utils/api/project.js";

describe("runAddCommand service subcommand", () => {
  afterEach(() => {
    mock.restore();
  });

  it("adds a service and stores remotely when validation passes", async () => {
    const tmp = await mkdtemp(path.join(os.tmpdir(), "arbiter-add-service-"));
    const prev = process.cwd();
    process.chdir(tmp);

    try {
      const arbDir = path.join(tmp, ".arbiter");
      await fs.mkdir(arbDir, { recursive: true });
      await writeFile(path.join(arbDir, "assembly.cue"), "package spec\n", "utf-8");

      const manipSpy = spyOn(cue, "getCueManipulator").mockReturnValue({
        cleanup: async () => {},
        addService: async () => "package spec\n// svc",
        addRoute: async (content: string) => content,
        addToSection: async (content: string) => content,
      } as any);
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
        data: { shard: "service" },
      } as any);
      const validateSpy = spyOn(cueValidate, "validateCUE").mockResolvedValue({
        valid: true,
        errors: [],
      } as any);
      const formatSpy = spyOn(cueValidate, "formatCUE").mockImplementation(async (c: string) => c);
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
        data: { id: "svc1" },
      } as any);
      const updateEntitySpy = spyOn(ApiClient.prototype, "updateProjectEntity").mockResolvedValue({
        success: true,
      } as any);

      const code = await runAddCommand("service", "api", {}, {
        projectDir: tmp,
        localMode: false,
        apiUrl: "https://api",
        timeout: 1000,
      } as any);

      expect(code).toBe(0);
      const storeArgs = (apiStoreSpy as any).mock.calls[0][0];
      expect(storeArgs.content).toContain("// svc");

      manipSpy.mockRestore();
      apiGetSpy.mockRestore();
      apiStoreSpy.mockRestore();
      formatSpy.mockRestore();
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
