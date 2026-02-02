/**
 * @packageDocumentation
 * CUE builder for generating CUE output from an EntityGraph.
 *
 * This module converts the in-memory entity graph back to CUE format
 * for validation against the schema and for export purposes.
 */

import type {
  CueBuildOptions,
  EntityGraph,
  EntityNode,
  EntityType,
  RelationshipEdge,
} from "./types.js";

/**
 * Mapping from entity types to CUE section names.
 */
const TYPE_TO_SECTION: Record<EntityType, string> = {
  project: "metadata",
  system: "systems",
  service: "packages",
  endpoint: "endpoints",
  resource: "resources",
  client: "packages",
  group: "groups",
  task: "issues",
  note: "comments",
  schema: "schemas",
  contract: "contracts",
  flow: "behaviors",
  route: "ui.routes",
  locator: "locators",
};

/**
 * CueBuilder generates CUE output from an EntityGraph.
 */
export class CueBuilder {
  private options: CueBuildOptions;

  constructor(options: CueBuildOptions = {}) {
    this.options = {
      includeSourceComments: true,
      packageName: "spec",
      format: true,
      ...options,
    };
  }

  /**
   * Build complete CUE output from an entity graph.
   *
   * @param graph - The entity graph to convert
   * @returns CUE string
   */
  build(graph: EntityGraph): string {
    const sections: Map<string, string[]> = new Map();

    // Group entities by CUE section
    for (const node of graph.nodes.values()) {
      const section = TYPE_TO_SECTION[node.type] || "metadata";
      if (!sections.has(section)) {
        sections.set(section, []);
      }
      sections.get(section)!.push(this.buildEntity(node, graph));
    }

    // Build relationships section
    if (graph.edges.length > 0) {
      sections.set("relationships", [this.buildRelationships(graph.edges, graph)]);
    }

    // Assemble final CUE
    const lines: string[] = [];

    // Package declaration
    lines.push(`package ${this.options.packageName}`);
    lines.push("");

    // Import schema if needed
    lines.push('import "arbiter.dev/spec/schema"');
    lines.push("");

    // Output each section
    for (const [section, entities] of sections) {
      if (entities.length === 0) continue;

      // Handle nested sections (e.g., ui.routes)
      const parts = section.split(".");
      if (parts.length > 1) {
        lines.push(`${parts[0]}: {`);
        lines.push(`\t${parts[1]}: {`);
        for (const entity of entities) {
          lines.push(this.indent(entity, 2));
        }
        lines.push("\t}");
        lines.push("}");
      } else {
        lines.push(`${section}: {`);
        for (const entity of entities) {
          lines.push(this.indent(entity, 1));
        }
        lines.push("}");
      }
      lines.push("");
    }

    return lines.join("\n");
  }

  /**
   * Build CUE output for a single entity.
   *
   * @param node - Entity node to convert
   * @param graph - Full graph for context
   * @returns CUE string for the entity
   */
  buildEntity(node: EntityNode, graph: EntityGraph): string {
    const lines: string[] = [];

    // Source comment if enabled
    if (this.options.includeSourceComments) {
      lines.push(`// Source: .arbiter/${node.filePath}`);
    }

    // Entity key (slug derived from name)
    const slug = this.slugify(node.name);
    lines.push(`"${slug}": {`);

    // Add type-specific fields
    const fields = this.buildEntityFields(node, graph);
    for (const field of fields) {
      lines.push(`\t${field}`);
    }

    lines.push("}");

    return lines.join("\n");
  }

  /**
   * Build fields for an entity based on its type.
   *
   * @param node - Entity node
   * @param graph - Full graph for context
   * @returns Array of field strings
   */
  private buildEntityFields(node: EntityNode, graph: EntityGraph): string[] {
    const fields: string[] = [];
    const fm = node.frontmatter;

    // Common fields
    fields.push(`entityId: "${node.entityId}"`);
    if (node.name) {
      fields.push(`name: "${this.escapeString(node.name)}"`);
    }
    if (node.body) {
      fields.push(`description: "${this.escapeString(node.body.slice(0, 500))}"`);
    }

    // Type-specific fields
    switch (node.type) {
      case "service":
      case "client":
        fields.push(...this.buildPackageFields(node));
        break;
      case "endpoint":
        fields.push(...this.buildEndpointFields(node));
        break;
      case "resource":
        fields.push(...this.buildResourceFields(node));
        break;
      case "group":
        fields.push(...this.buildGroupFields(node));
        break;
      case "task":
        fields.push(...this.buildTaskFields(node));
        break;
      case "note":
        fields.push(...this.buildNoteFields(node));
        break;
      case "system":
        fields.push(...this.buildSystemFields(node));
        break;
      case "project":
        fields.push(...this.buildProjectFields(node));
        break;
    }

    // Tags
    if (fm.tags && fm.tags.length > 0) {
      fields.push(`tags: [${fm.tags.map((t) => `"${t}"`).join(", ")}]`);
    }

    // Member of (parent group)
    if (node.parentId) {
      const parent = graph.nodes.get(node.parentId);
      if (parent && parent.type === "group") {
        fields.push(`parent: "${this.slugify(parent.name)}"`);
      }
    }

    return fields;
  }

  /**
   * Build fields for a package (service/client) entity.
   */
  private buildPackageFields(node: EntityNode): string[] {
    const fields: string[] = [];
    const fm = node.frontmatter;

    if (fm.language) {
      fields.push(`language: "${fm.language}"`);
    }
    if (fm.subtype) {
      fields.push(`subtype: "${fm.subtype}"`);
    }
    if (fm.framework) {
      fields.push(`framework: "${fm.framework}"`);
    }
    if (fm.port) {
      fields.push(`port: ${fm.port}`);
    }
    if (fm.workload) {
      fields.push(`workload: "${fm.workload}"`);
    }
    if (fm.healthCheck) {
      fields.push(`healthCheck: ${this.objectToCue(fm.healthCheck)}`);
    }
    if (fm.env) {
      fields.push(`env: ${this.objectToCue(fm.env)}`);
    }

    // Add endpoints as nested structure if this is a container
    if (node.childIds.length > 0) {
      // Endpoints will be added separately to their own section
    }

    return fields;
  }

  /**
   * Build fields for an endpoint entity.
   */
  private buildEndpointFields(node: EntityNode): string[] {
    const fields: string[] = [];
    const fm = node.frontmatter;

    if (fm.path) {
      fields.push(`path: "${fm.path}"`);
    }
    if (fm.methods && Array.isArray(fm.methods)) {
      fields.push(`methods: [${fm.methods.map((m) => `"${m}"`).join(", ")}]`);
    }
    if (fm.handler) {
      fields.push(`handler: ${this.objectToCue(fm.handler)}`);
    }
    if (fm.middleware && Array.isArray(fm.middleware)) {
      fields.push(`middleware: ${this.arrayToCue(fm.middleware)}`);
    }

    return fields;
  }

  /**
   * Build fields for a resource entity.
   */
  private buildResourceFields(node: EntityNode): string[] {
    const fields: string[] = [];
    const fm = node.frontmatter;

    if (fm.kind) {
      fields.push(`kind: "${fm.kind}"`);
    }
    if (fm.engine) {
      fields.push(`engine: "${fm.engine}"`);
    }
    if (fm.provider) {
      fields.push(`provider: "${fm.provider}"`);
    }
    if (fm.image) {
      fields.push(`image: "${fm.image}"`);
    }
    if (fm.version) {
      fields.push(`version: "${fm.version}"`);
    }

    return fields;
  }

  /**
   * Build fields for a group entity.
   */
  private buildGroupFields(node: EntityNode): string[] {
    const fields: string[] = [];
    const fm = node.frontmatter;

    if (fm.kind) {
      fields.push(`kind: "${fm.kind}"`);
    }
    if (fm.status) {
      fields.push(`status: "${fm.status}"`);
    }
    if (fm.due) {
      fields.push(`due: "${fm.due}"`);
    }

    return fields;
  }

  /**
   * Build fields for a task entity.
   */
  private buildTaskFields(node: EntityNode): string[] {
    const fields: string[] = [];
    const fm = node.frontmatter;

    fields.push(`title: "${this.escapeString(node.name)}"`);
    if (fm.status) {
      fields.push(`status: "${fm.status}"`);
    }
    if (fm.priority) {
      fields.push(`priority: "${fm.priority}"`);
    }
    if (fm.assignees && Array.isArray(fm.assignees)) {
      fields.push(`assignees: [${fm.assignees.map((a) => `"${a}"`).join(", ")}]`);
    }
    if (fm.labels && Array.isArray(fm.labels)) {
      fields.push(`labels: [${fm.labels.map((l) => `"${l}"`).join(", ")}]`);
    }
    if (fm.due) {
      fields.push(`due: "${fm.due}"`);
    }
    if (fm.estimate) {
      fields.push(`estimate: ${fm.estimate}`);
    }

    return fields;
  }

  /**
   * Build fields for a note entity.
   */
  private buildNoteFields(node: EntityNode): string[] {
    const fields: string[] = [];
    const fm = node.frontmatter;

    fields.push(`content: "${this.escapeString(node.body)}"`);
    if (fm.target) {
      fields.push(`target: "${fm.target}"`);
    }
    if (fm.kind) {
      fields.push(`kind: "${fm.kind}"`);
    }
    if (fm.author) {
      fields.push(`author: "${fm.author}"`);
    }
    if (fm.resolved !== undefined) {
      fields.push(`resolved: ${fm.resolved}`);
    }

    return fields;
  }

  /**
   * Build fields for a system entity.
   */
  private buildSystemFields(node: EntityNode): string[] {
    const fields: string[] = [];
    // Systems are primarily organizational containers
    // Their children are the main content
    return fields;
  }

  /**
   * Build fields for a project entity.
   */
  private buildProjectFields(node: EntityNode): string[] {
    const fields: string[] = [];
    const fm = node.frontmatter;

    if (fm.version) {
      fields.push(`version: "${fm.version}"`);
    }

    return fields;
  }

  /**
   * Build the relationships section from edges.
   */
  private buildRelationships(edges: RelationshipEdge[], graph: EntityGraph): string {
    const lines: string[] = [];

    for (const edge of edges) {
      const fromNode = graph.nodes.get(edge.from);
      const toNode = graph.nodes.get(edge.to);
      if (!fromNode || !toNode) continue;

      const fromSlug = this.slugify(fromNode.name);
      const toSlug = this.slugify(toNode.name);
      const relId = `${fromSlug}-${edge.kind}-${toSlug}`;

      lines.push(`"${relId}": {`);
      lines.push(`\tfrom: "${fromSlug}"`);
      lines.push(`\tto: "${toSlug}"`);
      lines.push(`\ttype: "${edge.kind}"`);
      if (edge.label) {
        lines.push(`\tlabel: "${this.escapeString(edge.label)}"`);
      }
      lines.push("}");
    }

    return lines.join("\n");
  }

  /**
   * Convert a JavaScript object to CUE syntax.
   */
  private objectToCue(obj: Record<string, unknown>): string {
    const pairs: string[] = [];
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined || value === null) continue;
      pairs.push(`${key}: ${this.valueToCue(value)}`);
    }
    return `{\n\t\t${pairs.join("\n\t\t")}\n\t}`;
  }

  /**
   * Convert a JavaScript array to CUE syntax.
   */
  private arrayToCue(arr: unknown[]): string {
    const items = arr.map((item) => this.valueToCue(item));
    return `[${items.join(", ")}]`;
  }

  /**
   * Convert a JavaScript value to CUE syntax.
   */
  private valueToCue(value: unknown): string {
    if (typeof value === "string") {
      return `"${this.escapeString(value)}"`;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return this.arrayToCue(value);
    }
    if (typeof value === "object" && value !== null) {
      return this.objectToCue(value as Record<string, unknown>);
    }
    return "null";
  }

  /**
   * Escape a string for CUE output.
   */
  private escapeString(str: string): string {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
  }

  /**
   * Convert a name to a URL-safe slug.
   */
  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-");
  }

  /**
   * Indent a block of text.
   */
  private indent(text: string, levels: number): string {
    const tabs = "\t".repeat(levels);
    return text
      .split("\n")
      .map((line) => tabs + line)
      .join("\n");
  }
}

/**
 * Create a new CUE builder instance.
 *
 * @param options - Build options
 * @returns CueBuilder instance
 */
export function createCueBuilder(options?: CueBuildOptions): CueBuilder {
  return new CueBuilder(options);
}

/**
 * Quick helper to build CUE from an entity graph.
 *
 * @param graph - Entity graph
 * @param options - Build options
 * @returns CUE string
 */
export function buildCueFromGraph(graph: EntityGraph, options?: CueBuildOptions): string {
  const builder = new CueBuilder(options);
  return builder.build(graph);
}
