/**
 * @packageDocumentation
 * Core artifact generators for the generation pipeline.
 *
 * Provides concrete implementations of the ArtifactGenerator base class
 * for generating application scaffolding, configuration, and boilerplate.
 */

import type { ClientGenerationTarget } from "@/services/generate/io/contexts.js";
import {
  ArtifactGenerator,
  type ArtifactGeneratorContext,
} from "@/services/generate/strategies/base.js";
import type { GenerateOptions } from "@/services/generate/util/types.js";
import type { CLIConfig, ProjectStructureConfig } from "@/types.js";
import type { PackageManagerCommandSet } from "@/utils/io/package-manager.js";
import {
  type AppSpec,
  getBehaviorsArray,
  getOperations,
  getPackages,
  getResources,
} from "@arbiter/specification";

/**
 * Generate all client-side assets (UI routes, locators, behavior tests, project scaffolds).
 * Mutates the shared context to expose the tests workspace path for later strategies.
 */
export class ClientArtifactsGenerator implements ArtifactGenerator {
  name = "client-artifacts";

  constructor(
    private readonly deps: {
      generateUIComponents: GenerateUIComponentsFn;
      generateLocatorDefinitions: GenerateLocatorDefinitionsFn;
      generateBehaviorBasedTests: GenerateBehaviorBasedTestsFn;
      generateProjectStructure: GenerateProjectStructureFn;
      ensureDirectory: EnsureDirectoryFn;
      toRelativePath: (from: string, to: string) => string | null;
    },
  ) {}

  /**
   * Generate artifacts for a single client target
   */
  private async generateForTarget(
    context: ArtifactGeneratorContext,
    target: ArtifactGeneratorContext["clientTargets"][number],
  ): Promise<string[]> {
    const { appSpec, outputDir, options, structure, cliConfig, packageManager } = context;
    const files: string[] = [];

    await this.deps.ensureDirectory(target.context.root, options);

    // Generate UI route components
    const routeFiles = await this.deps.generateUIComponents(appSpec, target, options);
    files.push(...routeFiles);

    // Generate locator definitions if any exist (legacy feature)
    const locators = (appSpec as any).locators;
    const locatorCount = locators ? Object.keys(locators).length : 0;
    if (locatorCount > 0) {
      const locatorFiles = await this.deps.generateLocatorDefinitions(appSpec, target, options);
      files.push(...locatorFiles);
    }

    // Generate behavior-based tests unless --no-tests is set
    if (getBehaviorsArray(appSpec).length > 0 && options.tests !== false) {
      const testResult = await this.deps.generateBehaviorBasedTests(
        appSpec,
        outputDir,
        options,
        structure,
        target,
      );
      files.push(...testResult.files);
      this.updateTestsWorkspace(context, outputDir, testResult.workspaceDir);
    }

    // Generate project structure
    const projectFiles = await this.deps.generateProjectStructure(
      appSpec,
      outputDir,
      options,
      structure,
      target,
      cliConfig,
      packageManager,
    );
    files.push(...projectFiles);

    return files;
  }

  /**
   * Update tests workspace path in context if not already set
   */
  private updateTestsWorkspace(
    context: ArtifactGeneratorContext,
    outputDir: string,
    workspaceDir: string | undefined,
  ): void {
    if (!context.testsWorkspaceRelative && workspaceDir) {
      context.testsWorkspaceRelative =
        this.deps.toRelativePath(outputDir, workspaceDir) || workspaceDir;
    }
  }

  async generate(context: ArtifactGeneratorContext): Promise<string[]> {
    const { appSpec, clientTargets } = context;

    if (!appSpec || clientTargets.length === 0) {
      return [];
    }

    const allFiles: string[] = [];
    for (const target of clientTargets) {
      const files = await this.generateForTarget(context, target);
      allFiles.push(...files);
    }

    return allFiles;
  }
}

/** Generate capability feature scaffolds (features, docs, and metadata). */
export class CapabilityFeaturesGenerator implements ArtifactGenerator {
  name = "capability-features";

  constructor(private readonly fn: CapabilityFeaturesFn) {}

  async generate(context: ArtifactGeneratorContext): Promise<string[]> {
    return this.fn(context.appSpec, context.outputDir, context.options, context.structure);
  }
}

/** Generate OpenAPI/route specifications. */
export class ApiSpecGenerator implements ArtifactGenerator {
  name = "api-specs";
  constructor(private readonly fn: ApiSpecFn) {}

  async generate(context: ArtifactGeneratorContext): Promise<string[]> {
    if (
      Object.keys(getResources(context.appSpec)).length === 0 &&
      Object.keys(getOperations(context.appSpec)).length === 0
    )
      return [];
    return this.fn(context.appSpec, context.outputDir, context.options, context.structure);
  }
}

/** Generate service scaffolding and workload artifacts. */
export class ServiceArtifactsGenerator implements ArtifactGenerator {
  name = "service-artifacts";
  constructor(private readonly fn: ServiceArtifactsFn) {}

  async generate(context: ArtifactGeneratorContext): Promise<string[]> {
    const hasPackages =
      getPackages(context.appSpec) && Object.keys(getPackages(context.appSpec)).length > 0;

    if (!hasPackages) return [];

    return this.fn(
      context.appSpec,
      context.outputDir,
      context.options,
      context.structure,
      context.cliConfig,
      context.packageManager,
    );
  }
}

/** Generate shared module-level artifacts. */
export class ModuleArtifactsGenerator implements ArtifactGenerator {
  name = "module-artifacts";
  constructor(private readonly fn: ModuleArtifactsFn) {}

  async generate(context: ArtifactGeneratorContext): Promise<string[]> {
    return this.fn(context.appSpec, context.outputDir, context.options, context.structure);
  }
}

/** Generate tooling/setup files for the workspace. */
export class ToolingArtifactsGenerator implements ArtifactGenerator {
  name = "tooling-artifacts";
  constructor(private readonly fn: ToolingArtifactsFn) {}

  async generate(context: ArtifactGeneratorContext): Promise<string[]> {
    return this.fn(context.appSpec, context.outputDir, context.options, context.structure);
  }
}

/** Final package manager workspace manifest (monorepo setup). */
export class WorkspaceManifestGenerator implements ArtifactGenerator {
  name = "workspace-manifest";
  constructor(private readonly fn: WorkspaceManifestFn) {}

  async generate(context: ArtifactGeneratorContext): Promise<string[]> {
    return this.fn(
      context.appSpec,
      context.outputDir,
      context.options,
      context.structure,
      context.clientTargets,
      context.testsWorkspaceRelative,
      context.packageManager,
    );
  }
}

// Dependency type aliases to keep constructor signatures readable
export type GenerateUIComponentsFn = (
  app: AppSpec,
  target: ClientGenerationTarget,
  options: GenerateOptions,
) => Promise<string[]>;

export type GenerateLocatorDefinitionsFn = (
  app: AppSpec,
  target: ClientGenerationTarget,
  options: GenerateOptions,
) => Promise<string[]>;

export type GenerateBehaviorBasedTestsFn = (
  app: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  clientTarget?: ClientGenerationTarget,
) => Promise<{ files: string[]; workspaceDir?: string }>;

export type GenerateProjectStructureFn = (
  app: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  target: ClientGenerationTarget,
  cliConfig: CLIConfig,
  packageManager: PackageManagerCommandSet,
) => Promise<string[]>;

export type CapabilityFeaturesFn = (
  app: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
) => Promise<string[]>;

export type ApiSpecFn = (
  app: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
) => Promise<string[]>;

export type ServiceArtifactsFn = (
  app: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  cliConfig: CLIConfig,
  packageManager: PackageManagerCommandSet,
) => Promise<string[]>;

export type ModuleArtifactsFn = (
  app: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
) => Promise<string[]>;

export type ToolingArtifactsFn = (
  app: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
) => Promise<string[]>;

export type WorkspaceManifestFn = (
  app: AppSpec,
  outputDir: string,
  options: GenerateOptions,
  structure: ProjectStructureConfig,
  clientTargets: ClientGenerationTarget[],
  testsWorkspace?: string,
  packageManager?: PackageManagerCommandSet,
) => Promise<string[]>;

export type EnsureDirectoryFn = (dir: string, options: GenerateOptions) => Promise<void>;
