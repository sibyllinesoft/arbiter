/**
 * @packageDocumentation
 * Implements the `generate` command which powers Arbiter code generation.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { safeFileOperation } from "@/constraints/index.js";
import { ApiClient } from "@/io/api/api-client.js";
import { DEFAULT_PROJECT_STRUCTURE } from "@/io/config/config.js";
import type {
  EndpointAssertionDefinition,
  EndpointTestCaseDefinition,
  EndpointTestGenerationConfig,
  ProjectConfig as LanguageProjectConfig,
  ServiceConfig as LanguageServiceConfig,
} from "@/language-support/index.js";
import { SpecificationRepository } from "@/repositories/specification-repository.js";
import { generateAPISpecifications } from "@/services/generate/api/api-specifications.js";
import {
  type BehaviorRouteMetadata,
  deriveBehaviorRouteMetadata,
  extractTestId,
  humanizeTestId,
  sanitizeTestId,
} from "@/services/generate/api/behavior-metadata.js";
import {
  DEFAULT_TESTING_FRAMEWORKS,
  collectEndpointAssertionCases,
  escapeGoString,
  escapeRustString,
  generateEndpointAssertionTests,
  generateGoEndpointAssertionTest,
  generateJsTsEndpointAssertionTest,
  generatePythonEndpointAssertionTest,
  generateRustEndpointAssertionTest,
  normalizeCasesForSerialization,
  normalizeCueAssertion,
  normalizeCueAssertionBlock,
  normalizeJsFramework,
  resolveTestingFramework,
} from "@/services/generate/api/endpoint-assertions.js";
import {
  generateGoFiles,
  generateLanguageFiles,
  generatePythonFiles,
  generateRustFiles,
  generateShellFiles,
  generateTypeScriptFiles,
} from "@/services/generate/api/language-generators.js";
import {
  type RouteBindingInput,
  SUPPORTED_HTTP_METHODS,
  deriveServiceAliases,
  deriveServiceEndpointsFromBehaviors,
  deriveServiceEndpointsFromPaths,
  determinePathOwnership,
  extractExampleFromContent,
  extractResponseMetadata,
  isTypeScriptServiceLanguage,
  mergeRouteBindings,
  pathBelongsToService,
} from "@/services/generate/api/route-derivation.js";
import {
  discoverSpecs,
  ensureBaseStructure,
  executeCommand,
  resolveAssemblyPath,
  shouldAbortOnWarnings,
  shouldSyncGithub,
} from "@/services/generate/core/compose/assembly-helpers.js";
import {
  detectSchemaVersion,
  fallbackParseAssembly,
  normalizeCapabilities,
  parseAppSchema,
  parseAssemblyFile,
} from "@/services/generate/core/compose/assembly-parser.js";
import {
  generateDockerComposeArtifacts,
  parseDockerComposeServices,
} from "@/services/generate/core/compose/compose.js";
import {
  buildDevProxyConfig,
  enhanceClientDevServer,
  generateProjectStructure,
  generateServiceInfrastructureArtifacts,
  generateServiceStructures,
} from "@/services/generate/core/compose/project-structure.js";
import {
  type PathRouter,
  type PathRouterInput,
  createRouter,
  validateGroupReferences,
} from "@/services/generate/core/compose/router.js";
import {
  type AssemblyResolutionResult,
  resolveAssemblyFile,
  showAvailableSpecs,
} from "@/services/generate/core/orchestration/assembly-resolution.js";
import type { TargetCreationOptions } from "@/services/generate/core/orchestration/targets.js";
import {
  collectClientTargets,
  collectPackageTargets,
  collectServiceTargets,
  collectToolTargets,
  createClientTarget,
  createPackageTarget,
  createServiceTarget,
  createToolTarget,
  toRelativePath,
} from "@/services/generate/core/orchestration/targets.js";
import {
  configureTemplateOrchestrator,
  generateComponent,
  generateService,
  getConfiguredLanguagePlugin,
  initializeProject,
} from "@/services/generate/core/orchestration/template-orchestrator.js";
import {
  handleValidationResult,
  reportForceWarnings,
  reportResults,
} from "@/services/generate/core/orchestration/validation-handler.js";
import {
  getBuildCommand,
  getInstallCommand,
  getLintCommand,
  getPrerequisites,
  getRunCommand,
  getTestCommand,
} from "@/services/generate/helpers/commands.js";
import { writeClientReadme, writeServiceReadme } from "@/services/generate/helpers/readme.js";
import {
  generateTerraformArtifacts,
  parseDeploymentServiceConfig,
} from "@/services/generate/infrastructure/terraform.js";
import type {
  ClientGenerationContext,
  ClientGenerationTarget,
  PackageGenerationContext,
  PackageGenerationTarget,
  ServiceGenerationContext,
  ServiceGenerationTarget,
  ToolGenerationContext,
  ToolGenerationTarget,
} from "@/services/generate/io/contexts.js";
import { generateModuleArtifacts } from "@/services/generate/io/module-artifacts.js";
import {
  TestCompositionEngine,
  generateServiceTests,
  generateTestFileContent,
  handleTestGenerationError,
  reportTestComposition,
  writeTestFiles,
} from "@/services/generate/io/test-composition.js";
import type { ArtifactGeneratorContext } from "@/services/generate/strategies/base.js";
import { CIWorkflowGenerator } from "@/services/generate/strategies/ci-workflow-generator.js";
import {
  ApiSpecGenerator,
  CapabilityFeaturesGenerator,
  ClientArtifactsGenerator,
  ModuleArtifactsGenerator,
  ServiceArtifactsGenerator,
  ToolingArtifactsGenerator,
  WorkspaceManifestGenerator,
} from "@/services/generate/strategies/core-artifact-generators.js";
import { DocumentationGenerator } from "@/services/generate/strategies/documentation-generator.js";
import { InfrastructureGenerator } from "@/services/generate/strategies/infrastructure-generator.js";
import { TestGenerator } from "@/services/generate/strategies/test-generator.js";
import {
  type HealthConfiguration,
  generateDocumentation,
  generateDocumentationArtifacts,
  generateInfrastructureArtifacts,
  generateToolingArtifacts,
  getTerraformWorkloadType,
  loadDockerTemplateContent,
} from "@/services/generate/util/artifact-generators.js";
import {
  buildDefaultClientDockerArtifacts,
  buildDefaultServiceDockerArtifacts,
  generateClientDockerArtifacts,
  generateServiceDockerArtifacts,
  getPrimaryServicePort,
} from "@/services/generate/util/docker/docker-generator.js";
import {
  ensureDirectory,
  setActiveHookManager,
  writeFileWithHooks,
} from "@/services/generate/util/hook-executor.js";
import { joinRelativePath, slugify, toPathSegments } from "@/services/generate/util/shared.js";
import { generateBehaviorBasedTests } from "@/services/generate/util/test/behavior-tests.js";
import {
  type TestTask,
  buildClientTestTasks,
  buildDefaultTestCommands,
  buildEndpointAssertionTask,
  createNodeRunnerScript,
  generateMasterTestRunner,
  generateWorkspaceManifest,
  getMasterRunnerConfig,
  getPluginTestingConfig,
  isWorkspaceFriendlyLanguage,
  resolveTestingCommand,
} from "@/services/generate/util/test/test-runner.js";
import type { GenerateOptions, GenerationReporter } from "@/services/generate/util/types.js";
import {
  buildRouteComponentContent,
  generateLocatorDefinitions,
  generateUIComponents,
} from "@/services/generate/util/ui-components.js";
import {
  type ServiceSummary,
  extractServiceSummaries,
  formatLanguage,
  friendlyServiceName,
  generateCIWorkbehaviors,
  inferPrimaryLanguage,
} from "@/services/generate/util/workflow/ci-workflow.js";
import { handleGitHubSync } from "@/services/generate/util/workflow/github-sync.js";
import type {
  CLIConfig,
  CapabilitySpec,
  GeneratorConfig,
  GeneratorTestingConfig,
  LanguageTestingConfig,
  MasterTestRunnerConfig,
  ProjectStructureConfig,
} from "@/types.js";
import { GenerationHookManager } from "@/utils/api/generation-hooks.js";
import {
  resolveServiceArtifactType,
  resolveServiceWorkload,
} from "@/utils/api/service-metadata.js";
import { ShardedCUEStorage } from "@/utils/github/sharded-storage.js";
import { createRepositoryConfig } from "@/utils/io/git-detection.js";
import {
  type PackageManagerCommandSet,
  detectPackageManager,
  getPackageManagerCommands,
} from "@/utils/io/package-manager.js";
import { formatWarnings, validateSpecification } from "@/validation/warnings.js";
import type {
  AppSpec,
  AssemblyConfig,
  ConfigWithVersion,
  CueAssertion,
  CueAssertionBlock,
  PackageConfig as DeploymentServiceConfig,
  DeploymentTarget,
  EnhancedGenerateOptions,
  GroupSpec,
  PackageConfig,
  SchemaVersion,
  ServiceArtifactType,
  TestCase,
  TestCompositionResult,
  TestSuite,
} from "@arbiter/specification";
import fs from "fs-extra";
import * as YAML from "yaml";
export type { GenerateOptions } from "@/services/generate/util/types.js";

// Fallback reporter used by helper functions; generateCommand provides a scoped reporter when invoked
const reporter: GenerationReporter = {
  info: (...args: any[]) => console.info(...args),
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
};

// Re-export parser functions for backwards compatibility
export {
  detectSchemaVersion,
  parseAppSchema,
  normalizeCapabilities,
} from "@/services/generate/core/compose/assembly-parser.js";

// Re-export target creation functions for backwards compatibility
export {
  collectClientTargets,
  collectPackageTargets,
  collectServiceTargets,
  collectToolTargets,
  createClientTarget,
  createPackageTarget,
  createServiceTarget,
  createToolTarget,
  toRelativePath,
  type TargetCreationOptions,
} from "@/services/generate/core/orchestration/targets.js";

// Expose targeted helpers for testing without touching main command surface
export const __generateTesting = {
  determinePathOwnership,
  buildDevProxyConfig,
  deriveBehaviorRouteMetadata,
  extractTestId,
  sanitizeTestId,
  humanizeTestId,
  pathBelongsToService,
  isTypeScriptServiceLanguage,
  getPrimaryServicePort,
  discoverSpecs,
  detectSchemaVersion,
  parseAppSchema,
  parseAssemblyFile,
  ensureBaseStructure,
  enhanceClientDevServer,
  createServiceTarget,
  createClientTarget,
  collectClientTargets,
  toRelativePath,
  buildRouteComponentContent,
  buildDefaultServiceDockerArtifacts,
  buildDefaultClientDockerArtifacts,
  resolveAssemblyPath,
  shouldAbortOnWarnings,
  shouldSyncGithub,
  executeCommand,
  handleGitHubSync,
  deriveServiceEndpointsFromPaths,
  deriveServiceEndpointsFromBehaviors,
};

function createDefaultReporter(): GenerationReporter {
  return {
    info: (...args: any[]) => console.info(...args),
    warn: (...args: any[]) => console.warn(...args),
    error: (...args: any[]) => console.error(...args),
  };
}

function shouldSkipDryRun(options: GenerateOptions, reporter: GenerationReporter): boolean {
  if (process.env.ARBITER_SKIP_CUE === "1" && options.dryRun) {
    reporter.info("Skipping generation body (ARBITER_SKIP_CUE set, dry-run enabled)");
    return true;
  }
  return false;
}

async function runGenerationWorkflow(
  specName: string | undefined,
  options: GenerateOptions,
  config: CLIConfig,
  reporter: GenerationReporter,
): Promise<number> {
  await prepareSpecificationSource(config, options, reporter);

  const resolution = resolveAssemblyFile(specName, options, reporter);
  if (!resolution.success) return resolution.errorCode ?? 1;

  const configWithVersion = await parseAssemblyFile(resolution.assemblyPath!, reporter);
  if (options.verbose) reportAssemblyConfig(configWithVersion, reporter);

  reporter.info("🔍 Validating specification completeness...");
  const validationResult = validateSpecification(configWithVersion.app);
  const validation = handleValidationResult(validationResult, options, reporter);
  if (!validation.proceed) return validation.exitCode ?? 1;

  if (shouldSkipDryRun(options, reporter)) return 0;

  return executeGeneration(configWithVersion, options, config, reporter);
}

/**
 * Executes the `generate` command using the provided CLI and runtime options.
 */
export async function generateCommand(
  options: GenerateOptions,
  config: CLIConfig,
  specName?: string,
): Promise<number> {
  const reporter = options.reporter ?? createDefaultReporter();

  if (options.verbose) {
    reporter.info("🔧 Generate options:", JSON.stringify(options, null, 2));
  }

  try {
    reporter.info("🏗️  Generating project artifacts from assembly.cue...");
    return runGenerationWorkflow(specName, options, config, reporter);
  } catch (error) {
    reporter.error("❌ Generate failed:", error instanceof Error ? error.message : String(error));
    return 1;
  }
}

async function prepareSpecificationSource(
  config: CLIConfig,
  options: GenerateOptions,
  reporter: GenerationReporter,
): Promise<void> {
  if (config.localMode) {
    if (options.verbose) {
      reporter.info("📁 Local mode enabled: using existing .arbiter CUE files");
    }
  } else {
    await emitSpecificationFromService(config);
  }
}

function reportAssemblyConfig(
  configWithVersion: ConfigWithVersion,
  reporter: GenerationReporter,
): void {
  reporter.info("Assembly configuration:");
  reporter.info(
    `Schema detected from ${configWithVersion.schema.detected_from} data (application model)`,
  );
  reporter.info(JSON.stringify(configWithVersion, null, 2));
}

function ensureOutputDirectory(options: GenerateOptions, config: CLIConfig): string {
  const outputDir = path.resolve(options.projectDir ?? config.projectDir ?? process.cwd());
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  return outputDir;
}

function setupPackageManager(
  outputDir: string,
  options: GenerateOptions,
  reporter: GenerationReporter,
): PackageManagerCommandSet {
  const detectedPackageManager = detectPackageManager(undefined, outputDir);
  if (options.verbose) {
    reporter.info(`🧺 Detected ${detectedPackageManager} for workspace instructions`);
  }
  return getPackageManagerCommands(detectedPackageManager);
}

async function runGenerationPipeline(
  configWithVersion: ConfigWithVersion,
  outputDir: string,
  options: GenerateOptions,
  config: CLIConfig,
  packageManagerCommands: PackageManagerCommandSet,
  reporter: GenerationReporter,
  hookManager: GenerationHookManager | null,
): Promise<number> {
  reporter.info("🎨 Generating application artifacts...");
  const projectStructure = buildProjectStructure(config);

  const results = await generateAppArtifacts(
    configWithVersion,
    outputDir,
    options,
    projectStructure,
    config,
    packageManagerCommands,
    reporter,
  );

  reportResults(results, options, reporter);

  if (hookManager) {
    await hookManager.runAfterGenerate(results);
  }

  if (options.syncGithub || options.githubDryRun) {
    await handleGitHubSync(options, config);
  }

  return 0;
}

async function executeGeneration(
  configWithVersion: ConfigWithVersion,
  options: GenerateOptions,
  config: CLIConfig,
  reporter: GenerationReporter,
): Promise<number> {
  const outputDir = ensureOutputDirectory(options, config);
  config.projectDir = outputDir;

  const packageManagerCommands = setupPackageManager(outputDir, options, reporter);
  const hookManager = createHookManager(config, outputDir, options);

  if (hookManager) {
    setActiveHookManager(hookManager);
    await hookManager.runBeforeGenerate;
  }

  try {
    return runGenerationPipeline(
      configWithVersion,
      outputDir,
      options,
      config,
      packageManagerCommands,
      reporter,
      hookManager,
    );
  } finally {
    if (hookManager) {
      setActiveHookManager(null);
    }
  }
}

function createHookManager(
  config: CLIConfig,
  outputDir: string,
  options: GenerateOptions,
): GenerationHookManager | null {
  if (!config.generator?.hooks) return null;

  return new GenerationHookManager({
    hooks: config.generator.hooks,
    workspaceRoot: config.projectDir || process.cwd(),
    outputDir: path.resolve(outputDir),
    configDir: config.configDir,
    dryRun: Boolean(options.dryRun),
  });
}

function buildProjectStructure(config: CLIConfig): ProjectStructureConfig {
  return {
    ...DEFAULT_PROJECT_STRUCTURE,
    ...config.projectStructure,
    packageRelative: {
      ...DEFAULT_PROJECT_STRUCTURE.packageRelative,
      ...(config.projectStructure?.packageRelative ?? {}),
    },
  };
}

/**
 * Generate app-centric artifacts from app specification
 */
async function generateAppArtifacts(
  configWithVersion: ConfigWithVersion,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  cliConfig: CLIConfig,
  packageManager: PackageManagerCommandSet,
  reporter: GenerationReporter,
): Promise<string[]> {
  const files: string[] = [];
  const appSpec = configWithVersion.app;
  let testsWorkspaceRelative: string | undefined;

  if (!appSpec) {
    return files;
  }

  reporter.info(`📱 Generating artifacts for: ${appSpec.product.name}`);

  await ensureBaseStructure(structure, outputDir, options);

  const clientTargets = collectClientTargets(appSpec, structure, outputDir);

  // Strategy-based artifact generators
  const strategyContext: ArtifactGeneratorContext = {
    appSpec,
    configWithVersion,
    outputDir,
    options,
    structure,
    cliConfig,
    packageManager,
    clientTargets,
    testsWorkspaceRelative: undefined as string | undefined,
    reporter: reporter.createChild?.("generate") ?? reporter,
  };

  const strategies = [
    new ClientArtifactsGenerator({
      generateUIComponents,
      generateLocatorDefinitions,
      generateBehaviorBasedTests,
      generateProjectStructure,
      ensureDirectory,
      toRelativePath,
    }),
    new CapabilityFeaturesGenerator(generateCapabilityFeatures),
    new ApiSpecGenerator(generateAPISpecifications),
    new ServiceArtifactsGenerator(generateServiceStructures),
    new ModuleArtifactsGenerator(generateModuleArtifacts),
    new ToolingArtifactsGenerator(generateToolingArtifacts),
    new DocumentationGenerator(generateDocumentationArtifacts),
    new InfrastructureGenerator(generateInfrastructureArtifacts),
    new TestGenerator(generateEndpointAssertionTests, generateMasterTestRunner),
    new CIWorkflowGenerator(generateCIWorkbehaviors),
    new WorkspaceManifestGenerator(generateWorkspaceManifest),
  ];

  // Code-generating strategies that should be skipped with --no-code
  const codeStrategies = new Set([
    "client-artifacts",
    "capability-features",
    "service-artifacts",
    "module-artifacts",
    "tooling-artifacts",
  ]);

  for (const strategy of strategies) {
    // Skip code generation if --no-code flag is set
    if (codeStrategies.has(strategy.name) && options.code === false) {
      continue;
    }
    // Skip tests generation if --no-tests flag is set
    if (strategy.name === "tests" && options.tests === false) {
      continue;
    }
    // Skip documentation generation if --no-docs flag is set
    if (strategy.name === "documentation" && options.docs === false) {
      continue;
    }
    const generated = await strategy.generate(strategyContext);
    files.push(...generated);
  }

  testsWorkspaceRelative = strategyContext.testsWorkspaceRelative;

  const workspaceManifestFiles = await generateWorkspaceManifest(
    appSpec,
    outputDir,
    options,
    structure,
    clientTargets,
    testsWorkspaceRelative,
    packageManager,
  );
  files.push(...workspaceManifestFiles);

  return files;
}

/**
 * Filter capabilities that have valid gherkin specifications
 */
function filterCapabilitiesWithGherkin(
  capabilities: Record<string, CapabilitySpec> | undefined,
): Array<[string, CapabilitySpec]> {
  if (!capabilities || Object.keys(capabilities).length === 0) {
    return [];
  }

  return Object.entries(capabilities).filter(([, capability]) => {
    const spec = capability?.gherkin;
    return typeof spec === "string" && spec.trim().length > 0;
  });
}

/**
 * Build header comments for a capability feature file
 */
function buildCapabilityHeader(capabilityId: string, capability: CapabilitySpec): string[] {
  const headerLines: string[] = [`# Capability: ${capability.name ?? capabilityId}`];

  if (capability.description) {
    headerLines.push(`# Description: ${capability.description}`);
  }
  if (capability.owner) {
    headerLines.push(`# Owner: ${capability.owner}`);
  }
  if (Array.isArray(capability.depends_on) && capability.depends_on.length > 0) {
    headerLines.push(`# Depends on: ${capability.depends_on.join(", ")}`);
  }
  if (Array.isArray(capability.tags) && capability.tags.length > 0) {
    headerLines.push(`# Tags: ${capability.tags.join(", ")}`);
  }

  headerLines.push("");
  return headerLines;
}

/**
 * Normalize gherkin content and ensure Feature: prefix
 */
function normalizeGherkinContent(gherkin: string, fallbackName: string): string {
  const normalized = gherkin.replace(/\r\n?/g, "\n").trim();
  return normalized.startsWith("Feature:") ? normalized : `Feature: ${fallbackName}\n${normalized}`;
}

async function generateCapabilityFeatures(
  appSpec: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
): Promise<string[]> {
  const entries = filterCapabilitiesWithGherkin(appSpec.capabilities);
  if (entries.length === 0) {
    return [];
  }

  const featuresDir = path.join(outputDir, structure.testsDirectory, "features", "capabilities");
  await ensureDirectory(featuresDir, options);

  const files: string[] = [];

  for (const [capabilityId, capability] of entries) {
    const identifier = capabilityId || capability.name || "capability";
    const slug = slugify(
      typeof identifier === "string" ? identifier : String(capabilityId),
      "capability",
    );
    const fileName = `${slug}.feature`;
    const filePath = path.join(featuresDir, fileName);

    const headerLines = buildCapabilityHeader(capabilityId, capability);
    const featureBody = normalizeGherkinContent(capability.gherkin!, capability.name ?? slug);
    const content = [...headerLines, featureBody, ""].join("\n");

    await writeFileWithHooks(filePath, content, options);
    files.push(joinRelativePath(structure.testsDirectory, "features", "capabilities", fileName));
  }

  return files;
}

/**
 * Check if remote spec emission should be skipped
 */
function shouldSkipRemoteSpec(config: CLIConfig): boolean {
  return config.localMode || process.env.ARBITER_SKIP_REMOTE_SPEC === "1";
}

/**
 * Write assembly content to file
 */
async function writeAssemblyFile(assemblyPath: string, content: string): Promise<void> {
  await safeFileOperation("write", assemblyPath, async (validatedPath) => {
    await fs.writeFile(validatedPath, content, "utf-8");
  });
  reporter.info("📄 Emitted CUE specification from service to .arbiter/assembly.cue");
}

/**
 * Emit sharded CUE specifications from service to .arbiter directory before generation
 */
async function emitSpecificationFromService(config: CLIConfig): Promise<void> {
  if (shouldSkipRemoteSpec(config)) return;

  try {
    const apiClient = new ApiClient(config);
    const specRepo = new SpecificationRepository(apiClient);

    await fs.ensureDir(".arbiter");
    const assemblyPath = path.resolve(".arbiter", "assembly.cue");
    const storedSpec = await specRepo.getSpecification("assembly", assemblyPath);

    if (storedSpec.success && storedSpec.data?.content) {
      await writeAssemblyFile(assemblyPath, storedSpec.data.content);
      await emitShardedSpecifications(specRepo);
    } else {
      reporter.info("💡 No stored specification found, using existing CUE files");
    }
  } catch {
    reporter.info("💡 Service unavailable, using existing CUE files");
  }
}

/**
 * Emit additional sharded CUE files from service
 */
async function emitShardedSpecifications(specRepo: SpecificationRepository): Promise<void> {
  try {
    // Try to get any additional sharded files (services, endpoints, etc.)
    const shardTypes = ["services", "endpoints", "schemas", "behaviors"];

    for (const shardType of shardTypes) {
      const shardPath = path.resolve(".arbiter", `${shardType}.cue`);
      const shardSpec = await specRepo.getSpecification(shardType, shardPath);

      if (shardSpec.success && shardSpec.data && shardSpec.data.content) {
        await safeFileOperation("write", shardPath, async (validatedPath) => {
          await fs.writeFile(validatedPath, shardSpec.data.content, "utf-8");
        });
        reporter.info(`  📄 Emitted ${shardType} shard to .arbiter/${shardType}.cue`);
      }
    }
  } catch (error) {
    // Sharded files are optional, continue silently
  }
}

// Exports for focused unit testing of internal helpers
export {
  isTypeScriptServiceLanguage,
  deriveServiceAliases,
  pathBelongsToService,
  determinePathOwnership,
  buildDevProxyConfig,
  deriveBehaviorRouteMetadata,
  extractTestId,
  sanitizeTestId,
  humanizeTestId,
};
