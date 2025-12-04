import path from "node:path";
import {
  generateComponent,
  generateService,
  initializeProject,
  registry as languageRegistry,
} from "@/language-support/index.js";
import type { CLIConfig } from "@/types.js";

export { generateComponent, generateService, initializeProject };

export function configureTemplateOrchestrator(language: string, cliConfig: CLIConfig): void {
  const generatorConfig = cliConfig.generator;
  const overridesEntry = generatorConfig?.templateOverrides?.[language];
  const overrideList = Array.isArray(overridesEntry)
    ? overridesEntry
    : overridesEntry
      ? [overridesEntry]
      : [];

  const baseDir = cliConfig.configDir || cliConfig.projectDir || process.cwd();
  const resolvedOverrides = overrideList.map((dir) =>
    path.isAbsolute(dir) ? dir : path.resolve(baseDir, dir),
  );

  const pluginConfig = generatorConfig?.plugins?.[language];

  languageRegistry.configure(language, {
    templateOverrides: resolvedOverrides,
    pluginConfig,
    workspaceRoot: cliConfig.projectDir,
    testing: pluginConfig?.testing,
  });
}

export function getConfiguredLanguagePlugin(language: string) {
  return languageRegistry.get(language);
}
