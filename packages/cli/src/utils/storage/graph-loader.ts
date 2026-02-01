/**
 * @packageDocumentation
 * Graph loader for the markdown-first storage system.
 *
 * Walks the .arbiter directory and builds an EntityGraph from markdown files.
 * Directory structure represents parent-child relationships naturally.
 */

import path from "node:path";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";
import { parseFrontmatter } from "./markdown.js";
import {
  buildRelationshipEdges,
  parseRelationships,
  resolveRelationshipPaths,
} from "./relationship-parser.js";
import type {
  EntityFrontmatter,
  EntityGraph,
  EntityNode,
  EntityType,
  LoadOptions,
  RelationshipEdge,
} from "./types.js";

/**
 * Default entity type when none is specified in frontmatter.
 */
const DEFAULT_ENTITY_TYPE: EntityType = "note";

/**
 * Entity types that are typically containers (have children).
 */
const CONTAINER_TYPES: EntityType[] = ["project", "system", "service", "group"];

/**
 * GraphLoader walks the .arbiter directory and builds an EntityGraph.
 */
export class GraphLoader {
  private baseDir: string;

  constructor(baseDir = ".arbiter") {
    this.baseDir = baseDir;
  }

  /**
   * Load the complete entity graph from the filesystem.
   *
   * @param options - Load options
   * @returns Complete entity graph
   */
  async load(options: LoadOptions = {}): Promise<EntityGraph> {
    const effectiveBaseDir = options.baseDir ?? this.baseDir;

    // Check if .arbiter directory exists
    if (!(await fs.pathExists(effectiveBaseDir))) {
      return {
        nodes: new Map(),
        edges: [],
        pathIndex: new Map(),
      };
    }

    // Walk directory and collect all entities
    const nodes = await this.walkDirectory(effectiveBaseDir);

    // Filter by types if specified
    const filteredNodes = options.types
      ? nodes.filter((node) => options.types!.includes(node.type))
      : nodes;

    // Build path index
    const pathIndex = new Map<string, string>();
    for (const node of filteredNodes) {
      pathIndex.set(node.filePath, node.entityId);
    }

    // Build nodes map
    const nodesMap = new Map<string, EntityNode>();
    for (const node of filteredNodes) {
      nodesMap.set(node.entityId, node);
    }

    // Resolve parent-child relationships from filesystem hierarchy
    this.resolveHierarchy(filteredNodes, pathIndex);

    // Resolve explicit relationships unless skipped
    const edges: RelationshipEdge[] = [];
    if (!options.skipRelationships) {
      for (const node of filteredNodes) {
        node.relationships = resolveRelationshipPaths(node.relationships, node.filePath, pathIndex);
        edges.push(...buildRelationshipEdges(node.entityId, node.relationships));
      }
    }

    // Find root node (README.md at base level)
    const rootNode = filteredNodes.find((n) => n.filePath === "README.md" && n.type === "project");

    return {
      nodes: nodesMap,
      edges,
      rootId: rootNode?.entityId,
      pathIndex,
    };
  }

  /**
   * Walk a directory recursively and collect all entity nodes.
   *
   * @param dir - Directory to walk
   * @param relativePath - Current relative path from base
   * @returns Array of entity nodes
   */
  async walkDirectory(dir: string, relativePath = ""): Promise<EntityNode[]> {
    const nodes: EntityNode[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    // Check for README.md at current level (root or subdirectory)
    const rootReadmePath = path.join(dir, "README.md");
    if (relativePath === "" && (await fs.pathExists(rootReadmePath))) {
      // Root README.md is the project entity
      const content = await fs.readFile(rootReadmePath, "utf-8");
      const dirName = path.basename(dir);
      const node = this.parseEntity("README.md", content, true, dirName);
      nodes.push(node);
    }

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      if (entry.isDirectory()) {
        // Check for README.md to determine if this is a container entity
        const readmePath = path.join(entryPath, "README.md");
        if (await fs.pathExists(readmePath)) {
          // This is a container entity
          const content = await fs.readFile(readmePath, "utf-8");
          const node = this.parseEntity(
            path.join(entryRelativePath, "README.md"),
            content,
            true,
            entry.name,
          );
          nodes.push(node);
        }

        // Recursively walk subdirectory
        const childNodes = await this.walkDirectory(entryPath, entryRelativePath);
        nodes.push(...childNodes);
      } else if (entry.isFile() && entry.name.endsWith(".md") && entry.name !== "README.md") {
        // This is a leaf entity
        const content = await fs.readFile(entryPath, "utf-8");
        const baseName = entry.name.replace(/\.md$/, "");
        const node = this.parseEntity(entryRelativePath, content, false, baseName);
        nodes.push(node);
      }
    }

    return nodes;
  }

  /**
   * Parse an entity from a markdown file.
   *
   * @param filePath - Relative path to the file
   * @param content - File content
   * @param isContainer - Whether this is a container entity
   * @param defaultName - Default name if not found in content
   * @returns Parsed entity node
   */
  parseEntity(
    filePath: string,
    content: string,
    isContainer: boolean,
    defaultName: string,
  ): EntityNode {
    const { frontmatter, body } = parseFrontmatter(content);

    // Extract name from H1 heading or use default
    const name = this.extractName(body) ?? defaultName;

    // Get or generate entity ID
    const entityId = (frontmatter.entityId as string) ?? uuidv4();

    // Determine entity type
    const type = this.determineType(frontmatter, isContainer);

    // Parse relationships
    const relationships = parseRelationships(
      frontmatter.relationships as Record<string, string[]> | undefined,
    );

    // Build frontmatter with required fields
    const normalizedFrontmatter: EntityFrontmatter = {
      type,
      entityId,
      createdAt: (frontmatter.createdAt as string) ?? new Date().toISOString(),
      updatedAt: (frontmatter.updatedAt as string) ?? new Date().toISOString(),
      ...frontmatter,
    };

    return {
      entityId,
      type,
      name,
      filePath,
      isContainer,
      frontmatter: normalizedFrontmatter,
      body: this.extractBody(body),
      childIds: [],
      relationships,
    };
  }

  /**
   * Extract the entity name from markdown body.
   * Looks for H1 heading: # Name
   *
   * @param body - Markdown body content
   * @returns Extracted name or undefined
   */
  private extractName(body: string): string | undefined {
    const h1Match = body.match(/^#\s+(.+?)(?:\r?\n|$)/m);
    return h1Match?.[1]?.trim();
  }

  /**
   * Extract the body content after the H1 heading.
   *
   * @param body - Full markdown body
   * @returns Body without H1 heading
   */
  private extractBody(body: string): string {
    // Remove H1 heading if present
    return body.replace(/^#\s+.+?\r?\n?/, "").trim();
  }

  /**
   * Determine entity type from frontmatter or context.
   *
   * @param frontmatter - Parsed frontmatter
   * @param isContainer - Whether this is a container entity
   * @returns Entity type
   */
  private determineType(frontmatter: Record<string, unknown>, isContainer: boolean): EntityType {
    // Explicit type in frontmatter takes precedence
    if (frontmatter.type && typeof frontmatter.type === "string") {
      return frontmatter.type as EntityType;
    }

    // Infer from container status and other fields
    if (isContainer) {
      // Check for specific fields that indicate type
      if (frontmatter.language || frontmatter.port || frontmatter.framework) {
        return "service";
      }
      if (frontmatter.kind === "milestone" || frontmatter.kind === "epic") {
        return "group";
      }
      return "system";
    }

    // Leaf entity type inference
    if (frontmatter.path && frontmatter.methods) {
      return "endpoint";
    }
    if (
      frontmatter.kind &&
      ["database", "cache", "queue", "storage"].includes(frontmatter.kind as string)
    ) {
      return "resource";
    }
    if (
      frontmatter.status &&
      ["open", "in_progress", "done", "closed"].includes(frontmatter.status as string)
    ) {
      return "task";
    }

    return DEFAULT_ENTITY_TYPE;
  }

  /**
   * Resolve parent-child relationships from filesystem hierarchy.
   *
   * @param nodes - All entity nodes
   * @param pathIndex - Map from file paths to entity IDs
   */
  private resolveHierarchy(nodes: EntityNode[], pathIndex: Map<string, string>): void {
    for (const node of nodes) {
      // Find parent by looking at directory structure
      const parentPath = this.findParentPath(node.filePath);
      if (parentPath) {
        const parentId = pathIndex.get(parentPath);
        if (parentId) {
          node.parentId = parentId;
          // Add to parent's children
          const parentNode = nodes.find((n) => n.entityId === parentId);
          if (parentNode && !parentNode.childIds.includes(node.entityId)) {
            parentNode.childIds.push(node.entityId);
          }
        }
      }
    }
  }

  /**
   * Find the parent entity path for a given file path.
   *
   * @param filePath - Entity file path
   * @returns Parent entity path or undefined
   */
  private findParentPath(filePath: string): string | undefined {
    const dir = path.dirname(filePath);

    if (dir === "." || dir === "") {
      // Root level, no parent
      return undefined;
    }

    // For README.md, parent is the parent directory's README.md
    if (path.basename(filePath) === "README.md") {
      const parentDir = path.dirname(dir);
      if (parentDir === "." || parentDir === "") {
        return "README.md"; // Parent is root
      }
      return path.join(parentDir, "README.md");
    }

    // For leaf files, parent is the directory's README.md
    return path.join(dir, "README.md");
  }
}

/**
 * Create a new graph loader instance.
 *
 * @param baseDir - Base directory (defaults to .arbiter)
 * @returns GraphLoader instance
 */
export function createGraphLoader(baseDir?: string): GraphLoader {
  return new GraphLoader(baseDir);
}

/**
 * Quick helper to load the entity graph.
 *
 * @param options - Load options
 * @returns Entity graph
 */
export async function loadEntityGraph(options?: LoadOptions): Promise<EntityGraph> {
  const loader = new GraphLoader(options?.baseDir);
  return loader.load(options);
}
