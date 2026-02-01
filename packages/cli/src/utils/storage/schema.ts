/**
 * @packageDocumentation
 * Schema definitions for filterable fields on storage entities.
 * Derives filter schemas from CUE schema definitions (single source of truth).
 */

import {
  type CueEntityDef,
  type CueField,
  type CueFieldType,
  getFilterableFields,
  loadCueSchemas,
  parseCueEnums,
  parseCueSchemaContent,
} from "./cue-schema-parser.js";

/**
 * Field types that determine how filters are applied
 */
export type FieldType =
  | "string"
  | "string[]"
  | "boolean"
  | "number"
  | "enum"
  | "date"
  | "reference";

/**
 * Schema definition for a filterable field
 */
export interface FieldSchema {
  name: string;
  flag?: string;
  type: FieldType;
  values?: readonly string[];
  description: string;
  alias?: string;
}

/**
 * Entity schema containing all filterable fields
 */
export interface EntitySchema {
  name: string;
  fields: FieldSchema[];
}

/**
 * Convert CUE field type to filter field type
 */
function cueTypeToFieldType(cueType: CueFieldType): FieldType {
  switch (cueType) {
    case "string":
      return "string";
    case "string[]":
      return "string[]";
    case "boolean":
      return "boolean";
    case "number":
      return "number";
    case "enum":
      return "enum";
    case "reference":
      return "reference";
    default:
      return "string";
  }
}

/**
 * Convert camelCase to kebab-case for CLI flags
 */
export function toKebabCase(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

/**
 * Get CLI flag name for a field
 */
export function getFieldFlag(field: FieldSchema): string {
  return field.flag ?? toKebabCase(field.name);
}

/**
 * Generate description from field name
 */
function generateDescription(fieldName: string): string {
  const words = fieldName
    .replace(/([A-Z])/g, " $1")
    .toLowerCase()
    .trim();
  return `Filter by ${words}`;
}

/**
 * Common field aliases for frequently used filters
 */
const fieldAliases: Record<string, string> = {
  status: "s",
  priority: "p",
  type: "t",
  assignee: "a",
  label: "l",
};

/**
 * Custom flag names for fields that don't map directly
 */
const customFlags: Record<string, string> = {
  memberOf: "member-of",
  targetType: "target-type",
  groupId: "group",
  dependsOn: "depends-on",
  threadId: "thread",
  references: "refs",
  assignees: "assignee",
  labels: "label",
  tags: "tag",
};

/**
 * Convert CUE field to FieldSchema
 */
function cueFieldToSchema(field: CueField, enums: Map<string, string[]>): FieldSchema {
  const type = cueTypeToFieldType(field.type);

  // Resolve enum values
  let values: readonly string[] | undefined;

  // First check if field has inline enum values
  if (field.enumValues && field.enumValues.length > 0) {
    values = field.enumValues;
  }
  // Then check if it references a named enum type
  else if (field.refType) {
    const enumName = field.refType.replace("#", "");
    if (enums.has(enumName)) {
      values = enums.get(enumName);
    }
  }

  return {
    name: field.name,
    type: values ? "enum" : type,
    values,
    flag: customFlags[field.name],
    alias: fieldAliases[field.name],
    description: generateDescription(field.name),
  };
}

/**
 * Convert CUE entity definition to EntitySchema
 */
function cueEntityToSchema(
  entityDef: CueEntityDef,
  entityName: string,
  enums: Map<string, string[]>,
): EntitySchema {
  const filterableFields = getFilterableFields(entityDef);

  return {
    name: entityName,
    fields: filterableFields.map((f) => cueFieldToSchema(f, enums)),
  };
}

// Entity name mapping: CUE definition name -> CLI entity type
const entityNameMap: Record<string, string> = {
  IssueConfig: "task",
  CommentConfig: "note",
  PackageConfig: "package",
  ResourceConfig: "resource",
  GroupSpec: "group",
  RelationshipSpec: "relationship",
};

// Reverse mapping for lookup
const cueNameMap: Record<string, string> = Object.fromEntries(
  Object.entries(entityNameMap).map(([k, v]) => [v, k]),
);

/**
 * Cached schemas - loaded once at startup
 */
let cachedSchemas: Map<string, EntitySchema> | null = null;
let cachedEnums: Map<string, string[]> | null = null;

/**
 * Load schemas from CUE files (async initialization)
 */
export async function initializeSchemas(): Promise<void> {
  try {
    const { entities, enums } = await loadCueSchemas();
    cachedEnums = enums;
    cachedSchemas = new Map();

    for (const [cueName, entityDef] of entities) {
      const schemaName = entityNameMap[cueName];
      if (schemaName) {
        const schema = cueEntityToSchema(entityDef, schemaName, enums);
        cachedSchemas.set(schemaName, schema);
      }
    }
  } catch (error) {
    // Fall back to hardcoded schemas if CUE parsing fails
    console.warn("Failed to load CUE schemas, using fallback:", error);
    loadFallbackSchemas();
  }
}

/**
 * Fallback hardcoded schemas (used when CUE parsing fails)
 */
function loadFallbackSchemas(): void {
  cachedSchemas = new Map();
  cachedEnums = new Map();

  // Fallback enum definitions
  cachedEnums.set("IssueStatus", [
    "open",
    "in_progress",
    "blocked",
    "review",
    "done",
    "closed",
    "wontfix",
  ]);
  cachedEnums.set("IssuePriority", ["critical", "high", "medium", "low"]);
  cachedEnums.set("IssueType", [
    "issue",
    "bug",
    "feature",
    "task",
    "epic",
    "milestone",
    "story",
    "spike",
  ]);
  cachedEnums.set("ExternalSource", ["local", "github", "gitlab", "jira", "linear"]);
  cachedEnums.set("CommentKind", ["discussion", "guidance", "memory", "decision", "note"]);

  // Task schema
  cachedSchemas.set("task", {
    name: "task",
    fields: [
      {
        name: "status",
        type: "enum",
        values: cachedEnums.get("IssueStatus"),
        description: "Filter by status",
        alias: "s",
      },
      {
        name: "priority",
        type: "enum",
        values: cachedEnums.get("IssuePriority"),
        description: "Filter by priority",
        alias: "p",
      },
      {
        name: "type",
        type: "enum",
        values: cachedEnums.get("IssueType"),
        description: "Filter by type",
        alias: "t",
      },
      { name: "assignees", flag: "assignee", type: "string[]", description: "Filter by assignee" },
      { name: "labels", flag: "label", type: "string[]", description: "Filter by label" },
      { name: "milestone", type: "string", description: "Filter by milestone" },
      {
        name: "memberOf",
        flag: "member-of",
        type: "string",
        description: "Filter by group membership",
      },
      { name: "parent", type: "string", description: "Filter by parent task" },
      {
        name: "references",
        flag: "refs",
        type: "reference",
        description: "Filter by referenced entity slug",
      },
      {
        name: "source",
        type: "enum",
        values: cachedEnums.get("ExternalSource"),
        description: "Filter by external source",
      },
    ],
  });

  // Note schema
  cachedSchemas.set("note", {
    name: "note",
    fields: [
      { name: "target", type: "string", description: "Filter by target entity" },
      {
        name: "targetType",
        flag: "target-type",
        type: "string",
        description: "Filter by target type",
      },
      { name: "author", type: "string", description: "Filter by author" },
      {
        name: "kind",
        type: "enum",
        values: cachedEnums.get("CommentKind"),
        description: "Filter by kind",
      },
      { name: "tags", flag: "tag", type: "string[]", description: "Filter by tag" },
      { name: "resolved", type: "boolean", description: "Filter by resolved status" },
      {
        name: "source",
        type: "enum",
        values: cachedEnums.get("ExternalSource"),
        description: "Filter by external source",
      },
    ],
  });
}

/**
 * Get schemas - initializes synchronously with fallback if not yet loaded
 */
function getSchemas(): Map<string, EntitySchema> {
  if (!cachedSchemas) {
    loadFallbackSchemas();
  }
  return cachedSchemas!;
}

/**
 * Get all entity schemas
 */
export function getAllEntitySchemas(): Record<string, EntitySchema> {
  const schemas = getSchemas();
  return Object.fromEntries(schemas.entries());
}

/**
 * Get schema for a specific entity type
 */
export function getEntitySchema(entityType: string): EntitySchema | undefined {
  return getSchemas().get(entityType);
}

/**
 * Legacy export for backwards compatibility
 */
export const EntitySchemas: Record<string, EntitySchema> = new Proxy(
  {} as Record<string, EntitySchema>,
  {
    get(_target, prop: string) {
      return getSchemas().get(prop);
    },
    ownKeys() {
      return Array.from(getSchemas().keys());
    },
    getOwnPropertyDescriptor(_target, prop: string) {
      const schema = getSchemas().get(prop as string);
      if (schema) {
        return { enumerable: true, configurable: true, value: schema };
      }
      return undefined;
    },
  },
);

/**
 * Apply a filter to an entity based on field schema
 */
export function applyFilter<T extends Record<string, unknown>>(
  entity: T,
  field: FieldSchema,
  filterValue: unknown,
): boolean {
  const entityValue = entity[field.name];

  if (entityValue === undefined || entityValue === null) {
    return false;
  }

  switch (field.type) {
    case "string":
    case "enum":
      return entityValue === filterValue;

    case "string[]":
      if (Array.isArray(entityValue)) {
        return entityValue.includes(filterValue as string);
      }
      return false;

    case "boolean":
      return entityValue === filterValue;

    case "number":
      return entityValue === filterValue;

    case "reference":
      if (Array.isArray(entityValue)) {
        return entityValue.some((ref: { slug?: string }) => ref.slug === filterValue);
      }
      return false;

    case "date":
      return entityValue === filterValue;

    default:
      return false;
  }
}

/**
 * Apply multiple filters to an entity
 */
export function applyFilters<T extends Record<string, unknown>>(
  entity: T,
  schema: EntitySchema,
  filters: Record<string, unknown>,
): boolean {
  for (const field of schema.fields) {
    const flag = getFieldFlag(field);
    const filterValue = filters[flag] ?? filters[field.name];

    if (filterValue !== undefined) {
      if (!applyFilter(entity, field, filterValue)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Filter an array of entities using schema-based filters
 */
export function filterEntities<T extends Record<string, unknown>>(
  entities: T[],
  schema: EntitySchema,
  filters: Record<string, unknown>,
): T[] {
  const hasFilters = schema.fields.some((field) => {
    const flag = getFieldFlag(field);
    return filters[flag] !== undefined || filters[field.name] !== undefined;
  });

  if (!hasFilters) {
    return entities;
  }

  return entities.filter((entity) => applyFilters(entity, schema, filters));
}
