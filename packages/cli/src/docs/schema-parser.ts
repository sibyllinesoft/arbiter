/**
 * CUE Schema Parser for Arbiter
 *
 * Parses CUE schema files to extract type definitions, constraints, comments,
 * and metadata for documentation generation.
 */

import { readFileSync } from "fs";
import path from "path";

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

export class CUESchemaParser {
  private currentFile: string = "";

  /**
   * Parse a CUE schema file and extract type definitions
   */
  parseFile(filePath: string): ParsedSchema {
    this.currentFile = filePath;
    const content = readFileSync(filePath, "utf-8");
    return this.parseContent(content, filePath);
  }

  /**
   * Parse multiple schema files and merge them
   */
  parseFiles(filePaths: string[]): ParsedSchema {
    const schemas = filePaths.map((path) => this.parseFile(path));
    return this.mergeSchemas(schemas);
  }

  private parseContent(content: string, filePath: string): ParsedSchema {
    const lines = content.split("\n");
    const schema: ParsedSchema = {
      package: "",
      imports: [],
      types: new Map(),
      comments: new Map(),
      metadata: {
        file: path.basename(filePath),
        description: this.extractFileDescription(content),
      },
    };

    let currentComment = "";
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      const trimmed = line.trim();

      // Extract package declaration
      if (trimmed.startsWith("package ")) {
        schema.package = trimmed.replace("package ", "");
        continue;
      }

      // Extract imports
      if (trimmed.startsWith("import ")) {
        const importMatch = trimmed.match(/import\s+"([^"]+)"/);
        if (importMatch) {
          schema.imports.push(importMatch[1]);
        }
        continue;
      }

      // Collect comments
      if (trimmed.startsWith("//")) {
        currentComment += trimmed.substring(2).trim() + " ";
        continue;
      }

      // Parse type definitions
      if (trimmed.includes("#") && (trimmed.includes(":") || trimmed.includes("="))) {
        const typeInfo = this.parseTypeDefinition(line, lineNumber, currentComment);
        if (typeInfo) {
          typeInfo.location = {
            file: filePath,
            line: lineNumber,
          };
          schema.types.set(typeInfo.name, typeInfo);
          if (currentComment) {
            schema.comments.set(typeInfo.name, currentComment.trim());
          }
        }
        currentComment = "";
        continue;
      }

      // Reset comment if we hit a non-comment, non-type line
      if (trimmed && !trimmed.startsWith("//")) {
        currentComment = "";
      }
    }

    // Extract relationships and dependencies
    this.extractRelationships(schema);

    return schema;
  }

  private parseTypeDefinition(
    line: string,
    lineNumber: number,
    comment: string,
  ): ParsedType | null {
    const trimmed = line.trim();

    // Match type definition patterns
    const typeDefMatch = trimmed.match(/^(#\w+):\s*(.+)$/);
    if (!typeDefMatch) return null;

    const [, typeName, definition] = typeDefMatch;
    const name = typeName.substring(1); // Remove the # prefix

    const typeInfo: ParsedType = {
      name,
      description: comment.trim() || undefined,
      kind: this.determineTypeKind(definition),
      location: { file: this.currentFile, line: lineNumber },
      constraints: [],
      examples: [],
      usedBy: [],
      dependsOn: [],
    };

    // Parse different type definitions
    if (definition.includes("=~")) {
      // Regex constraint
      typeInfo.kind = "constraint";
      typeInfo.baseType = "string";
      const regexMatch = definition.match(/=~"([^"]+)"/);
      if (regexMatch) {
        typeInfo.constraints = [`Pattern: ${regexMatch[1]}`];
      }
    } else if (definition.includes("|")) {
      // Union type or enum
      typeInfo.kind = "union";
      typeInfo.values = this.parseUnionValues(definition);
    } else if (definition.includes("&")) {
      // Type with constraints
      typeInfo.kind = "constraint";
      typeInfo.constraints = this.parseConstraints(definition);
      typeInfo.baseType = this.extractBaseType(definition);
    } else if (definition.includes("{")) {
      // Struct type
      typeInfo.kind = "struct";
      typeInfo.fields = []; // Will be parsed in a subsequent pass for nested structures
    } else {
      // Simple type reference or primitive
      typeInfo.kind = "primitive";
      typeInfo.baseType = definition.trim();
    }

    // Extract examples from comments
    const exampleMatch = comment.match(/e\.g\.,?\s*([^,\n]+)/i);
    if (exampleMatch) {
      typeInfo.examples = [exampleMatch[1].trim()];
    }

    return typeInfo;
  }

  private determineTypeKind(
    definition: string,
  ): "struct" | "enum" | "constraint" | "union" | "primitive" {
    if (definition.includes("{")) return "struct";
    if (definition.includes("|") && definition.includes('"')) return "enum";
    if (definition.includes("|")) return "union";
    if (definition.includes("=~") || definition.includes("&")) return "constraint";
    return "primitive";
  }

  private parseUnionValues(definition: string): string[] {
    const values: string[] = [];
    const parts = definition.split("|");

    for (const part of parts) {
      const trimmed = part.trim();
      const stringMatch = trimmed.match(/"([^"]+)"/);
      if (stringMatch) {
        values.push(stringMatch[1]);
      } else if (trimmed && !trimmed.includes("#")) {
        values.push(trimmed);
      }
    }

    return values;
  }

  private parseConstraints(definition: string): string[] {
    const constraints: string[] = [];

    // Parse numeric constraints
    if (definition.includes(">=")) {
      const match = definition.match(/>=(\d+(?:\.\d+)?)/);
      if (match) constraints.push(`Minimum: ${match[1]}`);
    }
    if (definition.includes("<=")) {
      const match = definition.match(/<=(\d+(?:\.\d+)?)/);
      if (match) constraints.push(`Maximum: ${match[1]}`);
    }
    if (definition.includes(">") && !definition.includes(">=")) {
      const match = definition.match(/>(\d+(?:\.\d+)?)/);
      if (match) constraints.push(`Greater than: ${match[1]}`);
    }
    if (definition.includes("<") && !definition.includes("<=")) {
      const match = definition.match(/<(\d+(?:\.\d+)?)/);
      if (match) constraints.push(`Less than: ${match[1]}`);
    }

    // Parse string constraints
    if (definition.includes('!=""')) {
      constraints.push("Non-empty string");
    }

    // Parse array constraints
    const minItemsMatch = definition.match(/minItems\((\d+)\)/);
    if (minItemsMatch) {
      constraints.push(`Minimum items: ${minItemsMatch[1]}`);
    }

    const minFieldsMatch = definition.match(/minFields\((\d+)\)/);
    if (minFieldsMatch) {
      constraints.push(`Minimum fields: ${minFieldsMatch[1]}`);
    }

    return constraints;
  }

  private extractBaseType(definition: string): string {
    // Extract the base type from a constraint definition
    const parts = definition.split("&");
    if (parts.length > 0) {
      const first = parts[0].trim();
      if (first.includes("#")) {
        return first;
      }
      if (["string", "int", "number", "bool"].includes(first)) {
        return first;
      }
    }
    return "unknown";
  }

  private extractFileDescription(content: string): string | undefined {
    const lines = content.split("\n");
    const comments: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//")) {
        comments.push(trimmed.substring(2).trim());
      } else if (trimmed === "" && comments.length > 0) {
        continue; // Skip empty lines in comment blocks
      } else {
        break; // Stop at first non-comment line
      }
    }

    return comments.length > 0 ? comments.join(" ").trim() : undefined;
  }

  private extractRelationships(schema: ParsedSchema): void {
    // Build dependency graph
    for (const [typeName, typeInfo] of schema.types) {
      // Find dependencies (types referenced in this type's definition)
      const dependencies = this.findTypeDependencies(typeInfo);
      typeInfo.dependsOn = dependencies;

      // Update reverse relationships
      for (const dep of dependencies) {
        const depType = schema.types.get(dep);
        if (depType) {
          depType.usedBy = depType.usedBy || [];
          if (!depType.usedBy.includes(typeName)) {
            depType.usedBy.push(typeName);
          }
        }
      }
    }
  }

  private findTypeDependencies(typeInfo: ParsedType): string[] {
    const dependencies: string[] = [];

    // Check base type
    if (typeInfo.baseType?.startsWith("#")) {
      dependencies.push(typeInfo.baseType.substring(1));
    }

    // Check field types (for structs)
    if (typeInfo.fields) {
      for (const field of typeInfo.fields) {
        if (field.type.startsWith("#")) {
          dependencies.push(field.type.substring(1));
        }
      }
    }

    return [...new Set(dependencies)]; // Remove duplicates
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

    // Merge all schemas
    for (const schema of schemas) {
      // Merge imports
      for (const imp of schema.imports) {
        if (!merged.imports.includes(imp)) {
          merged.imports.push(imp);
        }
      }

      // Merge types
      for (const [name, type] of schema.types) {
        merged.types.set(name, type);
      }

      // Merge comments
      for (const [name, comment] of schema.comments) {
        merged.comments.set(name, comment);
      }
    }

    return merged;
  }
}
