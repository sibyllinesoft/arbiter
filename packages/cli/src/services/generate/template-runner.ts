import path from "node:path";
import {
  generateComponent,
  generateService,
  initializeProject,
  registry as languageRegistry,
} from "../../language-plugins/index.js";
import type { CLIConfig, GeneratorTestingConfig } from "../../types.js";

export { generateComponent, generateService, initializeProject };

export function configureLanguagePluginRuntime(language: string, cliConfig: CLIConfig): void {
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

  languageRegistry.configure(language, {
    templateOverrides: resolvedOverrides,
    pluginConfig: generatorConfig?.plugins?.[language],
    workspaceRoot: cliConfig.projectDir,
    testing: getLanguageTestingConfig(generatorConfig?.testing, language),
  });
}

export function getLanguagePlugin(language: string) {
  return languageRegistry.get(language);
}

function getLanguageTestingConfig(
  testingConfig: GeneratorTestingConfig | undefined,
  language: string,
) {
  if (!testingConfig) {
    return undefined;
  }

  const languageConfig = testingConfig[language];
  if (!languageConfig) {
    return undefined;
  }

  return languageConfig;
}
