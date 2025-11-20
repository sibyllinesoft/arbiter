/**
 * CUE Schema Parser backed by the official cue-runner
 *
 * Avoids regex/string parsing and instead relies on the CUE toolchain to
 * export schemas to JSON, then derives a lightweight documentation model
 * (ParsedSchema/ParsedType/ParsedField) used by the docs generator.
 */

import path from "node:path";
import { CueRunner } from "@arbiter/cue-runner";
import fs from "fs-extra";

export interface ParsedField {
  name: string;
  type: string;
  description?: string;
  constraints?: string[];
  optional?: boolean;
  defaultValue?: string;
  examples?: any[];
  validation?: string;
  references?: string[];
}

export interface ParsedType {
  name: string;
  description?: string;
  kind: "struct" | "enum" | "constraint" | "union" | "primitive";
  fields?: ParsedField[];
  values?: string[]; // for enums
  baseType?: string;
  constraints?: string[];
  examples?: any[];
  location?: {
    file: string;
    line: number;
  };
  usedBy?: string[];
  dependsOn?: string[];
}

export interface ParsedSchema {
  package: string;
  imports: string[];
  types: Map<string, ParsedType>;
  comments: Map<string, string>;
  metadata: {
    file: string;
    version?: string;
    description?: string;
  };
}

export interface SchemaParserOptions {
  includePrivate?: boolean;
  runner?: Pick<CueRunner, "exportJson">;
}

export class CUESchemaParser {
  private readonly includePrivate: boolean;
  private readonly runner: Pick<CueRunner, "exportJson">;

  constructor(options: SchemaParserOptions = {}) {
    this.includePrivate = options.includePrivate ?? false;
    this.runner = options.runner ?? new CueRunner();
  }

  async parseDirectory(dir: string): Promise<ParsedSchema> {
    const files = this.findCueFiles(dir);
    if (files.length === 0) {
      throw new Error(`No .cue files found in ${dir}`);
    }
    return await this.parseFiles(files);
  }

  async parseFiles(filePaths: string[]): Promise<ParsedSchema> {
    const schemas: ParsedSchema[] = [];

    for (const file of filePaths) {
      schemas.push(await this.parseFile(file));
    }

    return this.mergeSchemas(schemas);
  }

  async parseFile(filePath: string): Promise<ParsedSchema> {
    const content = await fs.readFile(filePath, "utf8");
    const pkg = this.extractPackageName(content) || path.basename(path.dirname(filePath));
    const description = this.extractFileDescription(content);

    const exportResult = await this.runner.exportJson([filePath]);
    if (!exportResult.success || !exportResult.value) {
      const reason =
        exportResult.diagnostics?.[0]?.message || exportResult.error || "Unknown CUE export error";
      throw new Error(`Failed to parse ${filePath}: ${reason}`);
    }

    const types = new Map<string, ParsedType>();
    this.walkValue(exportResult.value, pkg, filePath, types, []);

    return {
      package: pkg,
      imports: [],
      types,
      comments: new Map(),
      metadata: {
        file: path.basename(filePath),
        description,
      },
    };
  }

  // --- helpers ---

  private findCueFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...this.findCueFiles(full));
      } else if (entry.isFile() && entry.name.endsWith(".cue")) {
        files.push(full);
      }
    }
    return files;
  }

  private extractPackageName(content: string): string | undefined {
    const match = content.match(/^package\s+([\w-]+)/m);
    return match?.[1];
  }

  private extractFileDescription(content: string): string | undefined {
    const lines = content.split("\n");
    const comments: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//")) {
        comments.push(trimmed.substring(2).trim());
      } else if (trimmed === "" && comments.length > 0) {
        continue;
      } else {
        break;
      }
    }

    return comments.length > 0 ? comments.join(" ").trim() : undefined;
  }

  private walkValue(
    value: unknown,
    pkg: string,
    filePath: string,
    types: Map<string, ParsedType>,
    pathStack: string[],
  ): string | undefined {
    if (Array.isArray(value)) {
      // arrays: derive element type and note as union/primitive
      const elementType =
        value.length > 0 ? this.walkValue(value[0], pkg, filePath, types, pathStack) : "Any";
      return `${elementType || "Any"}[]`;
    }

    if (value !== null && typeof value === "object") {
      const typeName = this.buildTypeName(pathStack);
      if (!typeName) return "object";

      if (types.has(typeName)) {
        return typeName;
      }

      const fields: ParsedField[] = [];
      const dependsOn: string[] = [];

      for (const [key, val] of Object.entries(value)) {
        if (!this.includePrivate && key.startsWith("_")) continue;
        const childPath = [...pathStack, key];
        const fieldType = this.walkValue(val, pkg, filePath, types, childPath) || "any";
        fields.push({ name: key, type: fieldType });
        if (types.has(fieldType)) {
          dependsOn.push(fieldType);
        }
      }

      types.set(typeName, {
        name: typeName,
        kind: "struct",
        fields,
        dependsOn,
        usedBy: [],
        location: { file: filePath, line: 0 },
      });

      return typeName;
    }

    // primitive
    const primitiveType = this.inferPrimitive(value);
    return primitiveType;
  }

  private buildTypeName(pathStack: string[]): string {
    if (pathStack.length === 0) return "Root";
    return pathStack.map((p) => this.capitalize(p.replace(/[^a-zA-Z0-9]/g, "_"))).join("");
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private inferPrimitive(value: unknown): string {
    switch (typeof value) {
      case "string":
        return "string";
      case "number":
        return Number.isInteger(value as number) ? "int" : "float";
      case "boolean":
        return "bool";
      default:
        return "any";
    }
  }

  private mergeSchemas(schemas: ParsedSchema[]): ParsedSchema {
    if (schemas.length === 0) {
      throw new Error("No schemas to merge");
    }

    const merged: ParsedSchema = {
      package: schemas[0].package,
      imports: [],
      types: new Map(),
      comments: new Map(),
      metadata: {
        file: "merged",
        description: "Merged schema from multiple files",
      },
    };

    for (const schema of schemas) {
      for (const imp of schema.imports) {
        if (!merged.imports.includes(imp)) merged.imports.push(imp);
      }
      for (const [name, type] of schema.types) {
        merged.types.set(name, type);
      }
      for (const [name, comment] of schema.comments) {
        merged.comments.set(name, comment);
      }
    }

    // Build reverse relationships
    for (const [name, type] of merged.types) {
      if (!type.dependsOn) continue;
      for (const dep of type.dependsOn) {
        const depType = merged.types.get(dep);
        if (!depType) continue;
        depType.usedBy = depType.usedBy ?? [];
        if (!depType.usedBy.includes(name)) depType.usedBy.push(name);
      }
    }

    return merged;
  }
}
