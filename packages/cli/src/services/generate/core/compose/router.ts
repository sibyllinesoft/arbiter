/**
 * @packageDocumentation
 * Path routing system for artifact organization.
 *
 * The router decouples path allocation from template generation.
 * It returns ONLY a root path - generators organize within that root however they want.
 */

import path from "node:path";
import type { ProjectStructureConfig, RoutingConfig } from "@/types.js";
import type { GroupSpec, PackageConfig } from "@arbiter/shared-types/cli";

/**
 * Artifact types that can be routed.
 */
export type RoutableArtifactType = "service" | "client" | "package" | "tool";

/**
 * Input provided to the path router for resolution.
 */
export interface PathRouterInput {
  /** Type of artifact being routed */
  artifactType: RoutableArtifactType;
  /** Unique key/identifier of the artifact */
  artifactKey: string;
  /** Slugified name for filesystem use */
  artifactSlug: string;
  /** Full artifact configuration */
  artifactConfig: Record<string, unknown>;
  /** All groups defined in the spec */
  groups: Record<string, GroupSpec>;
  /** Project root directory */
  projectDir: string;
  /** Project structure configuration */
  structureConfig: ProjectStructureConfig;
}

/**
 * Output from the path router.
 */
export interface PathRouterOutput {
  /** Relative path from projectDir to artifact root */
  root: string;
}

/**
 * Interface for path routers.
 */
export interface PathRouter {
  resolve(input: PathRouterInput): PathRouterOutput;
}

/**
 * Slugify a string for use in file paths.
 */
function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Get the type directory from project structure config.
 */
function getTypeDirectory(type: RoutableArtifactType, structure: ProjectStructureConfig): string {
  switch (type) {
    case "service":
      return structure.servicesDirectory;
    case "client":
      return structure.clientsDirectory;
    case "package":
      return structure.packagesDirectory;
    case "tool":
      return structure.toolsDirectory;
  }
}

/**
 * Resolve the full group path for nested groups.
 * Traverses the memberOf chain to build the complete path.
 */
function resolveGroupPath(
  groupKey: string,
  groups: Record<string, GroupSpec>,
  visited: Set<string> = new Set(),
): string[] {
  // Prevent infinite loops from circular references
  if (visited.has(groupKey)) {
    return [];
  }
  visited.add(groupKey);

  const group = groups[groupKey];
  if (!group) {
    return [];
  }

  const groupDir = group.directory || slugify(group.name);
  const parentPath = group.memberOf ? resolveGroupPath(group.memberOf, groups, visited) : [];

  return [...parentPath, groupDir];
}

/**
 * Default path router implementation.
 *
 * Supports two routing modes:
 * - "by-type" (default): Organizes by artifact type (services/, clients/, etc.)
 * - "by-group": Organizes by group membership (feature/services/, feature/clients/, etc.)
 */
export class DefaultPathRouter implements PathRouter {
  private mode: "by-type" | "by-group";
  private warnOnUngrouped: boolean;

  constructor(config: RoutingConfig = {}) {
    this.mode = config.mode ?? "by-type";
    this.warnOnUngrouped = config.warnOnUngrouped ?? false;
  }

  /**
   * Emit warning for ungrouped artifacts if configured
   */
  private warnForUngroupedArtifact(artifactKey: string, memberOf: string | undefined): void {
    if (!this.warnOnUngrouped) return;

    if (memberOf) {
      console.warn(`Warning: Artifact "${artifactKey}" references unknown group "${memberOf}"`);
    } else if (this.mode === "by-group") {
      console.warn(`Warning: Artifact "${artifactKey}" has no memberOf field in by-group mode`);
    }
  }

  /**
   * Check if artifact should use group-based routing
   */
  private shouldUseGroupRouting(
    memberOf: string | undefined,
    groups: PathRouterInput["groups"],
  ): boolean {
    return Boolean(memberOf && groups[memberOf]);
  }

  resolve(input: PathRouterInput): PathRouterOutput {
    const { artifactType, artifactSlug, artifactConfig, groups, structureConfig } = input;

    if (this.mode === "by-type") {
      return { root: this.getTypeRoot(artifactType, artifactSlug, structureConfig) };
    }

    // by-group mode
    const memberOf = (artifactConfig as { memberOf?: string }).memberOf;

    if (!this.shouldUseGroupRouting(memberOf, groups)) {
      this.warnForUngroupedArtifact(input.artifactKey, memberOf);
      return { root: this.getTypeRoot(artifactType, artifactSlug, structureConfig) };
    }

    return { root: this.getGroupRoot(input) };
  }

  private getTypeRoot(
    artifactType: RoutableArtifactType,
    artifactSlug: string,
    structureConfig: ProjectStructureConfig,
  ): string {
    const typeDir = getTypeDirectory(artifactType, structureConfig);
    return path.posix.join(typeDir, artifactSlug);
  }

  private getGroupRoot(input: PathRouterInput): string {
    const { artifactType, artifactSlug, artifactConfig, groups, structureConfig } = input;
    const memberOf = (artifactConfig as { memberOf?: string }).memberOf!;

    // Resolve full group path (handles nested groups)
    const groupPath = resolveGroupPath(memberOf, groups);

    // Get the type directory, potentially overridden by the group's structure
    const group = groups[memberOf];
    const effectiveStructure = group.structure
      ? { ...structureConfig, ...group.structure }
      : structureConfig;
    const typeDir = getTypeDirectory(artifactType, effectiveStructure);

    return path.posix.join(...groupPath, typeDir, artifactSlug);
  }
}

/**
 * Load a custom router from a user-provided module path.
 */
export async function loadCustomRouter(
  routerPath: string,
  projectDir: string,
): Promise<PathRouter> {
  const absolutePath = path.isAbsolute(routerPath)
    ? routerPath
    : path.resolve(projectDir, routerPath);

  try {
    const module = await import(absolutePath);
    const router = module.default || module.router || module;

    if (typeof router.resolve !== "function") {
      throw new Error(
        `Custom router at "${routerPath}" must export a PathRouter with a resolve() method`,
      );
    }

    return router as PathRouter;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to load custom router from "${routerPath}": ${message}`);
  }
}

/**
 * Create a router instance based on configuration.
 */
export async function createRouter(
  config: RoutingConfig | undefined,
  projectDir: string,
): Promise<PathRouter> {
  if (config?.customRouter) {
    return loadCustomRouter(config.customRouter, projectDir);
  }

  return new DefaultPathRouter(config);
}

/**
 * Helper to check if an artifact has group membership.
 */
export function hasGroupMembership(config: Record<string, unknown>): boolean {
  return typeof config.memberOf === "string" && config.memberOf.length > 0;
}

/**
 * Validate group references in artifacts.
 * Returns an array of warnings for invalid references.
 */
export function validateGroupReferences(
  artifacts: Array<{ key: string; config: Record<string, unknown>; type: RoutableArtifactType }>,
  groups: Record<string, GroupSpec>,
): string[] {
  const warnings: string[] = [];

  for (const artifact of artifacts) {
    const memberOf = (artifact.config as { memberOf?: string }).memberOf;
    if (memberOf && !groups[memberOf]) {
      warnings.push(`${artifact.type} "${artifact.key}" references unknown group "${memberOf}"`);
    }
  }

  // Also validate group->group references
  for (const [groupKey, group] of Object.entries(groups)) {
    if (group.memberOf && !groups[group.memberOf]) {
      warnings.push(`group "${groupKey}" references unknown parent group "${group.memberOf}"`);
    }
  }

  return warnings;
}
