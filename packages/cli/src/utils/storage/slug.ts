/**
 * @packageDocumentation
 * Utility functions for generating URL-safe slugs from text.
 */

/**
 * Convert text to a URL-safe slug.
 * - Lowercases the string
 * - Replaces non-alphanumeric characters with hyphens
 * - Removes leading/trailing hyphens
 * - Collapses multiple hyphens
 * - Truncates to max 100 characters
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .substring(0, 100);
}

/**
 * Ensure a slug is unique within a set of existing slugs.
 * Appends -2, -3, etc. if needed.
 */
export function ensureUniqueSlug(slug: string, existing: Set<string>): string {
  if (!existing.has(slug)) return slug;
  let i = 2;
  while (existing.has(`${slug}-${i}`)) i++;
  return `${slug}-${i}`;
}
