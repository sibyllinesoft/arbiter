/**
 * @packageDocumentation
 * Main MarkdownStorage class for the markdown-first storage system.
 *
 * This class provides CRUD operations for entities stored as markdown files
 * with YAML frontmatter. The filesystem hierarchy represents parent-child
 * relationships naturally.
 */

import path from "node:path";
import { validateCUE } from "@/cue/index.js";
import fs from "fs-extra";
import { v4 as uuidv4 } from "uuid";
import { CueBuilder, buildCueFromGraph } from "./cue-builder.js";
import { GraphLoader, loadEntityGraph } from "./graph-loader.js";
import { createMarkdownFile, generateFrontmatter, parseFrontmatter } from "./markdown.js";
import {
  addRelationship,
  calculateRelativePath,
  removeRelationship,
  serializeRelationships,
} from "./relationship-parser.js";
import { ensureUniqueSlug, slugify } from "./slug.js";
import type {
  CueBuildOptions,
  EntityFrontmatter,
  EntityGraph,
  EntityNode,
  EntityType,
  LoadOptions,
  RelationshipKind,
  RelationshipsMap,
  SaveEntityOptions,
  ValidationError,
  ValidationResult,
  ValidationWarning,
} from "./types.js";

/**
 * MarkdownStorage provides CRUD operations for markdown-based entity storage.
 */
export class MarkdownStorage {
  private baseDir: string;
  private graphLoader: GraphLoader;
  private cueBuilder: CueBuilder;
  private cachedGraph: EntityGraph | null = null;

  constructor(baseDir = ".arbiter") {
    this.baseDir = baseDir;
    this.graphLoader = new GraphLoader(baseDir);
    this.cueBuilder = new CueBuilder();
  }

  /**
   * Load the complete entity graph from the filesystem.
   *
   * @param options - Load options
   * @returns Entity graph
   */
  async load(options: LoadOptions = {}): Promise<EntityGraph> {
    this.cachedGraph = await this.graphLoader.load({
      ...options,
      baseDir: this.baseDir,
    });
    return this.cachedGraph;
  }

  /**
   * Get the cached graph, loading if necessary.
   */
  async getGraph(): Promise<EntityGraph> {
    if (!this.cachedGraph) {
      await this.load();
    }
    return this.cachedGraph!;
  }

  /**
   * Invalidate the cached graph.
   */
  invalidateCache(): void {
    this.cachedGraph = null;
  }

  /**
   * Save an entity to the filesystem.
   *
   * @param entity - Entity data to save
   * @param options - Save options
   * @returns Saved entity node
   */
  async save(
    entity: Partial<EntityNode> & { type: EntityType; name: string },
    options: SaveEntityOptions = {},
  ): Promise<EntityNode> {
    const now = new Date().toISOString();

    // Generate or use existing entity ID
    const entityId = entity.entityId ?? uuidv4();

    // Build frontmatter
    const frontmatter: EntityFrontmatter = {
      type: entity.type,
      entityId,
      createdAt: entity.frontmatter?.createdAt ?? now,
      updatedAt: now,
      ...entity.frontmatter,
    };

    // Determine file path
    const filePath = await this.determineFilePath(entity, options);

    // Build markdown content
    const body = entity.body ?? "";
    const content = this.buildMarkdownContent(entity.name, frontmatter, body);

    // Ensure directory exists
    const fullPath = path.join(this.baseDir, filePath);
    await fs.ensureDir(path.dirname(fullPath));

    // Write file
    await fs.writeFile(fullPath, content, "utf-8");

    // Invalidate cache
    this.invalidateCache();

    // Return the saved node
    return {
      entityId,
      type: entity.type,
      name: entity.name,
      filePath,
      isContainer: options.asContainer ?? false,
      frontmatter,
      body,
      childIds: entity.childIds ?? [],
      relationships: entity.relationships ?? {},
    };
  }

  /**
   * Update an existing entity.
   *
   * @param entityId - ID of the entity to update
   * @param updates - Fields to update
   * @returns Updated entity node
   */
  async update(
    entityId: string,
    updates: Partial<Omit<EntityNode, "entityId">>,
  ): Promise<EntityNode | null> {
    const graph = await this.getGraph();
    const existing = graph.nodes.get(entityId);

    if (!existing) {
      return null;
    }

    // Merge updates
    const updated: EntityNode = {
      ...existing,
      ...updates,
      frontmatter: {
        ...existing.frontmatter,
        ...updates.frontmatter,
        updatedAt: new Date().toISOString(),
      },
    };

    // Handle name changes (requires file rename)
    if (updates.name && updates.name !== existing.name) {
      await this.rename(entityId, updates.name);
    }

    // Write updated content
    const content = this.buildMarkdownContent(updated.name, updated.frontmatter, updated.body);

    const fullPath = path.join(this.baseDir, updated.filePath);
    await fs.writeFile(fullPath, content, "utf-8");

    // Invalidate cache
    this.invalidateCache();

    return updated;
  }

  /**
   * Delete an entity from the filesystem.
   *
   * @param entityIdOrPath - Entity ID or file path
   * @returns True if deleted
   */
  async delete(entityIdOrPath: string): Promise<boolean> {
    const graph = await this.getGraph();

    // Find entity
    let entity: EntityNode | undefined;
    if (graph.nodes.has(entityIdOrPath)) {
      entity = graph.nodes.get(entityIdOrPath);
    } else {
      // Try by path
      const entityId = graph.pathIndex.get(entityIdOrPath);
      if (entityId) {
        entity = graph.nodes.get(entityId);
      }
    }

    if (!entity) {
      return false;
    }

    const fullPath = path.join(this.baseDir, entity.filePath);

    if (entity.isContainer) {
      // Delete the directory (and all children)
      const dirPath = path.dirname(fullPath);
      await fs.remove(dirPath);
    } else {
      // Delete just the file
      await fs.remove(fullPath);
    }

    // Invalidate cache
    this.invalidateCache();

    return true;
  }

  /**
   * Rename an entity.
   *
   * @param entityId - Entity ID
   * @param newName - New name
   * @returns Updated entity or null if not found
   */
  async rename(entityId: string, newName: string): Promise<EntityNode | null> {
    const graph = await this.getGraph();
    const entity = graph.nodes.get(entityId);

    if (!entity) {
      return null;
    }

    const oldPath = path.join(this.baseDir, entity.filePath);
    const dir = path.dirname(entity.filePath);
    const newSlug = slugify(newName);

    let newFilePath: string;
    if (entity.isContainer) {
      // Rename directory
      const oldDir = path.dirname(oldPath);
      const parentDir = path.dirname(oldDir);
      const newDir = path.join(parentDir, newSlug);
      newFilePath = path.join(dir === "." ? "" : path.dirname(dir), newSlug, "README.md");
      await fs.rename(oldDir, newDir);
    } else {
      // Rename file
      newFilePath = path.join(dir, `${newSlug}.md`);
      const newFullPath = path.join(this.baseDir, newFilePath);
      await fs.rename(oldPath, newFullPath);
    }

    // Update the entity
    entity.name = newName;
    entity.filePath = newFilePath;
    entity.frontmatter.updatedAt = new Date().toISOString();

    // Write updated content
    const content = this.buildMarkdownContent(entity.name, entity.frontmatter, entity.body);
    await fs.writeFile(path.join(this.baseDir, newFilePath), content, "utf-8");

    // Invalidate cache
    this.invalidateCache();

    return entity;
  }

  /**
   * Get an entity by ID.
   *
   * @param entityId - Entity ID
   * @returns Entity node or undefined
   */
  async get(entityId: string): Promise<EntityNode | undefined> {
    const graph = await this.getGraph();
    return graph.nodes.get(entityId);
  }

  /**
   * Get an entity by file path.
   *
   * @param filePath - File path relative to .arbiter
   * @returns Entity node or undefined
   */
  async getByPath(filePath: string): Promise<EntityNode | undefined> {
    const graph = await this.getGraph();
    const entityId = graph.pathIndex.get(filePath);
    return entityId ? graph.nodes.get(entityId) : undefined;
  }

  /**
   * List entities, optionally filtered by type.
   *
   * @param types - Entity types to filter by
   * @returns Array of entity nodes
   */
  async list(types?: EntityType[]): Promise<EntityNode[]> {
    const graph = await this.getGraph();
    const nodes = Array.from(graph.nodes.values());

    if (types && types.length > 0) {
      return nodes.filter((n) => types.includes(n.type));
    }

    return nodes;
  }

  /**
   * Find entities matching a predicate.
   *
   * @param predicate - Filter function
   * @returns Matching entity nodes
   */
  async find(predicate: (node: EntityNode) => boolean): Promise<EntityNode[]> {
    const graph = await this.getGraph();
    return Array.from(graph.nodes.values()).filter(predicate);
  }

  /**
   * Add a relationship between two entities.
   *
   * @param fromId - Source entity ID
   * @param toId - Target entity ID
   * @param kind - Relationship kind
   * @param label - Optional display label
   */
  async addRelationship(
    fromId: string,
    toId: string,
    kind: RelationshipKind,
    label?: string,
  ): Promise<void> {
    const graph = await this.getGraph();
    const fromEntity = graph.nodes.get(fromId);
    const toEntity = graph.nodes.get(toId);

    if (!fromEntity || !toEntity) {
      throw new Error("Source or target entity not found");
    }

    // Calculate relative path from source to target
    const relativePath = calculateRelativePath(fromEntity.filePath, toEntity.filePath);

    // Update frontmatter relationships
    const relationships = fromEntity.frontmatter.relationships ?? {};
    fromEntity.frontmatter.relationships = addRelationship(
      relationships,
      kind,
      label ?? toEntity.name,
      relativePath,
    );

    // Save the updated entity
    await this.update(fromId, { frontmatter: fromEntity.frontmatter });
  }

  /**
   * Remove a relationship between two entities.
   *
   * @param fromId - Source entity ID
   * @param toId - Target entity ID
   * @param kind - Relationship kind
   */
  async removeRelationship(fromId: string, toId: string, kind: RelationshipKind): Promise<void> {
    const graph = await this.getGraph();
    const fromEntity = graph.nodes.get(fromId);
    const toEntity = graph.nodes.get(toId);

    if (!fromEntity || !toEntity) {
      throw new Error("Source or target entity not found");
    }

    // Calculate relative path
    const relativePath = calculateRelativePath(fromEntity.filePath, toEntity.filePath);

    // Update frontmatter relationships
    const relationships = fromEntity.frontmatter.relationships ?? {};
    fromEntity.frontmatter.relationships = removeRelationship(relationships, kind, relativePath);

    // Save the updated entity
    await this.update(fromId, { frontmatter: fromEntity.frontmatter });
  }

  /**
   * Validate the entity graph via CUE.
   *
   * @returns Validation result
   */
  async validate(): Promise<ValidationResult> {
    const graph = await this.getGraph();
    const cue = this.cueBuilder.build(graph);

    const result = await validateCUE(cue);

    if (result.valid) {
      return {
        valid: true,
        errors: [],
        warnings: [],
      };
    }

    // Map CUE errors back to source files
    const errors: ValidationError[] = result.errors.map((msg) => ({
      entityId: "",
      filePath: "",
      message: msg,
    }));

    return {
      valid: false,
      errors,
      warnings: [],
    };
  }

  /**
   * Export the entity graph as CUE.
   *
   * @param options - Build options
   * @returns CUE string
   */
  async toCue(options?: CueBuildOptions): Promise<string> {
    const graph = await this.getGraph();
    const builder = new CueBuilder(options);
    return builder.build(graph);
  }

  /**
   * Initialize the storage directory with a root project entity.
   *
   * @param projectName - Name of the project
   * @returns Root entity node
   */
  async initialize(projectName: string): Promise<EntityNode> {
    // Create base directory
    await fs.ensureDir(this.baseDir);

    // Create root README.md
    const rootEntity = await this.save(
      {
        type: "project",
        name: projectName,
        body: `Welcome to the ${projectName} specification.\n\nThis directory contains the project architecture defined as markdown files.`,
        frontmatter: {
          type: "project",
          entityId: uuidv4(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { asContainer: false },
    );

    return rootEntity;
  }

  /**
   * Check if storage is initialized.
   *
   * @returns True if .arbiter directory exists with README.md
   */
  async isInitialized(): Promise<boolean> {
    const readmePath = path.join(this.baseDir, "README.md");
    return fs.pathExists(readmePath);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Determine the file path for an entity.
   */
  private async determineFilePath(
    entity: Partial<EntityNode> & { type: EntityType; name: string },
    options: SaveEntityOptions,
  ): Promise<string> {
    const slug = slugify(entity.name);

    if (options.parentPath) {
      // Nested under parent
      if (options.asContainer) {
        return path.join(options.parentPath, slug, "README.md");
      }
      return path.join(options.parentPath, `${slug}.md`);
    }

    // Root level
    if (entity.type === "project") {
      return "README.md";
    }

    if (options.asContainer) {
      return path.join(slug, "README.md");
    }

    // Ensure unique slug at root level
    const existing = await this.getExistingRootSlugs();
    const uniqueSlug = ensureUniqueSlug(slug, existing);
    return `${uniqueSlug}.md`;
  }

  /**
   * Get existing slugs at root level for uniqueness check.
   */
  private async getExistingRootSlugs(): Promise<Set<string>> {
    const slugs = new Set<string>();

    if (!(await fs.pathExists(this.baseDir))) {
      return slugs;
    }

    const entries = await fs.readdir(this.baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        slugs.add(entry.name.replace(/\.md$/, ""));
      } else if (entry.isDirectory()) {
        slugs.add(entry.name);
      }
    }

    return slugs;
  }

  /**
   * Build markdown content from entity data.
   */
  private buildMarkdownContent(name: string, frontmatter: EntityFrontmatter, body: string): string {
    // Prepare frontmatter for serialization
    const fmForYaml: Record<string, unknown> = { ...frontmatter };

    // Serialize relationships to raw format
    if (frontmatter.relationships) {
      fmForYaml.relationships = frontmatter.relationships;
    }

    // Build markdown with H1 heading
    const heading = `# ${name}`;
    const fullBody = body ? `${heading}\n\n${body}` : heading;

    return createMarkdownFile(fmForYaml, fullBody);
  }
}

/**
 * Create a new MarkdownStorage instance.
 *
 * @param baseDir - Base directory (defaults to .arbiter)
 * @returns MarkdownStorage instance
 */
export function createMarkdownStorage(baseDir?: string): MarkdownStorage {
  return new MarkdownStorage(baseDir);
}
