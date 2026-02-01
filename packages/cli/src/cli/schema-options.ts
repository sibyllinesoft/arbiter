/**
 * @packageDocumentation
 * Generate CLI options dynamically from entity schemas.
 */

import {
  type EntitySchema,
  EntitySchemas,
  type FieldSchema,
  getFieldFlag,
} from "@/utils/storage/schema.js";
import type { Command } from "commander";

/**
 * Add filter options to a command based on an entity schema
 */
export function addSchemaFilterOptions(command: Command, schema: EntitySchema): Command {
  for (const field of schema.fields) {
    const flag = getFieldFlag(field);
    const longFlag = `--${flag} <value>`;
    const shortFlag = field.alias ? `-${field.alias}, ` : "";

    let description = field.description;

    // Add allowed values to description for enum types
    if (field.type === "enum" && field.values) {
      description += ` (${field.values.join(", ")})`;
    }

    command.option(`${shortFlag}${longFlag}`, description);
  }

  return command;
}

/**
 * Add filter options for a specific entity type
 */
export function addEntityFilterOptions(command: Command, entityType: string): Command {
  const schema = EntitySchemas[entityType];
  if (schema) {
    return addSchemaFilterOptions(command, schema);
  }
  return command;
}

/**
 * Parse filter options from command options based on schema
 * Returns a clean filter object with only the schema-defined fields
 */
export function parseSchemaFilters(
  options: Record<string, unknown>,
  schema: EntitySchema,
): Record<string, unknown> {
  const filters: Record<string, unknown> = {};

  for (const field of schema.fields) {
    const flag = getFieldFlag(field);
    const value = options[toCamelCase(flag)];

    if (value !== undefined) {
      // Store with field name for entity matching
      filters[field.name] = convertFilterValue(value, field);
    }
  }

  return filters;
}

/**
 * Convert filter value to the appropriate type
 */
function convertFilterValue(value: unknown, field: FieldSchema): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  switch (field.type) {
    case "boolean":
      if (typeof value === "string") {
        return value.toLowerCase() === "true";
      }
      return Boolean(value);

    case "number":
      if (typeof value === "string") {
        return Number(value);
      }
      return value;

    default:
      return value;
  }
}

/**
 * Convert kebab-case to camelCase (Commander stores options in camelCase)
 */
function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Get all available entity types with schemas
 */
export function getFilterableEntityTypes(): string[] {
  return Object.keys(EntitySchemas);
}
