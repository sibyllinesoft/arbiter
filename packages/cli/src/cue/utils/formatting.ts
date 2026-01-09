/**
 * @packageDocumentation
 * CUE formatting utilities for object-to-CUE conversion.
 *
 * Provides functionality to:
 * - Format JavaScript objects as CUE syntax
 * - Handle strings, arrays, and records
 * - Build section merges and indent blocks
 */

/**
 * Format a JavaScript object as CUE syntax
 */
export function formatCueObject(obj: unknown, indent = ""): string {
  if (typeof obj === "string") return formatCueString(obj);
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);
  if (Array.isArray(obj)) return formatCueArray(obj, indent);
  if (typeof obj === "object" && obj !== null)
    return formatCueRecord(obj as Record<string, unknown>, indent);
  return String(obj);
}

export function formatCueString(str: string): string {
  return `"${str.replace(/"/g, '\\"')}"`;
}

export function formatCueArray(arr: unknown[], indent: string): string {
  if (arr.length === 0) return "[]";
  const items = arr.map((item) => `${indent}\t${formatCueObject(item, `${indent}\t`)}`);
  return `[\n${items.join(",\n")}\n${indent}]`;
}

export function formatCueRecord(obj: Record<string, unknown>, indent: string): string {
  const entries = Object.entries(obj);
  if (entries.length === 0) return "{}";
  const formattedEntries = entries.map(([k, v]) => {
    const key = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : `"${k}"`;
    return `${indent}\t${key}: ${formatCueObject(v, `${indent}\t`)}`;
  });
  return `{\n${formattedEntries.join("\n")}\n${indent}}`;
}

/**
 * Indent a block of text by a given number of spaces
 */
export function indentBlock(text: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((line) => (line.trim().length === 0 ? "" : `${pad}${line}`))
    .join("\n");
}

/**
 * Build a section merge fragment for append-only operations
 */
export function buildSectionMerge(parts: string[], key: string, valueCue: string): string {
  let block = `${key}: ${valueCue}`;
  for (let i = parts.length - 1; i >= 0; i--) {
    const name = parts[i];
    block = `${name}: ${name} & {\n${indentBlock(block, 2)}\n}`;
  }
  return block;
}
