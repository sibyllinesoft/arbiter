/**
 * @packageDocumentation
 * Utilities for generating and parsing YAML frontmatter in markdown files.
 */

import YAML from "yaml";

/**
 * Generate YAML frontmatter from a metadata object.
 * Filters out undefined values and empty arrays.
 */
export function generateFrontmatter(metadata: Record<string, unknown>): string {
  // Filter out undefined values and empty arrays
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    cleaned[key] = value;
  }

  const yaml = YAML.stringify(cleaned, {
    lineWidth: 0, // Don't wrap lines
    defaultKeyType: "PLAIN",
    defaultStringType: "QUOTE_DOUBLE",
  }).trim();

  return `---\n${yaml}\n---`;
}

/**
 * Parse a markdown file with YAML frontmatter.
 * Returns the parsed frontmatter object and the body content.
 */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return {
      frontmatter: {},
      body: content.trim(),
    };
  }

  const [, yamlContent, body] = match;

  try {
    const frontmatter = YAML.parse(yamlContent) || {};
    return {
      frontmatter,
      body: body.trim(),
    };
  } catch {
    return {
      frontmatter: {},
      body: content.trim(),
    };
  }
}

/**
 * Create a complete markdown file with frontmatter and body.
 */
export function createMarkdownFile(metadata: Record<string, unknown>, body: string): string {
  const frontmatter = generateFrontmatter(metadata);
  const trimmedBody = body.trim();

  if (trimmedBody) {
    return `${frontmatter}\n\n${trimmedBody}\n`;
  }
  return `${frontmatter}\n`;
}
