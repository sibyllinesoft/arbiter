import { describe, expect, it, spyOn } from "bun:test";
import path from "node:path";
import { registry as languageRegistry } from "@/language-support/index.js";
import {
  configureTemplateOrchestrator,
  getConfiguredLanguagePlugin,
} from "@/services/generate/template-orchestrator.js";
import type { CLIConfig } from "@/types.js";

describe("template orchestrator helpers", () => {
  it("configures language registry with resolved overrides", () => {
    const config: CLIConfig = {
      apiUrl: "http://localhost:5050",
      timeout: 5_000,
      format: "json",
      color: true,
      localMode: false,
      projectDir: "/repo",
      projectStructure: {
        clientsDirectory: "apps",
        servicesDirectory: "services",
        packagesDirectory: "packages",
        toolsDirectory: "tools",
        docsDirectory: "docs",
        testsDirectory: "tests",
        infraDirectory: "infra",
      },
      generator: {
        templateOverrides: {
          typescript: ["@/services/__tests__/templates/ts"],
        },
      },
    };

    const configureSpy = spyOn(languageRegistry, "configure");

    configureTemplateOrchestrator("typescript", config);

    expect(configureSpy).toHaveBeenCalledTimes(1);
    const args = configureSpy.mock.calls[0];
    expect(args[0]).toBe("typescript");
    expect(args[1]?.templateOverrides?.[0]).toBe(path.resolve("/repo", "templates/ts"));
    configureSpy.mockRestore();
  });

  it("returns a registered plugin via getConfiguredLanguagePlugin", () => {
    const plugin = getConfiguredLanguagePlugin("typescript");
    expect(plugin?.name).toBeDefined();
  });
});
