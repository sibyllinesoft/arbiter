/**
 * Enhanced CUE Parser for Complex Schema Analysis
 *
 * Handles complex CUE constructs including nested structures, imports,
 * references, and advanced validation patterns.
 */

import { existsSync, readFileSync } from "fs";
import path from "path";
import { ParsedField, ParsedSchema, ParsedType } from "@/docs/parser/schema-parser.js";

/** Type alias for parsed CUE type information (same as ParsedType) */
type CUETypeInfo = ParsedType;

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

/** Parser for CUE schema files that extracts type information and relationships. */
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

  private createInitialParseState(): {
    currentComment: string;
    lineNumber: number;
    inStructDefinition: boolean;
    structStack: Array<{ name: string; fields: CUEStructField[]; indent: number }>;
  } {
    return {
      currentComment: "",
      lineNumber: 0,
      inStructDefinition: false,
      structStack: [],
    };
  }

  private createInitialSchema(filePath: string, content: string): ParsedSchema {
    return {
      package: "",
      imports: [],
      types: new Map(),
      comments: new Map(),
      metadata: {
        file: path.basename(filePath),
        description: this.extractFileDescription(content),
      },
    };
  }

  private createInitialContext(): CUEContext {
    return {
      currentPath: [],
      currentIndent: 0,
      imports: new Map(),
      references: new Map(),
    };
  }

  private handlePackageDeclaration(trimmed: string, schema: ParsedSchema): boolean {
    if (trimmed.startsWith("package ")) {
      schema.package = trimmed.replace("package ", "");
      return true;
    }
    return false;
  }

  private handleImportDeclaration(
    trimmed: string,
    schema: ParsedSchema,
    context: CUEContext,
  ): boolean {
    if (trimmed.startsWith("import ")) {
      const importInfo = this.parseImport(trimmed);
      if (importInfo) {
        schema.imports.push(importInfo.module);
        context.imports.set(importInfo.alias || importInfo.module, importInfo.module);
      }
      return true;
    }
    return false;
  }

  private handleCommentLine(trimmed: string, state: { currentComment: string }): boolean {
    if (trimmed.startsWith("//")) {
      state.currentComment += trimmed.substring(2).trim() + " ";
      return true;
    }
    return false;
  }

  private handleStructFieldInDefinition(
    line: string,
    indent: number,
    context: CUEContext,
    state: {
      currentComment: string;
      inStructDefinition: boolean;
      structStack: Array<{ name: string; fields: CUEStructField[]; indent: number }>;
    },
    schema: ParsedSchema,
  ): boolean {
    if (!state.inStructDefinition) return false;

    if (indent <= context.currentIndent) {
      state.inStructDefinition = false;
      this.finalizeStructDefinition(state.structStack, schema);
      state.structStack = [];
      return false; // Continue processing this line
    }

    const field = this.parseStructField(line, state.currentComment, context);
    if (field && state.structStack.length > 0) {
      state.structStack[state.structStack.length - 1].fields.push(field);
    }
    state.currentComment = "";
    return true;
  }

  private registerTypeInfo(
    typeInfo: CUETypeInfo,
    filePath: string,
    state: { currentComment: string; lineNumber: number },
    schema: ParsedSchema,
  ): void {
    typeInfo.location = { file: filePath, line: state.lineNumber };
    schema.types.set(typeInfo.name, typeInfo);
    if (state.currentComment) {
      schema.comments.set(typeInfo.name, state.currentComment.trim());
    }
  }

  private initStructDefinition(
    typeInfo: CUETypeInfo,
    line: string,
    indent: number,
    context: CUEContext,
    state: {
      inStructDefinition: boolean;
      structStack: Array<{ name: string; fields: CUEStructField[]; indent: number }>;
    },
  ): void {
    if (typeInfo.kind === "struct" && line.includes("{")) {
      state.inStructDefinition = true;
      context.currentIndent = indent;
      state.structStack.push({ name: typeInfo.name, fields: [], indent });
    }
  }

  private handleTypeDefinition(
    line: string,
    trimmed: string,
    indent: number,
    filePath: string,
    context: CUEContext,
    state: {
      currentComment: string;
      lineNumber: number;
      inStructDefinition: boolean;
      structStack: Array<{ name: string; fields: CUEStructField[]; indent: number }>;
    },
    schema: ParsedSchema,
  ): boolean {
    if (!trimmed.includes("#") || !trimmed.includes(":")) return false;

    const typeInfo = this.parseComplexType(line, state.lineNumber, state.currentComment, context);
    if (typeInfo) {
      this.registerTypeInfo(typeInfo, filePath, state, schema);
      this.initStructDefinition(typeInfo, line, indent, context, state);
    }
    state.currentComment = "";
    return true;
  }

  private processLine(
    line: string,
    filePath: string,
    schema: ParsedSchema,
    context: any,
    state: any,
  ): void {
    state.lineNumber++;
    const indent = this.getIndentation(line);
    const trimmed = line.trim();

    if (!trimmed) return;
    if (this.handlePackageDeclaration(trimmed, schema)) return;
    if (this.handleImportDeclaration(trimmed, schema, context)) return;
    if (this.handleCommentLine(trimmed, state)) return;
    if (this.handleStructFieldInDefinition(line, indent, context, state, schema)) return;
    if (this.handleTypeDefinition(line, trimmed, indent, filePath, context, state, schema)) return;

    state.currentComment = "";
  }

  private async parseFileWithContext(filePath: string): Promise<ParsedSchema> {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    const schema = this.createInitialSchema(filePath, content);
    const context = this.createInitialContext();
    const state = this.createInitialParseState();

    for (const line of lines) {
      this.processLine(line, filePath, schema, context, state);
    }

    if (state.structStack.length > 0) {
      this.finalizeStructDefinition(state.structStack, schema);
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

  /**
   * Parse constraints from field type using '&' separator.
   */
  private parseFieldConstraints(fieldType: string): { type: string; constraints: string[] } {
    if (!fieldType.includes("&")) {
      return { type: fieldType.trim(), constraints: [] };
    }

    const parts = fieldType.split("&").map((p) => p.trim());
    return {
      type: parts[0],
      constraints: parts.slice(1).map((c) => this.normalizeConstraint(c)),
    };
  }

  /**
   * Extract validation pattern from field type.
   */
  private extractValidationPattern(fieldType: string): {
    validation?: string;
    constraint?: string;
  } {
    if (!fieldType.includes("=~")) return {};

    const regexMatch = fieldType.match(/=~"([^"]+)"/);
    if (!regexMatch) return {};

    return {
      validation: regexMatch[1],
      constraint: `Pattern: ${regexMatch[1]}`,
    };
  }

  /**
   * Extract default value from field type.
   */
  private extractDefaultValue(fieldType: string): string | undefined {
    if (!fieldType.includes("*")) return undefined;

    const defaultMatch = fieldType.match(/\*([^&\s]+)/);
    return defaultMatch ? defaultMatch[1] : undefined;
  }

  private buildFieldFromMatch(
    fieldName: string,
    optional: string,
    fieldType: string,
    comment: string,
  ): CUEStructField {
    const { type, constraints } = this.parseFieldConstraints(fieldType);
    const { validation, constraint: validationConstraint } =
      this.extractValidationPattern(fieldType);
    const defaultValue = this.extractDefaultValue(fieldType);
    const examples = this.extractExamplesFromComment(comment);

    const field: CUEStructField = {
      name: fieldName,
      type,
      optional: optional === "?",
      description: comment.trim() || undefined,
      constraints: validationConstraint ? [...constraints, validationConstraint] : constraints,
      examples: examples.length > 0 ? examples : [],
    };

    if (validation) field.validation = validation;
    if (defaultValue) field.defaultValue = defaultValue;

    return field;
  }

  private parseStructField(
    line: string,
    comment: string,
    _context: CUEContext,
  ): CUEStructField | null {
    const trimmed = line.trim();
    const fieldMatch = trimmed.match(/^(\w+|\[[^\]]+\])(\??):\s*(.+)$/);
    if (!fieldMatch) return null;

    const [, fieldName, optional, fieldType] = fieldMatch;
    return this.buildFieldFromMatch(fieldName, optional, fieldType, comment);
  }

  private isStructType(definition: string, fullLine: string): boolean {
    return (
      fullLine.includes("{") || definition.includes("minFields") || definition.includes("maxFields")
    );
  }

  private isEnumType(definition: string): boolean {
    return definition.includes("|") && definition.includes('"');
  }

  private isUnionType(definition: string): boolean {
    return definition.includes("|");
  }

  private isConstraintType(definition: string): boolean {
    const constraintMarkers = ["=~", "&", ">=", "<="];
    return constraintMarkers.some((marker) => definition.includes(marker));
  }

  private determineComplexTypeKind(
    definition: string,
    fullLine: string,
  ): "struct" | "enum" | "constraint" | "union" | "primitive" {
    if (this.isStructType(definition, fullLine)) return "struct";
    if (this.isEnumType(definition)) return "enum";
    if (this.isUnionType(definition)) return "union";
    if (this.isConstraintType(definition)) return "constraint";
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

  /**
   * Check if a union part is a quoted string value
   */
  private isQuotedStringValue(part: string): boolean {
    return part.startsWith('"') && part.endsWith('"');
  }

  /**
   * Check if a union part is a valid non-reference value
   */
  private isSimpleValue(part: string): boolean {
    return !!part && !part.includes("#") && !part.includes("&");
  }

  /**
   * Check if a union part should be included as a value
   */
  private isValidUnionPart(trimmed: string): boolean {
    return this.isQuotedStringValue(trimmed) || this.isSimpleValue(trimmed);
  }

  private parseUnionValues(definition: string): string[] {
    return definition
      .split("|")
      .map((part) => part.trim())
      .filter((trimmed) => this.isValidUnionPart(trimmed));
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

  /**
   * Determine if we should continue collecting comments
   */
  private shouldContinueCollecting(
    trimmed: string,
    commentsFound: boolean,
  ): "comment" | "skip" | "stop" {
    if (trimmed.startsWith("//")) return "comment";
    if (trimmed === "" && commentsFound) return "skip";
    if (trimmed.startsWith("package ")) return "skip";
    if (trimmed) return "stop";
    return "skip";
  }

  private extractFileDescription(content: string): string | undefined {
    const lines = content.split("\n");
    const comments: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      const action = this.shouldContinueCollecting(trimmed, comments.length > 0);

      if (action === "comment") {
        comments.push(trimmed.substring(2).trim());
      } else if (action === "stop") {
        break;
      }
      // "skip" continues to next iteration
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

  private extractTypeReferences(type: ParsedType): string[] {
    if (!type.fields) return [];
    return type.fields.filter((f) => f.type.startsWith("#")).map((f) => f.type.substring(1));
  }

  private addDependencyIfMissing(type: ParsedType, referencedType: string): void {
    type.dependsOn = type.dependsOn || [];
    if (!type.dependsOn.includes(referencedType)) type.dependsOn.push(referencedType);
  }

  private resolveTypeDependencies(type: ParsedType, _schema: ParsedSchema): void {
    const references = this.extractTypeReferences(type);
    references.forEach((ref) => this.addDependencyIfMissing(type, ref));
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

  private registerUsageRelationship(
    schema: ParsedSchema,
    dependencyName: string,
    usedByName: string,
  ): void {
    const depType = schema.types.get(dependencyName);
    if (!depType) return;
    depType.usedBy = depType.usedBy || [];
    if (!depType.usedBy.includes(usedByName)) depType.usedBy.push(usedByName);
  }

  private buildGlobalRelationships(schema: ParsedSchema): void {
    for (const [typeName, typeInfo] of schema.types) {
      if (!typeInfo.dependsOn) continue;
      typeInfo.dependsOn.forEach((dep) => this.registerUsageRelationship(schema, dep, typeName));
    }
  }
}
