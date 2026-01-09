/**
 * @packageDocumentation
 * CUE parsing utilities for schema diff analysis.
 *
 * Provides functionality to:
 * - Parse CUE files into structural representations
 * - Extract package declarations, imports, fields, and constraints
 * - Handle multi-line comments and brace nesting
 */

import path from "node:path";

/** CUE parser state for tracking parsing context */
export interface CueParserState {
  currentPath: string[];
  inMultiLineComment: boolean;
  braceDepth: number;
  structure: Map<string, string>;
}

/**
 * Create initial parser state.
 */
export function createParserState(): CueParserState {
  return { currentPath: [], inMultiLineComment: false, braceDepth: 0, structure: new Map() };
}

/**
 * Check if line should be skipped (empty, comment).
 */
export function isSkippableLine(trimmed: string, state: CueParserState): boolean {
  if (!trimmed) return true;
  if (trimmed.includes("/*")) {
    state.inMultiLineComment = true;
    return true;
  }
  if (trimmed.includes("*/")) {
    state.inMultiLineComment = false;
    return true;
  }
  if (state.inMultiLineComment || trimmed.startsWith("//")) return true;
  return false;
}

/**
 * Parse package declaration.
 */
export function parsePackageDeclaration(trimmed: string, state: CueParserState): boolean {
  if (!trimmed.startsWith("package ")) return false;
  state.structure.set("package", trimmed.replace("package ", ""));
  return true;
}

/**
 * Parse import statement.
 */
export function parseImportStatement(trimmed: string, state: CueParserState): boolean {
  if (!trimmed.startsWith("import ")) return false;
  const importMatch = trimmed.match(/import\s+(?:(\w+)\s+)?"([^"]+)"/);
  if (importMatch) {
    const importPath = importMatch[2];
    const importAlias = importMatch[1] || path.basename(importPath);
    state.structure.set(`import.${importAlias}`, importPath);
  }
  return true;
}

/**
 * Build full path from current path and field name.
 */
export function buildFullPath(currentPath: string[], fieldName: string): string {
  return currentPath.length > 0 ? `${currentPath.join(".")}.${fieldName}` : fieldName;
}

/**
 * Parse field definition.
 */
export function parseFieldDefinition(trimmed: string, state: CueParserState): boolean {
  const fieldMatch = trimmed.match(/^(\w+):\s*(.+)$/);
  if (!fieldMatch) return false;
  const [, fieldName, fieldValue] = fieldMatch;
  state.structure.set(buildFullPath(state.currentPath, fieldName), fieldValue);
  return true;
}

/**
 * Parse constraint definition.
 */
export function parseConstraintDefinition(trimmed: string, state: CueParserState): boolean {
  const constraintMatch = trimmed.match(/^#(\w+):\s*\{?(.*)$/);
  if (!constraintMatch) return false;
  const [, constraintName, constraintValue] = constraintMatch;
  const key = `constraint.${constraintName}`;
  state.structure.set(key, constraintValue);
  if (trimmed.endsWith("{")) {
    state.currentPath.push(key);
    state.braceDepth++;
  }
  return true;
}

/**
 * Count opening and closing braces in a line.
 */
export function countBraces(line: string): { open: number; close: number } {
  return {
    open: (line.match(/\{/g) || []).length,
    close: (line.match(/\}/g) || []).length,
  };
}

/**
 * Handle brace nesting for path tracking.
 */
export function handleBraceNesting(line: string, trimmed: string, state: CueParserState): void {
  const { open, close } = countBraces(line);
  state.braceDepth += open - close;

  if (close > 0) {
    for (let j = 0; j < close && state.currentPath.length > 0; j++) {
      state.currentPath.pop();
    }
  }

  if (open > close) {
    const fieldName = trimmed.replace(/\s*\{.*$/, "").replace(/:.*$/, "");
    if (fieldName && fieldName !== trimmed) {
      state.currentPath.push(buildFullPath(state.currentPath, fieldName));
    }
  }
}

/**
 * Parse a single CUE line.
 */
export function parseCueLine(line: string, state: CueParserState): void {
  const trimmed = line.trim();
  if (isSkippableLine(trimmed, state)) return;
  if (parsePackageDeclaration(trimmed, state)) return;
  if (parseImportStatement(trimmed, state)) return;
  if (parseFieldDefinition(trimmed, state)) return;
  if (parseConstraintDefinition(trimmed, state)) return;
  handleBraceNesting(line, trimmed, state);
}
