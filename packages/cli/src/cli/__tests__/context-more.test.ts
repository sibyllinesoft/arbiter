import { describe, expect, it, spyOn } from "bun:test";
import { Command } from "commander";

import * as api from "../../api-client.js";
import * as authStore from "../../auth-store.js";
import * as configModule from "../../config.js";
import { hydrateCliContext, requireCommandConfig, resolveCliContext } from "../context.js";

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
  it("hydrates root and action command with resolved config", async () => {
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

    expect((root as any).config).toEqual(baseConfig);
    expect((action as any).config).toEqual(baseConfig);

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
    const apiSpy = spyOn(api, "ApiClient").mockImplementation(() => {
      return {
        getProjectStructureConfig: async () => ({
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
    apiSpy.mockRestore();
  });

  it("requires config on command tree", () => {
    const root = new Command("root");
    const child = new Command("child");
    root.addCommand(child);
    (root as any).config = baseConfig;

    expect(requireCommandConfig(child)).toBe(baseConfig);
    expect(() => requireCommandConfig(new Command())).toThrow("Configuration not loaded");
  });
});
