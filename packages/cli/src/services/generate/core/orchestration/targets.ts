/**
 * @packageDocumentation
 * Target creation utilities for artifact generation.
 *
 * Provides functions to create generation targets for clients,
 * services, packages, and tools, handling path resolution and context creation.
 */

import path from "node:path";
import type { PathRouter, PathRouterInput } from "@/services/generate/core/compose/router.js";
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
import { joinRelativePath, slugify, toPathSegments } from "@/services/generate/util/shared.js";
import type { ProjectStructureConfig } from "@/types.js";
import type { AppSpec, GroupSpec, PackageConfig } from "@arbiter/shared";

const PACKAGE_RELATIVE_KEYS = ["docsDirectory", "testsDirectory", "infraDirectory"] as const;
type PackageRelativeKey = (typeof PACKAGE_RELATIVE_KEYS)[number];

function isPackageRelative(structure: ProjectStructureConfig, key: PackageRelativeKey): boolean {
  return Boolean(structure.packageRelative?.[key]);
}

/**
 * Options for target creation functions.
 */
export interface TargetCreationOptions {
  /** Router for path resolution (optional - falls back to default behavior) */
  router?: PathRouter;
  /** Groups defined in the spec (required when using router in by-group mode) */
  groups?: Record<string, GroupSpec>;
}

/**
 * Convert an absolute path to a relative path from a base directory.
 */
export function toRelativePath(from: string, to: string): string | null {
  const relative = path.relative(from, to);
  if (!relative || relative.trim().length === 0 || relative === ".") {
    return null;
  }
  const segments = toPathSegments(relative);
  return segments.length > 0 ? joinRelativePath(...segments) : null;
}

/**
 * Collect client generation targets from an app spec.
 */
export function collectClientTargets(
  appSpec: AppSpec,
  structure: ProjectStructureConfig,
  outputDir: string,
  options?: TargetCreationOptions,
): ClientGenerationTarget[] {
  // Find packages with subtype="frontend"
  const frontendPackages = Object.entries(appSpec.packages ?? {}).filter(
    ([, config]) => (config as any)?.subtype === "frontend",
  );

  if (frontendPackages.length > 0) {
    return frontendPackages.map(([key, config]) =>
      createClientTarget(key, config as PackageConfig, structure, outputDir, options),
    );
  }

  // Fallback: Prefer product.name, fall back to metadata.name, then "app"
  // Skip "Unknown App" as it's a placeholder default
  const productName = appSpec.product?.name;
  const metadataName = appSpec.metadata?.name;
  const fallback =
    productName && productName !== "Unknown App"
      ? productName
      : typeof metadataName === "string"
        ? metadataName
        : "app";
  return [createClientTarget(fallback, undefined, structure, outputDir, options)];
}

/**
 * Collect service generation targets from packages with service/worker subtype.
 */
export function collectServiceTargets(
  appSpec: AppSpec,
  structure: ProjectStructureConfig,
  outputDir: string,
  options?: TargetCreationOptions,
): ServiceGenerationTarget[] {
  // Find packages with subtype="service" or subtype="worker"
  const servicePackages = Object.entries(appSpec.packages ?? {}).filter(([, config]) => {
    const subtype = (config as any)?.subtype;
    return subtype === "service" || subtype === "worker" || (config as any)?.port;
  });
  return servicePackages.map(([key, config]) =>
    createServiceTarget(key, config, structure, outputDir, options),
  );
}

/**
 * Collect package generation targets from an app spec.
 */
export function collectPackageTargets(
  appSpec: AppSpec,
  structure: ProjectStructureConfig,
  outputDir: string,
  options?: TargetCreationOptions,
): PackageGenerationTarget[] {
  const entries = Object.entries((appSpec as any).packages ?? {});
  return entries.map(([key, config]) =>
    createPackageTarget(key, config as PackageConfig, structure, outputDir, options),
  );
}

/**
 * Collect tool generation targets from an app spec.
 */
export function collectToolTargets(
  appSpec: AppSpec,
  structure: ProjectStructureConfig,
  outputDir: string,
  options?: TargetCreationOptions,
): ToolGenerationTarget[] {
  const entries = Object.entries((appSpec as any).tools ?? {});
  return entries.map(([key, config]) =>
    createToolTarget(key, config as PackageConfig, structure, outputDir, options),
  );
}

function resolveLegacyClientRoot(
  clientConfig: PackageConfig | undefined,
  structure: ProjectStructureConfig,
  outputDir: string,
  slug: string,
): string {
  const configuredDir =
    typeof clientConfig?.sourceDirectory === "string" && clientConfig.sourceDirectory.length > 0
      ? clientConfig.sourceDirectory
      : undefined;
  const targetDir = configuredDir ?? path.join(structure.clientsDirectory, slug);
  const absoluteTargetRoot = path.isAbsolute(targetDir)
    ? targetDir
    : path.join(outputDir, targetDir);
  const relativeFromRoot = path.relative(outputDir, absoluteTargetRoot) || targetDir;
  return joinRelativePath(relativeFromRoot);
}

function buildClientContext(
  absoluteRoot: string,
  structure: ProjectStructureConfig,
  outputDir: string,
  slug: string,
): ClientGenerationContext {
  const routesDir = path.join(absoluteRoot, "src", "routes");
  const testsDirBase = toPathSegments(structure.testsDirectory || "tests");
  const testsDir = isPackageRelative(structure, "testsDirectory")
    ? path.join(absoluteRoot, ...testsDirBase)
    : path.join(outputDir, ...testsDirBase, slug);
  return { root: absoluteRoot, routesDir, testsDir };
}

/**
 * Create a client generation target.
 */
export function createClientTarget(
  identifier: string,
  clientConfig: PackageConfig | undefined,
  structure: ProjectStructureConfig,
  outputDir: string,
  options?: TargetCreationOptions,
): ClientGenerationTarget {
  const slug = slugify(identifier, identifier);

  let relativeRoot: string;
  if (options?.router) {
    const routerInput: PathRouterInput = {
      artifactType: "client",
      artifactKey: identifier,
      artifactSlug: slug,
      artifactConfig: (clientConfig ?? {}) as Record<string, unknown>,
      groups: options.groups ?? {},
      projectDir: outputDir,
      structureConfig: structure,
    };
    relativeRoot = options.router.resolve(routerInput).root;
  } else {
    relativeRoot = resolveLegacyClientRoot(clientConfig, structure, outputDir, slug);
  }

  const absoluteRoot = path.join(outputDir, relativeRoot);
  const context = buildClientContext(absoluteRoot, structure, outputDir, slug);

  return { key: identifier, slug, relativeRoot, config: clientConfig, context };
}

function createServiceContext(
  serviceName: string,
  serviceConfig: any,
  structure: ProjectStructureConfig,
  outputDir: string,
  relativeRoot?: string,
): ServiceGenerationContext {
  const slug = slugify(serviceName, serviceName);
  // Use provided relativeRoot or fall back to legacy behavior
  const root = relativeRoot
    ? path.join(outputDir, relativeRoot)
    : path.join(outputDir, structure.servicesDirectory, slug);
  const routesDir = path.join(root, "src", "routes");
  const testsDirBase = toPathSegments(structure.testsDirectory || "tests");
  const testsDir = isPackageRelative(structure, "testsDirectory")
    ? path.join(root, ...testsDirBase)
    : path.join(outputDir, ...testsDirBase, slug);

  return { root, routesDir, testsDir };
}

/**
 * Create a service generation target.
 */
export function createServiceTarget(
  serviceName: string,
  serviceConfig: any,
  structure: ProjectStructureConfig,
  outputDir: string,
  options?: TargetCreationOptions,
): ServiceGenerationTarget {
  const slug = slugify(serviceName, serviceName);

  // Use router if available, otherwise fall back to legacy behavior
  let relativeRoot: string;
  if (options?.router) {
    const routerInput: PathRouterInput = {
      artifactType: "service",
      artifactKey: serviceName,
      artifactSlug: slug,
      artifactConfig: (serviceConfig ?? {}) as Record<string, unknown>,
      groups: options.groups ?? {},
      projectDir: outputDir,
      structureConfig: structure,
    };
    relativeRoot = options.router.resolve(routerInput).root;
  } else {
    relativeRoot = joinRelativePath(structure.servicesDirectory, slug);
  }

  const context = createServiceContext(
    serviceName,
    serviceConfig,
    structure,
    outputDir,
    relativeRoot,
  );
  const language = (serviceConfig?.language as string | undefined)?.toLowerCase() ?? "typescript";

  return {
    key: serviceName,
    slug,
    relativeRoot,
    language,
    config: (serviceConfig ?? {}) as Record<string, unknown>,
    context,
  };
}

/**
 * Create a package generation target.
 */
export function createPackageTarget(
  packageName: string,
  packageConfig: PackageConfig | undefined,
  structure: ProjectStructureConfig,
  outputDir: string,
  options?: TargetCreationOptions,
): PackageGenerationTarget {
  const slug = slugify(packageName, packageName);

  // Use router if available, otherwise fall back to legacy behavior
  let relativeRoot: string;
  if (options?.router) {
    const routerInput: PathRouterInput = {
      artifactType: "package",
      artifactKey: packageName,
      artifactSlug: slug,
      artifactConfig: (packageConfig ?? {}) as Record<string, unknown>,
      groups: options.groups ?? {},
      projectDir: outputDir,
      structureConfig: structure,
    };
    relativeRoot = options.router.resolve(routerInput).root;
  } else {
    relativeRoot = joinRelativePath(structure.packagesDirectory, slug);
  }

  const absoluteRoot = path.join(outputDir, relativeRoot);
  const srcDir = path.join(absoluteRoot, "src");
  const testsDirBase = toPathSegments(structure.testsDirectory || "tests");
  const testsDir = isPackageRelative(structure, "testsDirectory")
    ? path.join(absoluteRoot, ...testsDirBase)
    : path.join(outputDir, ...testsDirBase, slug);

  const context: PackageGenerationContext = {
    root: absoluteRoot,
    srcDir,
    testsDir,
  };

  const language = packageConfig?.language?.toLowerCase() ?? "typescript";

  return {
    key: packageName,
    slug,
    relativeRoot,
    language,
    config: packageConfig ?? ({} as PackageConfig),
    context,
  };
}

/**
 * Create a tool generation target.
 */
export function createToolTarget(
  toolName: string,
  toolConfig: PackageConfig | undefined,
  structure: ProjectStructureConfig,
  outputDir: string,
  options?: TargetCreationOptions,
): ToolGenerationTarget {
  const slug = slugify(toolName, toolName);

  // Use router if available, otherwise fall back to legacy behavior
  let relativeRoot: string;
  if (options?.router) {
    const routerInput: PathRouterInput = {
      artifactType: "tool",
      artifactKey: toolName,
      artifactSlug: slug,
      artifactConfig: (toolConfig ?? {}) as Record<string, unknown>,
      groups: options.groups ?? {},
      projectDir: outputDir,
      structureConfig: structure,
    };
    relativeRoot = options.router.resolve(routerInput).root;
  } else {
    relativeRoot = joinRelativePath(structure.toolsDirectory, slug);
  }

  const absoluteRoot = path.join(outputDir, relativeRoot);
  const srcDir = path.join(absoluteRoot, "src");
  const testsDirBase = toPathSegments(structure.testsDirectory || "tests");
  const testsDir = isPackageRelative(structure, "testsDirectory")
    ? path.join(absoluteRoot, ...testsDirBase)
    : path.join(outputDir, ...testsDirBase, slug);

  const context: ToolGenerationContext = {
    root: absoluteRoot,
    srcDir,
    testsDir,
  };

  const language = toolConfig?.language?.toLowerCase() ?? "typescript";

  return {
    key: toolName,
    slug,
    relativeRoot,
    language,
    config: toolConfig ?? ({} as PackageConfig),
    context,
  };
}
