/**
 * @packageDocumentation
 * Parser for markdown link relationships in YAML frontmatter.
 *
 * Relationships are expressed as markdown links in the frontmatter:
 * ```yaml
 * relationships:
 *   depends_on:
 *     - "[Postgres](../database.md)"
 *     - "[Redis](../../shared/redis.md)"
 * ```
 */

import path from "node:path";
import type {
  MarkdownLink,
  ParsedRelationshipsMap,
  RelationshipEdge,
  RelationshipKind,
  RelationshipsMap,
} from "./types.js";

/**
 * Regex to match markdown links: [Label](path.md)
 * Captures: 1=label, 2=path
 */
const MARKDOWN_LINK_REGEX = /^\[([^\]]+)\]\(([^)]+\.md)\)$/;

/**
 * Common relationship kinds with semantic meaning.
 * These are validated when building CUE output.
 */
export const KNOWN_RELATIONSHIP_KINDS: RelationshipKind[] = [
  "depends_on",
  "implements",
  "calls",
  "reads",
  "writes",
  "blocks",
  "blocked_by",
  "duplicates",
  "related_to",
  "deployed_as",
  "authenticates",
  "notifies",
];

/**
 * Parse a markdown link string into its components.
 *
 * @param linkStr - The markdown link string, e.g., "[Label](path/to/file.md)"
 * @returns Parsed link or null if invalid
 *
 * @example
 * parseMarkdownLink("[Postgres](../database.md)")
 * // { label: "Postgres", path: "../database.md" }
 */
export function parseMarkdownLink(linkStr: string): MarkdownLink | null {
  const trimmed = linkStr.trim();
  const match = trimmed.match(MARKDOWN_LINK_REGEX);

  if (!match) {
    return null;
  }

  const [, label, linkPath] = match;
  return {
    label,
    path: linkPath,
  };
}

/**
 * Create a markdown link string from components.
 *
 * @param label - Display label for the link
 * @param targetPath - Relative path to the target file
 * @returns Formatted markdown link string
 */
export function createMarkdownLink(label: string, targetPath: string): string {
  return `[${label}](${targetPath})`;
}

/**
 * Parse all relationships from a frontmatter relationships map.
 *
 * @param relationships - Raw relationships map from frontmatter
 * @returns Parsed relationships with extracted link components
 */
export function parseRelationships(
  relationships: RelationshipsMap | undefined,
): ParsedRelationshipsMap {
  if (!relationships) {
    return {};
  }

  const parsed: ParsedRelationshipsMap = {};

  for (const [kind, links] of Object.entries(relationships)) {
    if (!Array.isArray(links)) {
      continue;
    }

    const parsedLinks: MarkdownLink[] = [];
    for (const linkStr of links) {
      const link = parseMarkdownLink(linkStr);
      if (link) {
        parsedLinks.push(link);
      }
    }

    if (parsedLinks.length > 0) {
      parsed[kind as RelationshipKind] = parsedLinks;
    }
  }

  return parsed;
}

/**
 * Resolve relative link paths to entity IDs using a path-to-ID index.
 *
 * @param relationships - Parsed relationships with relative paths
 * @param sourceFilePath - Path of the source entity file (relative to .arbiter)
 * @param pathIndex - Map from file paths to entity IDs
 * @returns Relationships with resolved entity IDs
 */
export function resolveRelationshipPaths(
  relationships: ParsedRelationshipsMap,
  sourceFilePath: string,
  pathIndex: Map<string, string>,
): ParsedRelationshipsMap {
  const resolved: ParsedRelationshipsMap = {};
  const sourceDir = path.dirname(sourceFilePath);

  for (const [kind, links] of Object.entries(relationships)) {
    if (!links) continue;

    const resolvedLinks: MarkdownLink[] = [];
    for (const link of links) {
      // Resolve relative path from source file location
      const absolutePath = path.normalize(path.join(sourceDir, link.path));
      const entityId = pathIndex.get(absolutePath);

      resolvedLinks.push({
        ...link,
        entityId,
      });
    }

    resolved[kind as RelationshipKind] = resolvedLinks;
  }

  return resolved;
}

/**
 * Build relationship edges from an entity's resolved relationships.
 *
 * @param sourceEntityId - ID of the source entity
 * @param relationships - Resolved relationships with entity IDs
 * @returns Array of relationship edges
 */
export function buildRelationshipEdges(
  sourceEntityId: string,
  relationships: ParsedRelationshipsMap,
): RelationshipEdge[] {
  const edges: RelationshipEdge[] = [];

  for (const [kind, links] of Object.entries(relationships)) {
    if (!links) continue;

    for (const link of links) {
      if (link.entityId) {
        edges.push({
          from: sourceEntityId,
          to: link.entityId,
          kind: kind as RelationshipKind,
          label: link.label,
        });
      }
    }
  }

  return edges;
}

/**
 * Convert parsed relationships back to raw frontmatter format.
 *
 * @param relationships - Parsed relationships
 * @returns Raw relationships map for YAML serialization
 */
export function serializeRelationships(relationships: ParsedRelationshipsMap): RelationshipsMap {
  const serialized: RelationshipsMap = {};

  for (const [kind, links] of Object.entries(relationships)) {
    if (!links || links.length === 0) continue;

    serialized[kind as RelationshipKind] = links.map((link) =>
      createMarkdownLink(link.label, link.path),
    );
  }

  return serialized;
}

/**
 * Calculate the relative path from one entity to another.
 *
 * @param fromPath - Source entity file path (relative to .arbiter)
 * @param toPath - Target entity file path (relative to .arbiter)
 * @returns Relative path from source to target
 */
export function calculateRelativePath(fromPath: string, toPath: string): string {
  const fromDir = path.dirname(fromPath);
  return path.relative(fromDir, toPath);
}

/**
 * Validate a relationship kind.
 * Returns true for known kinds, but also accepts custom kinds.
 *
 * @param kind - Relationship kind to validate
 * @returns True if valid (all non-empty strings are valid)
 */
export function isValidRelationshipKind(kind: string): kind is RelationshipKind {
  return typeof kind === "string" && kind.length > 0;
}

/**
 * Check if a relationship kind is a known/standard kind.
 *
 * @param kind - Relationship kind to check
 * @returns True if it's a standard relationship kind
 */
export function isKnownRelationshipKind(kind: string): boolean {
  return KNOWN_RELATIONSHIP_KINDS.includes(kind as RelationshipKind);
}

/**
 * Get the inverse relationship kind for bidirectional relationships.
 *
 * @param kind - Original relationship kind
 * @returns Inverse kind or undefined if no inverse exists
 */
export function getInverseRelationshipKind(kind: RelationshipKind): RelationshipKind | undefined {
  const inverses: Partial<Record<RelationshipKind, RelationshipKind>> = {
    depends_on: "depended_by",
    blocks: "blocked_by",
    blocked_by: "blocks",
    implements: "implemented_by",
    calls: "called_by",
    reads: "read_by",
    writes: "written_by",
    authenticates: "authenticated_by",
    notifies: "notified_by",
  };

  return inverses[kind];
}

/**
 * Add a relationship to an existing relationships map.
 *
 * @param relationships - Existing relationships map
 * @param kind - Relationship kind
 * @param label - Display label for the link
 * @param targetPath - Relative path to the target
 * @returns Updated relationships map
 */
export function addRelationship(
  relationships: RelationshipsMap,
  kind: RelationshipKind,
  label: string,
  targetPath: string,
): RelationshipsMap {
  const link = createMarkdownLink(label, targetPath);
  const existing = relationships[kind] ?? [];

  // Check for duplicates
  if (existing.includes(link)) {
    return relationships;
  }

  return {
    ...relationships,
    [kind]: [...existing, link],
  };
}

/**
 * Remove a relationship from an existing relationships map.
 *
 * @param relationships - Existing relationships map
 * @param kind - Relationship kind
 * @param targetPath - Relative path to the target to remove
 * @returns Updated relationships map
 */
export function removeRelationship(
  relationships: RelationshipsMap,
  kind: RelationshipKind,
  targetPath: string,
): RelationshipsMap {
  const existing = relationships[kind];
  if (!existing) {
    return relationships;
  }

  const filtered = existing.filter((linkStr) => {
    const link = parseMarkdownLink(linkStr);
    return link?.path !== targetPath;
  });

  if (filtered.length === 0) {
    const { [kind]: _removed, ...rest } = relationships;
    return rest;
  }

  return {
    ...relationships,
    [kind]: filtered,
  };
}
