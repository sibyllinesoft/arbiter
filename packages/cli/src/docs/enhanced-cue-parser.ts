/**
 * Enhanced CUE Parser for Complex Schema Analysis
 *
 * Handles complex CUE constructs including nested structures, imports,
 * references, and advanced validation patterns.
 */

import { existsSync, readFileSync } from "fs";
import path from "path";
import { ParsedField, ParsedSchema, ParsedType } from "@/docs/schema-parser.js";

export interface CUEStructField {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
  constraints?: string[];
  validation?: string;
  defaultValue?: string;
  examples?: any[];
  nested?: CUEStructField[];
}

export interface CUEContext {
  currentPath: string[];
  currentIndent: number;
  imports: Map<string, string>;
  references: Map<string, string>;
}

export class EnhancedCUEParser {
  private schemas = new Map<string, ParsedSchema>();
  private globalContext: CUEContext = {
    currentPath: [],
    currentIndent: 0,
    imports: new Map(),
    references: new Map(),
  };

  /**
   * Parse multiple CUE files with full context resolution
   */
  async parseSchemaDirectory(schemaDir: string): Promise<ParsedSchema> {
    const cueFiles = this.findCUEFiles(schemaDir);

    // First pass: Parse all files individually
    for (const file of cueFiles) {
      const schema = await this.parseFileWithContext(file);
      this.schemas.set(file, schema);
    }

    // Second pass: Resolve cross-file references
    await this.resolveReferences();

    // Merge all schemas
    return this.mergeAllSchemas();
  }

  private findCUEFiles(dir: string): string[] {
    const fs = require("fs");
    const files: string[] = [];

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...this.findCUEFiles(fullPath));
        } else if (entry.name.endsWith(".cue")) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Could not read directory ${dir}: ${error}`);
    }

    return files;
  }

  private async parseFileWithContext(filePath: string): Promise<ParsedSchema> {
    const content = readFileSync(filePath, "utf-8");
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

    const context: CUEContext = {
      currentPath: [],
      currentIndent: 0,
      imports: new Map(),
      references: new Map(),
    };

    let currentComment = "";
    let lineNumber = 0;
    let inStructDefinition = false;
    let structStack: Array<{ name: string; fields: CUEStructField[]; indent: number }> = [];

    for (const line of lines) {
      lineNumber++;
      const indent = this.getIndentation(line);
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) {
        continue;
      }

      // Handle package declaration
      if (trimmed.startsWith("package ")) {
        schema.package = trimmed.replace("package ", "");
        continue;
      }

      // Handle imports
      if (trimmed.startsWith("import ")) {
        const importInfo = this.parseImport(trimmed);
        if (importInfo) {
          schema.imports.push(importInfo.module);
          context.imports.set(importInfo.alias || importInfo.module, importInfo.module);
        }
        continue;
      }

      // Collect comments
      if (trimmed.startsWith("//")) {
        currentComment += trimmed.substring(2).trim() + " ";
        continue;
      }

      // Handle struct field definitions
      if (inStructDefinition) {
        if (indent <= context.currentIndent) {
          // End of struct definition
          inStructDefinition = false;
          this.finalizeStructDefinition(structStack, schema);
          structStack = [];
        } else {
          // Parse field within struct
          const field = this.parseStructField(line, currentComment, context);
          if (field && structStack.length > 0) {
            structStack[structStack.length - 1].fields.push(field);
          }
          currentComment = "";
          continue;
        }
      }

      // Parse type definitions
      if (trimmed.includes("#") && trimmed.includes(":")) {
        const typeInfo = this.parseComplexType(line, lineNumber, currentComment, context);
        if (typeInfo) {
          typeInfo.location = {
            file: filePath,
            line: lineNumber,
          };

          schema.types.set(typeInfo.name, typeInfo);
          if (currentComment) {
            schema.comments.set(typeInfo.name, currentComment.trim());
          }

          // Check if this starts a struct definition
          if (typeInfo.kind === "struct" && line.includes("{")) {
            inStructDefinition = true;
            context.currentIndent = indent;
            structStack.push({
              name: typeInfo.name,
              fields: [],
              indent: indent,
            });
          }
        }
        currentComment = "";
        continue;
      }

      // Reset comment if we hit a non-comment, non-type line
      currentComment = "";
    }

    // Finalize any remaining struct definitions
    if (structStack.length > 0) {
      this.finalizeStructDefinition(structStack, schema);
    }

    return schema;
  }

  private parseImport(importLine: string): { module: string; alias?: string } | null {
    // Handle various import formats:
    // import "module"
    // import alias "module"
    const aliasMatch = importLine.match(/import\s+(\w+)\s+"([^"]+)"/);
    if (aliasMatch) {
      return { module: aliasMatch[2], alias: aliasMatch[1] };
    }

    const simpleMatch = importLine.match(/import\s+"([^"]+)"/);
    if (simpleMatch) {
      return { module: simpleMatch[1] };
    }

    return null;
  }

  private parseComplexType(
    line: string,
    lineNumber: number,
    comment: string,
    context: CUEContext,
  ): ParsedType | null {
    const trimmed = line.trim();

    // Enhanced regex for complex type definitions
    const typeDefMatch = trimmed.match(/^(#\w+):\s*(.+?)(?:\s*\{.*)?$/);
    if (!typeDefMatch) return null;

    const [, typeName, definition] = typeDefMatch;
    const name = typeName.substring(1);

    const typeInfo: ParsedType = {
      name,
      description: comment.trim() || undefined,
      kind: this.determineComplexTypeKind(definition, line),
      location: { file: "", line: lineNumber },
      constraints: [],
      examples: [],
      usedBy: [],
      dependsOn: [],
    };

    // Parse based on type kind
    switch (typeInfo.kind) {
      case "constraint":
        this.parseConstraintType(definition, typeInfo);
        break;
      case "union":
        this.parseUnionType(definition, typeInfo);
        break;
      case "struct":
        this.parseStructType(definition, typeInfo);
        break;
      case "enum":
        this.parseEnumType(definition, typeInfo);
        break;
      default:
        this.parsePrimitiveType(definition, typeInfo);
    }

    // Extract examples from comments
    const examples = this.extractExamplesFromComment(comment);
    if (examples.length > 0) {
      typeInfo.examples = examples;
    }

    // Extract dependencies
    typeInfo.dependsOn = this.extractTypeDependencies(definition);

    return typeInfo;
  }

  private parseStructField(
    line: string,
    comment: string,
    context: CUEContext,
  ): CUEStructField | null {
    const trimmed = line.trim();

    // Parse field definition patterns:
    // fieldName: Type
    // fieldName?: Type
    // fieldName: Type & constraints
    // [fieldPattern]: Type

    const fieldMatch = trimmed.match(/^(\w+|\[[^\]]+\])(\??):\s*(.+)$/);
    if (!fieldMatch) return null;

    const [, fieldName, optional, fieldType] = fieldMatch;

    const field: CUEStructField = {
      name: fieldName.startsWith("[") ? fieldName : fieldName,
      type: fieldType.trim(),
      optional: optional === "?",
      description: comment.trim() || undefined,
      constraints: [],
      examples: [],
    };

    // Parse constraints and type information
    if (fieldType.includes("&")) {
      const parts = fieldType.split("&").map((p) => p.trim());
      field.type = parts[0];
      field.constraints = parts.slice(1).map((c) => this.normalizeConstraint(c));
    }

    // Extract validation patterns
    if (fieldType.includes("=~")) {
      const regexMatch = fieldType.match(/=~"([^"]+)"/);
      if (regexMatch) {
        field.validation = regexMatch[1];
        field.constraints?.push(`Pattern: ${regexMatch[1]}`);
      }
    }

    // Extract default value
    if (fieldType.includes("*")) {
      const defaultMatch = fieldType.match(/\*([^&\s]+)/);
      if (defaultMatch) {
        field.defaultValue = defaultMatch[1];
      }
    }

    // Extract examples from comments
    const examples = this.extractExamplesFromComment(comment);
    if (examples.length > 0) {
      field.examples = examples;
    }

    return field;
  }

  private determineComplexTypeKind(
    definition: string,
    fullLine: string,
  ): "struct" | "enum" | "constraint" | "union" | "primitive" {
    if (
      fullLine.includes("{") ||
      definition.includes("minFields") ||
      definition.includes("maxFields")
    ) {
      return "struct";
    }
    if (definition.includes("|") && definition.includes('"')) {
      return "enum";
    }
    if (definition.includes("|")) {
      return "union";
    }
    if (
      definition.includes("=~") ||
      definition.includes("&") ||
      definition.includes(">=") ||
      definition.includes("<=")
    ) {
      return "constraint";
    }
    return "primitive";
  }

  private parseConstraintType(definition: string, typeInfo: ParsedType): void {
    typeInfo.baseType = this.extractBaseType(definition);
    typeInfo.constraints = this.parseDetailedConstraints(definition);
  }

  private parseUnionType(definition: string, typeInfo: ParsedType): void {
    typeInfo.values = this.parseUnionValues(definition);
    if (typeInfo.values.every((v) => v.startsWith('"') && v.endsWith('"'))) {
      typeInfo.kind = "enum";
      typeInfo.values = typeInfo.values.map((v) => v.slice(1, -1));
    }
  }

  private parseStructType(definition: string, typeInfo: ParsedType): void {
    typeInfo.fields = [];
    // Struct field parsing is handled in the main parsing loop
  }

  private parseEnumType(definition: string, typeInfo: ParsedType): void {
    typeInfo.values = this.parseUnionValues(definition);
  }

  private parsePrimitiveType(definition: string, typeInfo: ParsedType): void {
    typeInfo.baseType = definition.trim();
  }

  private parseDetailedConstraints(definition: string): string[] {
    const constraints: string[] = [];

    // Numeric constraints
    const numericPatterns = [
      { pattern: />(\d+(?:\.\d+)?)(?!\d)/g, format: (v: string) => `Greater than: ${v}` },
      { pattern: /<(\d+(?:\.\d+)?)(?!\d)/g, format: (v: string) => `Less than: ${v}` },
      { pattern: />=(\d+(?:\.\d+)?)/g, format: (v: string) => `Minimum: ${v}` },
      { pattern: /<=(\d+(?:\.\d+)?)/g, format: (v: string) => `Maximum: ${v}` },
    ];

    for (const { pattern, format } of numericPatterns) {
      let match;
      while ((match = pattern.exec(definition)) !== null) {
        constraints.push(format(match[1]));
      }
    }

    // String constraints
    if (definition.includes('!=""')) {
      constraints.push("Non-empty string");
    }

    // Pattern constraints
    const patternMatch = definition.match(/=~"([^"]+)"/);
    if (patternMatch) {
      constraints.push(`Pattern: ${patternMatch[1]}`);
    }

    // Array/object constraints
    const constraintFunctions = [
      { pattern: /minItems\((\d+)\)/, format: (v: string) => `Minimum items: ${v}` },
      { pattern: /maxItems\((\d+)\)/, format: (v: string) => `Maximum items: ${v}` },
      { pattern: /minFields\((\d+)\)/, format: (v: string) => `Minimum fields: ${v}` },
      { pattern: /maxFields\((\d+)\)/, format: (v: string) => `Maximum fields: ${v}` },
      { pattern: /minLength\((\d+)\)/, format: (v: string) => `Minimum length: ${v}` },
      { pattern: /maxLength\((\d+)\)/, format: (v: string) => `Maximum length: ${v}` },
    ];

    for (const { pattern, format } of constraintFunctions) {
      const match = definition.match(pattern);
      if (match) {
        constraints.push(format(match[1]));
      }
    }

    return constraints;
  }

  private parseUnionValues(definition: string): string[] {
    const values: string[] = [];
    const parts = definition.split("|");

    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
        values.push(trimmed);
      } else if (trimmed && !trimmed.includes("#") && !trimmed.includes("&")) {
        values.push(trimmed);
      }
    }

    return values;
  }

  private extractTypeDependencies(definition: string): string[] {
    const dependencies: string[] = [];
    const typeReferences = definition.match(/#\w+/g);

    if (typeReferences) {
      for (const ref of typeReferences) {
        dependencies.push(ref.substring(1));
      }
    }

    return [...new Set(dependencies)];
  }

  private extractExamplesFromComment(comment: string): string[] {
    const examples: string[] = [];

    // Match various example patterns
    const patterns = [
      /e\.g\.,?\s*([^,\n]+)/gi,
      /example:?\s*([^,\n]+)/gi,
      /for example:?\s*([^,\n]+)/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(comment)) !== null) {
        examples.push(match[1].trim());
      }
    }

    return examples;
  }

  private extractBaseType(definition: string): string {
    const parts = definition.split("&");
    if (parts.length > 0) {
      const first = parts[0].trim();
      if (first.startsWith("#")) {
        return first;
      }
      if (["string", "int", "number", "bool", "float"].includes(first)) {
        return first;
      }
    }
    return "unknown";
  }

  private normalizeConstraint(constraint: string): string {
    return constraint
      .trim()
      .replace(/^\||\&/, "")
      .trim();
  }

  private getIndentation(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  private extractFileDescription(content: string): string | undefined {
    const lines = content.split("\n");
    const comments: string[] = [];
    let inHeaderComment = true;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("//") && inHeaderComment) {
        comments.push(trimmed.substring(2).trim());
      } else if (trimmed === "" && comments.length > 0) {
        continue; // Skip empty lines in comment blocks
      } else if (trimmed.startsWith("package ")) {
        continue; // Skip package declaration
      } else if (trimmed) {
        inHeaderComment = false;
        break;
      }
    }

    return comments.length > 0 ? comments.join(" ").trim() : undefined;
  }

  private finalizeStructDefinition(
    structStack: Array<{ name: string; fields: CUEStructField[]; indent: number }>,
    schema: ParsedSchema,
  ): void {
    if (structStack.length === 0) return;

    const structDef = structStack[0];
    const typeInfo = schema.types.get(structDef.name);

    if (typeInfo && typeInfo.kind === "struct") {
      // Convert CUEStructField[] to ParsedField[]
      typeInfo.fields = structDef.fields.map((field) => ({
        name: field.name,
        type: field.type,
        description: field.description,
        constraints: field.constraints,
        optional: field.optional,
        defaultValue: field.defaultValue,
        examples: field.examples,
        validation: field.validation,
        references: field.type.startsWith("#") ? [field.type.substring(1)] : undefined,
      }));
    }
  }

  private async resolveReferences(): Promise<void> {
    // Second pass to resolve cross-file references
    for (const schema of this.schemas.values()) {
      for (const [name, type] of schema.types) {
        // Update dependencies based on resolved references
        this.resolveTypeDependencies(type, schema);
      }
    }
  }

  private resolveTypeDependencies(type: ParsedType, schema: ParsedSchema): void {
    // This would implement cross-file reference resolution
    // For now, we handle intra-file dependencies

    if (type.fields) {
      for (const field of type.fields) {
        if (field.type.startsWith("#")) {
          const referencedType = field.type.substring(1);
          if (!type.dependsOn?.includes(referencedType)) {
            type.dependsOn = type.dependsOn || [];
            type.dependsOn.push(referencedType);
          }
        }
      }
    }
  }

  private mergeAllSchemas(): ParsedSchema {
    const schemas = Array.from(this.schemas.values());
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

    // Build final relationships
    this.buildGlobalRelationships(merged);

    return merged;
  }

  private buildGlobalRelationships(schema: ParsedSchema): void {
    // Build usage relationships
    for (const [typeName, typeInfo] of schema.types) {
      if (typeInfo.dependsOn) {
        for (const dep of typeInfo.dependsOn) {
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
  }
}
