/**
 * @packageDocumentation
 * Section manipulation utilities for CUE AST operations.
 *
 * Provides functionality to:
 * - Traverse to sections within AST
 * - Append removal markers for sections
 * - Clean up empty containers after removal
 */

import { cleanupEmptyContainers } from "./removal-utils.js";

/**
 * Result of traversing to a section.
 */
export interface TraverseResult {
  target: Record<string, any>;
  pathStack: string[];
}

/**
 * Result of traversing to parent and key.
 */
export interface ParentKeyResult {
  parent: Record<string, any>;
  key: string;
  segments: string[];
}

/**
 * Traverse AST to a section by dot-separated path.
 */
export function traverseToSection(ast: any, section: string): TraverseResult | null {
  const segments = section.split(".");
  const pathStack: string[] = [];
  let current: any = ast;

  for (const segment of segments) {
    if (!current || typeof current !== "object" || !(segment in current)) {
      return null;
    }
    pathStack.push(segment);
    current = current[segment];
  }

  return { target: current, pathStack };
}

/**
 * Check if a key can be deleted from target.
 */
export function canDeleteKey(target: any, key: string): boolean {
  return target && typeof target === "object" && key in target;
}

/**
 * Clean up container if empty.
 */
export function cleanupIfEmpty(target: any, pathStack: string[], ast: any): void {
  if (typeof target === "object" && target && Object.keys(target).length === 0) {
    cleanupEmptyContainers(pathStack, ast);
  }
}

/**
 * Traverse to parent and get key.
 */
export function traverseToParentAndKey(ast: any, section: string): ParentKeyResult | null {
  const segments = section.split(".");
  let parent: any = ast;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    if (!parent || typeof parent !== "object" || !(segment in parent)) {
      return null;
    }
    parent = parent[segment];
  }

  const key = segments[segments.length - 1];
  if (!parent || (typeof parent === "object") === false) return null;

  return { parent, key, segments };
}

/**
 * Clean up if array is empty.
 */
export function cleanupIfArrayEmpty(
  parent: Record<string, any>,
  key: string,
  segments: string[],
  ast: any,
): void {
  if (Array.isArray(parent[key]) && parent[key].length === 0) {
    cleanupEmptyContainers(segments, ast);
  }
}

/**
 * Append removal marker for a section.
 */
export function appendRemovalMarkerForSection(
  content: string,
  section: string,
  key: string,
): string {
  const marker = [
    "// removal marker (append-only)",
    "removals: removals & {",
    `  sections: [..., { section: "${section}", key: "${key}" }]`,
    "}",
  ].join("\n");
  return `${content.trimEnd()}\n\n${marker}\n`;
}
