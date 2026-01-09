/**
 * @packageDocumentation
 * Entity synchronization helpers for the add command.
 *
 * Provides functionality to:
 * - Sync entities with project catalog after add operations
 * - Upsert service and generic entities
 * - Find existing artifact IDs in project data
 * - Map entity types to spec collections
 */

import type { ApiClient } from "@/io/api/api-client.js";
import type { CLIConfig } from "@/types.js";
import { ensureProjectExists } from "@/utils/api/project.js";
import chalk from "chalk";

/**
 * Sync an entity with the project catalog after adding it to the specification.
 * @param client - API client instance
 * @param config - CLI configuration
 * @param subcommand - The add subcommand that was executed
 * @param name - Name of the entity being synced
 * @param options - Additional options from the add command
 */
export async function syncEntityWithProject(
  client: ApiClient,
  config: CLIConfig,
  subcommand: string,
  name: string,
  options: Record<string, any>,
): Promise<void> {
  const entityType = mapSubcommandToEntityType(subcommand);
  if (!entityType) return;

  const projectId = await ensureProjectExists(client, config);

  switch (entityType) {
    case "service":
      // Note: databases, caches, queues, load-balancers are now services with infrastructureType field
      await upsertServiceEntity(client, projectId, name, options);
      const infraType = options.type ? ` (${options.type})` : "";
      console.log(chalk.dim(`🗄️  Synced service "${name}"${infraType} with project catalog`));
      break;
    default:
      await upsertGenericEntity(client, projectId, entityType, name, options);
      console.log(chalk.dim(`🗄️  Synced ${entityType} "${name}" with project catalog`));
  }
}

/**
 * Upsert a service entity in the project catalog.
 * @param client - API client instance
 * @param projectId - Project ID
 * @param name - Service name
 * @param options - Service options
 */
async function upsertServiceEntity(
  client: ApiClient,
  projectId: string,
  name: string,
  options: Record<string, any>,
): Promise<void> {
  const artifactId = await findExistingArtifactId(client, projectId, "service", name);
  const values = buildServiceEntityValues(name, options);

  if (artifactId) {
    const result = await client.updateProjectEntity(projectId, artifactId, {
      type: "service",
      values,
    });
    if (!result.success) {
      throw new Error(result.error || `Failed to update service "${name}" in project catalog`);
    }
  } else {
    const result = await client.createProjectEntity(projectId, { type: "service", values });
    if (!result.success) {
      throw new Error(result.error || `Failed to register service "${name}" in project catalog`);
    }
  }
}

/**
 * Upsert a generic entity in the project catalog.
 * @param client - API client instance
 * @param projectId - Project ID
 * @param type - Entity type
 * @param name - Entity name
 * @param options - Entity options
 */
async function upsertGenericEntity(
  client: ApiClient,
  projectId: string,
  type: string,
  name: string,
  options: Record<string, any>,
): Promise<void> {
  const artifactId = await findExistingArtifactId(client, projectId, type, name);
  const values = buildGenericEntityValues(type, name, options);

  if (artifactId) {
    const result = await client.updateProjectEntity(projectId, artifactId, { type, values });
    if (!result.success) {
      throw new Error(result.error || `Failed to update ${type} "${name}" in project catalog`);
    }
  } else {
    const result = await client.createProjectEntity(projectId, { type, values });
    if (!result.success) {
      throw new Error(result.error || `Failed to register ${type} "${name}" in project catalog`);
    }
  }
}

/**
 * Find an existing artifact ID in the project data.
 * @param client - API client instance
 * @param projectId - Project ID
 * @param type - Entity type
 * @param name - Entity name
 * @returns Artifact ID if found, null otherwise
 */
async function findExistingArtifactId(
  client: ApiClient,
  projectId: string,
  type: string,
  name: string,
): Promise<string | null> {
  const projectResult = await client.getProject(projectId);
  if (!projectResult.success) {
    throw new Error(projectResult.error || `Failed to fetch project ${projectId} details`);
  }

  const spec = projectResult.data?.resolved?.spec ?? projectResult.data?.spec;
  if (!spec || typeof spec !== "object") {
    return null;
  }

  const target = normalizeName(name);

  // Try artifacts first
  const artifactId = findArtifactIdInArray(projectResult.data?.resolved?.artifacts, target, type);
  if (artifactId) return artifactId;

  // Fallback to spec collections
  return findArtifactIdInCollection(spec, type, target);
}

/**
 * Find an artifact ID in an array of artifacts.
 * @param artifacts - Array of artifacts
 * @param targetName - Normalized target name
 * @param type - Entity type
 * @returns Artifact ID if found, null otherwise
 */
function findArtifactIdInArray(
  artifacts: unknown[] | undefined,
  targetName: string,
  type: string,
): string | null {
  if (!Array.isArray(artifacts)) return null;

  const match = artifacts.find(
    (a: any) => normalizeName(a?.name) === targetName && (a?.type || "").toLowerCase() === type,
  );
  return (match as any)?.id ?? null;
}

/**
 * Find an artifact ID in a spec collection.
 * @param spec - Specification object
 * @param type - Entity type
 * @param targetName - Normalized target name
 * @returns Artifact ID if found, null otherwise
 */
function findArtifactIdInCollection(
  spec: Record<string, any>,
  type: string,
  targetName: string,
): string | null {
  const collectionKey = mapEntityTypeToSpecCollection(type);
  if (!collectionKey) return null;

  const collection = spec[collectionKey];
  if (!collection || typeof collection !== "object") return null;

  for (const entry of Object.values(collection)) {
    const entryName = extractEntryName(entry);
    if (!entryName || entryName.trim().toLowerCase() !== targetName) continue;

    const id = extractEntryId(entry);
    if (id) return id;
  }

  return null;
}

/**
 * Extract the name from an entry object.
 * @param entry - Entry object
 * @returns Entry name if found
 */
function extractEntryName(entry: unknown): string | undefined {
  if (!entry || typeof entry !== "object") return undefined;
  const obj = entry as Record<string, any>;
  return obj.name ?? obj.displayName ?? obj.metadata?.name;
}

/**
 * Extract the ID from an entry object.
 * @param entry - Entry object
 * @returns Entry ID if found
 */
function extractEntryId(entry: unknown): string | undefined {
  if (!entry || typeof entry !== "object") return undefined;
  const obj = entry as Record<string, any>;
  return obj.artifactId ?? obj.metadata?.artifactId ?? obj.id;
}

/**
 * Map entity type to the corresponding spec collection key.
 * @param type - Entity type
 * @returns Collection key or null if not mapped
 */
function mapEntityTypeToSpecCollection(type: string): string | null {
  switch (type) {
    case "service":
      // Note: databases, caches, queues, load-balancers are now services with infrastructureType field
      return "services";
    case "package":
    case "component":
    case "module":
      return "components"; // packages/components/modules live under components but resolved flatten; handled via artifacts mostly
    case "tool":
    case "frontend":
      return "components";
    case "route":
      return "ui"; // handled separately elsewhere; artifacts cover main cases
    default:
      return null;
  }
}

/**
 * Normalize a name for comparison.
 * @param value - Value to normalize
 * @returns Normalized lowercase string
 */
function normalizeName(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

/**
 * Get a trimmed string value if valid, otherwise return undefined
 */
function getTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Add an optional string field to values object
 */
function addOptionalString(values: Record<string, unknown>, key: string, value: unknown): void {
  const trimmed = getTrimmedString(value);
  if (trimmed) {
    values[key] = trimmed;
  }
}

/**
 * Build entity values for a service.
 * @param name - Service name
 * @param options - Service options
 * @returns Entity values object
 */
function buildServiceEntityValues(
  name: string,
  options: Record<string, any>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {
    name,
    language: getTrimmedString(options.language) ?? "typescript",
  };

  // Add optional numeric field
  if (typeof options.port === "number" && Number.isFinite(options.port)) {
    values.port = options.port;
  }

  // Add optional string fields
  addOptionalString(values, "serviceType", options.serviceType);
  addOptionalString(values, "infrastructureType", options.type);
  addOptionalString(values, "image", options.image);

  // Source path with fallback
  values.sourcePath = getTrimmedString(options.directory) ?? `./src/${name}`;

  return values;
}

/**
 * Build entity values for a generic entity.
 * @param type - Entity type
 * @param name - Entity name
 * @param options - Entity options
 * @returns Entity values object
 */
function buildGenericEntityValues(
  type: string,
  name: string,
  options: Record<string, any>,
): Record<string, unknown> {
  const values: Record<string, unknown> = { name };

  if (options?.path) values.path = options.path;
  if (options?.description) values.description = options.description;
  if (options?.id) values.id = options.id;

  switch (type) {
    case "route":
      values.path = options.path ?? name;
      values.id = options.id ?? name;
      break;
    case "flow":
      values.id = options.id ?? name;
      break;
    case "capability":
      values.id = options.id ?? name;
      break;
    default:
      break;
  }

  return values;
}

/**
 * Map an add subcommand to its entity type.
 * @param subcommand - The add subcommand
 * @returns Entity type or null if not mapped
 */
export function mapSubcommandToEntityType(subcommand: string): string | null {
  const normalized = subcommand.trim().toLowerCase();
  const map: Record<string, string> = {
    service: "service",
    // Note: database, cache, queue, load-balancer now route through service
    // They are services with an infrastructureType field
    package: "package",
    tool: "tool",
    frontend: "frontend",
    route: "route",
    flow: "flow",
    capability: "capability",
    group: "group",
    issue: "issue",
    component: "component",
    module: "module",
  };

  return map[normalized] || null;
}
