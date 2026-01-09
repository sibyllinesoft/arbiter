/**
 * @packageDocumentation
 * Shared utilities for the add command module.
 *
 * Provides common helper functions:
 * - String transformation utilities
 * - Tag parsing from comma-separated input
 */

/**
 * Convert a string to title case.
 * @param str - Input string
 * @returns Title cased string
 */
export function toTitleCase(str: string): string {
  return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
}

/**
 * Parse comma-separated tags into an array.
 * @param input - Comma-separated tag string
 * @returns Array of tags or undefined if empty
 */
export function parseTags(input?: string): string[] | undefined {
  if (!input) return undefined;
  const tags = input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}
