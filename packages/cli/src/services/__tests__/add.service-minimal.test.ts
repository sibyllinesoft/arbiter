import { describe, expect, it, spyOn } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ApiClient } from "../../api-client.js";
import * as cue from "../../constraints/cli-integration.js";
import * as cueValidate from "../../cue/index.js";
import { runAddCommand } from "../add/index.js";
import * as serviceModule from "../add/subcommands/service.js";

describe("runAddCommand service subcommand", () => {
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
      } as any);
      const serviceSpy = spyOn(serviceModule, "addService").mockResolvedValue(
        "package spec\n// svc",
      );
      const apiGetSpy = spyOn(ApiClient.prototype, "getSpecification").mockResolvedValue({
        success: false,
      } as any);
      const apiStoreSpy = spyOn(ApiClient.prototype, "storeSpecification").mockResolvedValue({
        success: true,
        data: { shard: "service" },
      } as any);
      const listSpy = spyOn(ApiClient.prototype, "listProjects").mockResolvedValue({
        success: true,
        data: [],
      } as any);
      const createSpy = spyOn(ApiClient.prototype, "createProject").mockResolvedValue({
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
      const validateSpy = spyOn(cueValidate, "validateCUE").mockResolvedValue({
        valid: true,
        errors: [],
      } as any);

      const code = await runAddCommand("service", "api", {}, {
        projectDir: tmp,
        localMode: false,
        apiUrl: "https://api",
      } as any);

      expect(code).toBe(0);
      const storeArgs = (apiStoreSpy as any).mock.calls[0][0];
      expect(storeArgs.content).toContain("// svc");

      manipSpy.mockRestore();
      serviceSpy.mockRestore();
      apiGetSpy.mockRestore();
      apiStoreSpy.mockRestore();
      listSpy.mockRestore();
      createSpy.mockRestore();
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
