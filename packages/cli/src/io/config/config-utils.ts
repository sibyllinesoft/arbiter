/**
 * Configuration utility functions
 *
 * Helper functions for cloning and merging configuration objects.
 */

import type {
  CLIConfig,
  DockerGeneratorConfig,
  DockerTemplateConfig,
  GeneratorConfig,
  GeneratorTestingConfig,
  LanguagePluginConfig,
} from "@/types.js";
import {
  ARRAY_UI_OPTION_KEYS,
  type UIOptionCatalog,
  type UIOptionGeneratorMap,
  UI_OPTION_KEYS,
} from "@arbiter/shared";

/**
 * Clone a framework map (language -> frameworks[])
 */
export function cloneFrameworkMap(
  map?: Record<string, string[]>,
): Record<string, string[]> | undefined {
  if (!map) return undefined;
  return Object.fromEntries(
    Object.entries(map).map(([language, frameworks]) => [language, [...frameworks]]),
  );
}

/**
 * Clone UI option catalog with proper array copying
 */
export function cloneUIOptionCatalog(options?: UIOptionCatalog): UIOptionCatalog | undefined {
  if (!options) return undefined;

  const cloned: UIOptionCatalog = {};

  for (const key of ARRAY_UI_OPTION_KEYS) {
    const values = options[key];
    if (Array.isArray(values)) {
      cloned[key] = [...values];
    }
  }

  if (options.serviceFrameworks) {
    const frameworks = cloneFrameworkMap(options.serviceFrameworks);
    if (frameworks) {
      cloned.serviceFrameworks = frameworks;
    } else {
      cloned.serviceFrameworks = {};
    }
  }

  return Object.keys(cloned).length > 0 ? cloned : undefined;
}

/**
 * Deep clone a value using JSON serialization
 */
export function deepClone<T>(value: T): T {
  if (value === undefined || value === null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Clone generator configuration
 */
export function cloneGeneratorConfig(config?: GeneratorConfig): GeneratorConfig | undefined {
  if (!config) return undefined;

  return {
    templateOverrides: config.templateOverrides
      ? (deepClone(config.templateOverrides) as Record<string, string | string[]>)
      : undefined,
    plugins: config.plugins
      ? Object.fromEntries(
          Object.entries(config.plugins).map(([language, options]) => [
            language,
            deepClone(options),
          ]),
        )
      : undefined,
    hooks: config.hooks ? { ...config.hooks } : undefined,
    testing: cloneTestingConfig(config.testing),
    docker: cloneDockerConfig(config.docker),
  };
}

/**
 * Clone docker configuration
 */
export function cloneDockerConfig(
  config?: DockerGeneratorConfig,
): DockerGeneratorConfig | undefined {
  if (!config) return undefined;

  const cloned = deepClone(config) as DockerGeneratorConfig;
  return Object.keys(cloned).length > 0 ? cloned : undefined;
}

/**
 * Clone testing configuration
 */
export function cloneTestingConfig(
  testing?: GeneratorTestingConfig,
): GeneratorTestingConfig | undefined {
  if (!testing?.master) return undefined;
  return {
    master: { ...testing.master },
  };
}

/**
 * Merge docker template entries
 */
export function mergeDockerTemplateEntry(
  base?: DockerTemplateConfig,
  overrides?: DockerTemplateConfig,
): DockerTemplateConfig | undefined {
  if (!base && !overrides) return undefined;
  const merged: DockerTemplateConfig = {
    ...(base ?? {}),
    ...(overrides ?? {}),
  };
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Merge docker template records
 */
export function mergeDockerTemplateRecord(
  base?: Record<string, DockerTemplateConfig>,
  overrides?: Record<string, DockerTemplateConfig>,
): Record<string, DockerTemplateConfig> | undefined {
  if (!base && !overrides) return undefined;
  const merged: Record<string, DockerTemplateConfig> = {};
  const keys = new Set([...Object.keys(base ?? {}), ...Object.keys(overrides ?? {})]);

  for (const key of keys) {
    const value = mergeDockerTemplateEntry(base?.[key], overrides?.[key]);
    if (value) {
      merged[key] = value;
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Merge docker defaults configuration
 */
export function mergeDockerDefaults(
  base?: { service?: DockerTemplateConfig; client?: DockerTemplateConfig },
  overrides?: { service?: DockerTemplateConfig; client?: DockerTemplateConfig },
): { service?: DockerTemplateConfig; client?: DockerTemplateConfig } | undefined {
  if (!base && !overrides) return undefined;

  const service = mergeDockerTemplateEntry(base?.service, overrides?.service);
  const client = mergeDockerTemplateEntry(base?.client, overrides?.client);

  const merged: { service?: DockerTemplateConfig; client?: DockerTemplateConfig } = {};
  if (service) merged.service = service;
  if (client) merged.client = client;

  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Merge docker generator configuration
 */
export function mergeDockerConfig(
  base?: DockerGeneratorConfig,
  overrides?: DockerGeneratorConfig,
): DockerGeneratorConfig | undefined {
  if (!base && !overrides) return undefined;

  const defaults = mergeDockerDefaults(base?.defaults, overrides?.defaults);
  const services = mergeDockerTemplateRecord(base?.services, overrides?.services);
  const clients = mergeDockerTemplateRecord(base?.clients, overrides?.clients);

  const merged: DockerGeneratorConfig = {};
  if (defaults) merged.defaults = defaults;
  if (services) merged.services = services;
  if (clients) merged.clients = clients;

  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Merge testing configuration
 */
export function mergeTestingConfig(
  base: GeneratorTestingConfig | undefined,
  overrides: GeneratorTestingConfig | undefined,
): GeneratorTestingConfig | undefined {
  const mergedMaster = {
    ...(base?.master ?? {}),
    ...(overrides?.master ?? {}),
  };

  return Object.keys(mergedMaster).length > 0 ? { master: mergedMaster } : undefined;
}

/**
 * Merge UI option catalog
 */
export function mergeOptionCatalog(
  base: UIOptionCatalog | undefined,
  overrides: UIOptionCatalog | undefined,
): UIOptionCatalog | undefined {
  if (!base && !overrides) return undefined;
  const merged: UIOptionCatalog = {};

  for (const key of ARRAY_UI_OPTION_KEYS) {
    const overrideValues = overrides?.[key];
    const baseValues = base?.[key];

    if (Array.isArray(overrideValues)) {
      merged[key] = [...overrideValues];
    } else if (Array.isArray(baseValues)) {
      merged[key] = [...baseValues];
    }
  }

  if (overrides?.serviceFrameworks) {
    merged.serviceFrameworks = cloneFrameworkMap(overrides.serviceFrameworks) ?? {};
  } else if (base?.serviceFrameworks) {
    merged.serviceFrameworks = cloneFrameworkMap(base.serviceFrameworks) ?? {};
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Merge UI option generators
 */
export function mergeOptionGenerators(
  base: UIOptionGeneratorMap | undefined,
  overrides: UIOptionGeneratorMap | undefined,
): UIOptionGeneratorMap | undefined {
  if (!base && !overrides) return undefined;
  const merged: UIOptionGeneratorMap = {};
  for (const key of UI_OPTION_KEYS) {
    if (overrides?.[key]) {
      merged[key] = overrides[key];
    } else if (base?.[key]) {
      merged[key] = base[key];
    }
  }
  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Merge plugin configurations from base and overrides.
 */
function mergePluginConfigs(
  base: Record<string, LanguagePluginConfig> | undefined,
  overrides: Record<string, LanguagePluginConfig> | undefined,
): Record<string, LanguagePluginConfig> {
  const merged: Record<string, LanguagePluginConfig> = {};

  if (base) {
    for (const [language, options] of Object.entries(base)) {
      merged[language] = deepClone(options);
    }
  }

  if (overrides) {
    for (const [language, options] of Object.entries(overrides)) {
      merged[language] = merged[language]
        ? { ...merged[language], ...deepClone(options) }
        : deepClone(options);
    }
  }

  return merged;
}

/**
 * Build final generator config from merged parts.
 */
function hasContent(obj: Record<string, any>): boolean {
  return Object.keys(obj).length > 0;
}

function returnIfNonEmpty<T>(obj: Record<string, T>): Record<string, T> | undefined {
  return hasContent(obj) ? obj : undefined;
}

function buildGeneratorConfigResult(
  templateOverrides: Record<string, string | string[]>,
  pluginConfig: Record<string, LanguagePluginConfig>,
  hookConfig: Record<string, string>,
  testingConfig: GeneratorTestingConfig | undefined,
  dockerConfig: DockerGeneratorConfig | undefined,
): GeneratorConfig | undefined {
  const hasAnyConfig =
    hasContent(templateOverrides) ||
    hasContent(pluginConfig) ||
    hasContent(hookConfig) ||
    testingConfig ||
    dockerConfig;

  if (!hasAnyConfig) return undefined;

  return {
    templateOverrides: returnIfNonEmpty(templateOverrides),
    plugins: returnIfNonEmpty(pluginConfig),
    hooks: returnIfNonEmpty(hookConfig),
    testing: testingConfig,
    docker: dockerConfig,
  };
}

/**
 * Merge generator configuration
 */
export function mergeGeneratorConfig(
  base: GeneratorConfig | undefined,
  overrides: GeneratorConfig | undefined,
): GeneratorConfig | undefined {
  if (!base && !overrides) return undefined;

  const templateOverrides = deepClone({
    ...(base?.templateOverrides ?? {}),
    ...(overrides?.templateOverrides ?? {}),
  }) as Record<string, string | string[]>;

  const pluginConfig = mergePluginConfigs(base?.plugins, overrides?.plugins);

  const hookConfig = {
    ...(base?.hooks ?? {}),
    ...(overrides?.hooks ?? {}),
  } as Record<string, string>;

  const testingConfig = mergeTestingConfig(base?.testing, overrides?.testing);
  const dockerConfig = mergeDockerConfig(base?.docker, overrides?.docker);

  return buildGeneratorConfigResult(
    templateOverrides,
    pluginConfig,
    hookConfig,
    testingConfig,
    dockerConfig,
  );
}

/**
 * Clone entire CLI configuration
 */
export function cloneConfig(config: CLIConfig): CLIConfig {
  return {
    ...config,
    projectStructure: {
      ...config.projectStructure,
      packageRelative: config.projectStructure.packageRelative
        ? { ...config.projectStructure.packageRelative }
        : undefined,
    },
    uiOptions: cloneUIOptionCatalog(config.uiOptions),
    uiOptionGenerators: config.uiOptionGenerators ? { ...config.uiOptionGenerators } : undefined,
    configFilePath: config.configFilePath,
    configDir: config.configDir,
    authSession: config.authSession
      ? {
          ...config.authSession,
          metadata: config.authSession.metadata ? { ...config.authSession.metadata } : undefined,
        }
      : undefined,
    github: config.github
      ? {
          ...config.github,
          repository: config.github.repository ? { ...config.github.repository } : undefined,
          prefixes: config.github.prefixes ? { ...config.github.prefixes } : undefined,
          labels: config.github.labels ? { ...config.github.labels } : undefined,
          automation: config.github.automation ? { ...config.github.automation } : undefined,
          templates: config.github.templates ? { ...config.github.templates } : undefined,
        }
      : undefined,
    generator: cloneGeneratorConfig(config.generator),
  };
}

/**
 * Check if environment variable is truthy
 */
export function isTruthyEnvFlag(value: string | undefined): boolean {
  if (!value) return false;
  return /^(1|true|yes|verbose)$/i.test(value.trim());
}
