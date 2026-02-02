/**
 * @packageDocumentation
 * Parse CUE schema definitions to extract filterable fields.
 * Uses direct file parsing with optional cue-wasm validation.
 */

import * as fs from "node:fs";
import path from "node:path";
import { init as initCueWasm } from "cue-wasm";

// Singleton for cue-wasm instance (used for validation only)
let cueInstance: Awaited<ReturnType<typeof initCueWasm>> | null = null;

async function getCue() {
  if (!cueInstance) {
    cueInstance = await initCueWasm();
  }
  return cueInstance;
}

/**
 * Field types derived from CUE type expressions
 */
export type CueFieldType =
  | "string"
  | "string[]"
  | "boolean"
  | "number"
  | "enum"
  | "reference"
  | "object"
  | "unknown";

/**
 * Parsed field from CUE schema
 */
export interface CueField {
  name: string;
  type: CueFieldType;
  optional: boolean;
  enumValues?: string[];
  description?: string;
  refType?: string;
}

/**
 * Parsed entity definition from CUE
 */
export interface CueEntityDef {
  name: string;
  fields: CueField[];
}

/**
 * Known enum type references that should be treated as enums
 */
const KNOWN_ENUM_REFS = new Set([
  "#IssueStatus",
  "#IssuePriority",
  "#IssueType",
  "#CommentKind",
  "#ExternalSource",
  "#PackageSubtype",
  "#ResourceKind",
  "#EntityType",
  "#GroupType",
]);

/**
 * Parse CUE type expression to determine field type
 */
function parseCueType(typeExpr: string): {
  type: CueFieldType;
  enumValues?: string[];
  refType?: string;
} {
  const trimmed = typeExpr.trim();

  // Boolean
  if (trimmed === "bool" || trimmed.startsWith("bool |") || trimmed.startsWith("bool &")) {
    return { type: "boolean" };
  }

  // Number types
  if (trimmed === "int" || trimmed === "number" || trimmed.match(/^(int|number)\s*&/)) {
    return { type: "number" };
  }

  // String array: [...#Slug], [...#Human], [...string]
  if (trimmed.match(/^\[\.\.\.#?\w+\]$/)) {
    return { type: "string[]" };
  }

  // Object array: [...{...}] or [...]
  if (trimmed.match(/^\[\.\.\./) || trimmed.match(/^\[\.\.\./)) {
    return { type: "object" };
  }

  // Enum type: "value1" | "value2" | ... (with optional default)
  const enumMatch = trimmed.match(/^("[\w_-]+"(\s*\|\s*("[\w_-]+"|#\w+|\*"[\w_-]+"))+)$/);
  if (enumMatch || (trimmed.includes('" |') && trimmed.includes('| "'))) {
    const enumValues = [
      ...new Set(
        trimmed
          .split("|")
          .map((v) => v.trim())
          .filter((v) => v.startsWith('"') || v.startsWith('*"'))
          .map((v) => v.replace(/^\*?"([^"]+)"$/, "$1")),
      ),
    ];
    if (enumValues.length > 0) {
      return { type: "enum", enumValues };
    }
  }

  // Reference types: #Slug, #Human, #UUID, #ISODateTime, #URL, etc.
  if (trimmed.startsWith("#")) {
    const refType = trimmed.split(/[\s|]/)[0];

    // EntityRef array is a special reference type
    if (refType === "#EntityRef" || trimmed.includes("#EntityRef")) {
      return { type: "reference", refType };
    }

    // Known enum types should be marked as enum (values resolved later)
    if (KNOWN_ENUM_REFS.has(refType)) {
      return { type: "enum", refType };
    }

    // Most #references are string-based
    return { type: "string", refType };
  }

  // Plain string
  if (trimmed === "string" || trimmed.match(/^string\s*&/)) {
    return { type: "string" };
  }

  // Object type: { ... } or [string]: _
  if (trimmed.startsWith("{") || trimmed.includes("[string]:")) {
    return { type: "object" };
  }

  return { type: "unknown" };
}

/**
 * Parse a single CUE definition block
 */
function parseDefinitionBlock(name: string, block: string): CueEntityDef {
  const fields: CueField[] = [];

  // Match field definitions: fieldName?: type or fieldName: type
  // CUE def output uses tabs for indentation
  const fieldPattern = /^\t([a-zA-Z][a-zA-Z0-9]*)\??\s*:\s*(.+)$/gm;

  let match: RegExpExecArray | null;
  while ((match = fieldPattern.exec(block)) !== null) {
    const fieldName = match[1];
    const typeExpr = match[2];
    const optional = match[0].includes("?:");

    const { type, enumValues, refType } = parseCueType(typeExpr);

    fields.push({
      name: fieldName,
      type,
      optional,
      enumValues,
      refType,
    });
  }

  // Also match embedded struct declarations (standalone #TypeName on a line)
  // These contribute fields from parent types, but we skip them for now
  // as they'd require resolving the parent type's fields

  return { name, fields };
}

/**
 * Parse CUE schema content (from cue def output) and extract entity definitions
 */
export function parseCueSchemaContent(content: string): Map<string, CueEntityDef> {
  const definitions = new Map<string, CueEntityDef>();

  // Match definition blocks: #Name: { ... }
  const defPattern = /#([A-Z][a-zA-Z0-9]*(?:Spec|Config)):\s*\{/g;

  let match: RegExpExecArray | null;
  while ((match = defPattern.exec(content)) !== null) {
    const name = match[1];
    const startIdx = match.index + match[0].length;

    // Find the matching closing brace
    let braceCount = 1;
    let endIdx = startIdx;

    while (braceCount > 0 && endIdx < content.length) {
      if (content[endIdx] === "{") braceCount++;
      if (content[endIdx] === "}") braceCount--;
      endIdx++;
    }

    const block = content.slice(startIdx, endIdx - 1);
    const entityDef = parseDefinitionBlock(name, block);
    definitions.set(name, entityDef);
  }

  return definitions;
}

/**
 * Parse CUE type alias definitions (enums) from cue def output
 */
export function parseCueEnums(content: string): Map<string, string[]> {
  const enums = new Map<string, string[]>();

  // Match type aliases: #Name: "val1" | "val2" | ...
  const enumPattern = /#([A-Z][a-zA-Z0-9]*):\s*("[\w_-]+"(?:\s*\|\s*"[\w_-]+")+)/g;

  let match: RegExpExecArray | null;
  while ((match = enumPattern.exec(content)) !== null) {
    const name = match[1];
    const valuesExpr = match[2];

    const values = valuesExpr
      .split("|")
      .map((v) => v.trim())
      .filter((v) => v.startsWith('"'))
      .map((v) => v.replace(/^"([^"]+)"$/, "$1"));

    enums.set(name, values);
  }

  return enums;
}

/**
 * Load CUE schema definitions by reading schema files directly
 */
export async function loadCueSchemas(schemaDir?: string): Promise<{
  entities: Map<string, CueEntityDef>;
  enums: Map<string, string[]>;
}> {
  // Default to the spec/schema directory
  const defaultSchemaDir = path.resolve(__dirname, "../../../../../spec/schema");
  const dir = schemaDir ?? defaultSchemaDir;

  const schemaFiles = [path.join(dir, "core_types.cue"), path.join(dir, "artifacts.cue")];

  try {
    // Read schema files directly
    const contents: string[] = [];
    for (const file of schemaFiles) {
      if (fs.existsSync(file)) {
        contents.push(fs.readFileSync(file, "utf-8"));
      }
    }

    if (contents.length === 0) {
      return { entities: new Map(), enums: new Map() };
    }

    const content = contents.join("\n\n");

    // Optionally validate with cue-wasm (catches syntax errors)
    try {
      const cue = await getCue();
      cue.parse(content);
    } catch (parseError) {
      // Log parse error but continue - regex parsing may still work
      console.warn("CUE validation warning:", parseError);
    }

    const entities = parseCueSchemaContent(content);
    const enums = parseCueEnums(content);

    return { entities, enums };
  } catch (error) {
    // Return empty if CUE parsing fails (will use fallback)
    console.warn("CUE schema loading failed:", error);
    return { entities: new Map(), enums: new Map() };
  }
}

/**
 * Get filterable fields for an entity type
 * Excludes fields that don't make sense for filtering
 */
export function getFilterableFields(entityDef: CueEntityDef): CueField[] {
  const nonFilterableFields = new Set([
    "description",
    "content",
    "metadata",
    "handler",
    "env",
    "resources",
    "healthCheck",
    "structure",
    "related",
    "ports",
    "bin",
    "commands",
    "endpoints",
    "views",
    "middleware",
  ]);

  const filterableTypes: CueFieldType[] = [
    "string",
    "string[]",
    "boolean",
    "number",
    "enum",
    "reference",
  ];

  return entityDef.fields.filter(
    (field) => filterableTypes.includes(field.type) && !nonFilterableFields.has(field.name),
  );
}
