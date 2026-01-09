/** @packageDocumentation CLI command tests */
import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import {
  __contextTesting,
  hydrateCliContext,
  requireCommandConfig,
  resolveCliContext,
} from "@/cli/context.js";
import * as authStore from "@/io/api/auth-store.js";
import * as configModule from "@/io/config/config.js";
import * as projectRepoModule from "@/repositories/project-repository.js";

const baseConfig = {
  apiUrl: "https://api",
  timeout: 1,
  format: "json",
  color: false,
  localMode: true,
  projectDir: process.cwd(),
  projectStructure: {
    clientsDirectory: "clients",
    servicesDirectory: "services",
    packagesDirectory: "packages",
    toolsDirectory: "tools",
    docsDirectory: "docs",
    testsDirectory: "tests",
    infraDirectory: "infra",
  },
} as any;

describe("cli context helpers", () => {
  beforeEach(() => {
    __contextTesting.setActiveConfig(null);
  });

  it("hydrates global context with resolved config", async () => {
    const loadSpy = spyOn(configModule, "loadConfig").mockResolvedValue(baseConfig);
    const overridesSpy = spyOn(configModule, "applyCliOverrides").mockReturnValue(baseConfig);
    const envSpy = spyOn(configModule, "applyEnvironmentOverrides").mockReturnValue(baseConfig);
    const authSpy = spyOn(authStore, "loadAuthSession").mockResolvedValue(null);

    const root = new Command("root");
    const action = new Command("action");
    root.configureOutput({ outputError: () => {} });
    action.configureOutput({ outputError: () => {} });
    root.addCommand(action);

    await hydrateCliContext(root, action);

    expect(requireCommandConfig(action)).toEqual(baseConfig);
    expect((root as any).config).toBeUndefined();
    expect((action as any).config).toBeUndefined();

    loadSpy.mockRestore();
    overridesSpy.mockRestore();
    envSpy.mockRestore();
    authSpy.mockRestore();
  });

  it("pulls remote project structure when not in local mode", async () => {
    const serverStructure = { servicesDirectory: "svc", packageRelative: { docsDirectory: true } };
    const loadSpy = spyOn(configModule, "loadConfig").mockResolvedValue({
      ...baseConfig,
      localMode: false,
    });
    const overridesSpy = spyOn(configModule, "applyCliOverrides").mockReturnValue({
      ...baseConfig,
      localMode: false,
    });
    const envSpy = spyOn(configModule, "applyEnvironmentOverrides").mockImplementation((c) => c);
    spyOn(authStore, "loadAuthSession").mockResolvedValue(null);
    const repoSpy = spyOn(projectRepoModule, "ProjectRepository").mockImplementation(() => {
      return {
        fetchProjectStructure: async () => ({
          success: true,
          projectStructure: serverStructure,
        }),
      } as any;
    });

    const context = await resolveCliContext({});

    expect(context.config.projectStructure.servicesDirectory).toBe("svc");
    expect(context.config.projectStructure.packageRelative?.docsDirectory).toBe(true);

    loadSpy.mockRestore();
    overridesSpy.mockRestore();
    envSpy.mockRestore();
    repoSpy.mockRestore();
  });

  it("requires config on command tree", () => {
    const root = new Command("root");
    const child = new Command("child");
    root.addCommand(child);
    (root as any).config = baseConfig;

    expect(requireCommandConfig(child)).toEqual(baseConfig);
    __contextTesting.setActiveConfig(null);
    expect(() => requireCommandConfig(new Command())).toThrow("Configuration not loaded");
  });
});
