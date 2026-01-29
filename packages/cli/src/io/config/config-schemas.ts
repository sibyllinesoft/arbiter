/**
 * Configuration Zod Schemas
 *
 * Validation schemas for CLI configuration files.
 * Extracted from config.ts to improve modularity.
 */

import { z } from "zod";

/**
 * GitHub repository configuration schema
 */
export const gitHubRepoSchema = z.object({
  owner: z.string().optional(), // Made optional for auto-detection
  repo: z.string().optional(), // Made optional for auto-detection
  token: z.string().optional(),
  baseUrl: z.string().url().optional(),
  tokenEnv: z.string().optional(),
});

export const gitHubTemplateFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  required: z.boolean().optional(),
  type: z.enum(["text", "number", "date", "select", "boolean"]).optional(),
  default: z.string().optional(),
  pattern: z.string().optional(),
  help: z.string().optional(),
});

export const gitHubFieldValidationSchema = z.object({
  field: z.string(),
  required: z.boolean().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  pattern: z.string().optional(),
  enum: z.array(z.string()).optional(),
  validator: z.string().optional(),
  errorMessage: z.string().optional(),
});

export const gitHubTemplateSectionsSchema = z.object({
  description: z.string().optional(),
  details: z.array(gitHubTemplateFieldSchema).optional(),
  acceptanceCriteria: z.string().optional(),
  dependencies: z.string().optional(),
  additional: z.record(z.string()).optional(),
});

export const gitHubTemplateValidationSchema = z.object({
  fields: z.array(gitHubFieldValidationSchema).optional(),
  custom: z.array(z.string()).optional(),
});

export const gitHubTemplateSetSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  sections: gitHubTemplateSectionsSchema.optional(),
  labels: z.array(z.string()).optional(),
  validation: gitHubTemplateValidationSchema.optional(),
});

export const gitHubTemplateOptionsSchema = z.object({
  includeMetadata: z.boolean().optional(),
  includeArbiterIds: z.boolean().optional(),
  includeAcceptanceCriteria: z.boolean().optional(),
  includeDependencies: z.boolean().optional(),
  includeEstimations: z.boolean().optional(),
  customFields: z.record(z.string()).optional(),
});

export const gitHubTemplateConfigSchema = z.object({
  inherits: z.string().optional(),
  name: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  sections: gitHubTemplateSectionsSchema.partial().optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  validation: gitHubTemplateValidationSchema.optional(),
  options: gitHubTemplateOptionsSchema.optional(),
});

export const gitHubLabelSchema = z.object({
  name: z.string(),
  color: z.string(),
  description: z.string().optional(),
});

export const gitHubRepoConfigSchema = z.object({
  issueConfig: z
    .object({
      blankIssuesEnabled: z.boolean().optional(),
      contactLinks: z
        .array(
          z.object({
            name: z.string(),
            url: z.string().url(),
            about: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
  labels: z.array(gitHubLabelSchema).optional(),
  pullRequestTemplate: z.string().optional(),
});

export const gitHubTemplatesConfigSchema = z
  .object({
    base: gitHubTemplateSetSchema.optional(),
    group: gitHubTemplateConfigSchema.optional(),
    issue: gitHubTemplateConfigSchema.optional(),
    bugReport: gitHubTemplateConfigSchema.optional(),
    featureRequest: gitHubTemplateConfigSchema.optional(),
    repositoryConfig: gitHubRepoConfigSchema.optional(),
  })
  .optional();

export const gitHubPrefixesSchema = z
  .object({
    group: z.string().optional(),
    issue: z.string().optional(),
  })
  .optional();

export const gitHubLabelsSchema = z
  .object({
    default: z.array(z.string()).optional(),
    groups: z.record(z.array(z.string())).optional(),
    issues: z.record(z.array(z.string())).optional(),
  })
  .optional();

export const gitHubAutomationSchema = z
  .object({
    createMilestones: z.boolean().optional(),
    autoClose: z.boolean().optional(),
    syncAcceptanceCriteria: z.boolean().optional(),
    syncAssignees: z.boolean().optional(),
  })
  .optional();

export const gitHubSyncSchema = z.object({
  repository: gitHubRepoSchema.optional(),
  prefixes: gitHubPrefixesSchema,
  labels: gitHubLabelsSchema,
  automation: gitHubAutomationSchema,
  templates: gitHubTemplatesConfigSchema.optional(),
});

export const projectStructureSchema = z
  .object({
    clientsDirectory: z.string().optional(),
    servicesDirectory: z.string().optional(),
    packagesDirectory: z.string().optional(),
    toolsDirectory: z.string().optional(),
    docsDirectory: z.string().optional(),
    testsDirectory: z.string().optional(),
    infraDirectory: z.string().optional(),
    packageRelative: z
      .object({
        docsDirectory: z.boolean().optional(),
        testsDirectory: z.boolean().optional(),
        infraDirectory: z.boolean().optional(),
      })
      .optional(),
  })
  .optional();

export const uiOptionCatalogSchema = z
  .object({
    frontendFrameworks: z.array(z.string()).optional(),
    serviceLanguages: z.array(z.string()).optional(),
    serviceFrameworks: z.record(z.string(), z.array(z.string())).optional(),
    databaseEngines: z.array(z.string()).optional(),
    infrastructureScopes: z.array(z.string()).optional(),
  })
  .optional();

export const uiOptionGeneratorsSchema = z
  .object({
    frontendFrameworks: z.string().optional(),
    serviceLanguages: z.string().optional(),
    serviceFrameworks: z.string().optional(),
    databaseEngines: z.string().optional(),
    infrastructureScopes: z.string().optional(),
  })
  .optional();

export const generatorHooksSchema = z
  .object({
    "before:generate": z.string().optional(),
    "after:generate": z.string().optional(),
    "before:fileWrite": z.string().optional(),
    "after:fileWrite": z.string().optional(),
  })
  .optional();

export const testingLanguageSchema = z.object({
  framework: z.string().optional(),
  outputDir: z.string().optional(),
  command: z.string().optional(),
  options: z.record(z.unknown()).optional(),
});

export const generatorTestingSchema = z
  .object({
    master: z
      .object({
        type: z.enum(["make", "node"]).optional(),
        output: z.string().optional(),
      })
      .optional(),
  })
  .optional();

export const dockerTemplateSchema = z
  .object({
    dockerfile: z.string().optional(),
    dockerignore: z.string().optional(),
  })
  .strict();

export const dockerGeneratorSchema = z
  .object({
    defaults: z
      .object({
        service: dockerTemplateSchema.optional(),
        client: dockerTemplateSchema.optional(),
      })
      .optional(),
    services: z.record(z.string(), dockerTemplateSchema).optional(),
    clients: z.record(z.string(), dockerTemplateSchema).optional(),
  })
  .optional();

export const languagePluginSchema = z
  .object({
    testing: testingLanguageSchema.optional(),
  })
  .catchall(z.unknown());

export const generatorSchema = z
  .object({
    templateOverrides: z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
    plugins: z.record(z.string(), languagePluginSchema).optional(),
    hooks: generatorHooksSchema,
    testing: generatorTestingSchema,
    docker: dockerGeneratorSchema,
  })
  .optional();

/**
 * Main configuration schema for CLI config files
 */
export const configSchema = z.object({
  apiUrl: z.string().url().optional(),
  timeout: z.number().min(100).max(10_000).optional(), // Generous ceiling while preventing hangs
  format: z.enum(["table", "json", "yaml"]).optional(),
  color: z.boolean().optional(),
  projectDir: z.string().optional(),
  projectId: z.string().optional(),
  github: gitHubSyncSchema.optional(),
  projectStructure: projectStructureSchema,
  uiOptions: uiOptionCatalogSchema,
  uiOptionGenerators: uiOptionGeneratorsSchema,
  generator: generatorSchema,
});
