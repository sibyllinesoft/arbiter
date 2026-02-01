/**
 * @packageDocumentation
 * Type definitions for the markdown-first storage system.
 *
 * The storage system represents entities as markdown files with YAML frontmatter.
 * Directory hierarchy represents parent-child relationships naturally.
 */

// ============================================================================
// Entity Types - Maps to frontmatter 'type' field
// ============================================================================

/**
 * All supported entity types in the markdown storage system.
 * These map to CUE schema definitions for validation.
 */
export type EntityType =
  // Architecture entities
  | "project"
  | "system"
  | "service"
  | "endpoint"
  | "resource"
  | "client"
  // Organization entities
  | "group"
  | "task"
  | "note"
  // Definition entities
  | "schema"
  | "contract"
  | "flow"
  | "route"
  | "locator";

/**
 * Resource kinds for infrastructure entities
 */
export type ResourceKind =
  | "database"
  | "cache"
  | "queue"
  | "storage"
  | "container"
  | "gateway"
  | "external";

/**
 * Group kinds for organizational entities
 */
export type GroupKind =
  | "milestone"
  | "epic"
  | "sprint"
  | "domain"
  | "release"
  | "iteration"
  | "group";

/**
 * Note/comment kinds
 */
export type NoteKind = "discussion" | "guidance" | "memory" | "decision" | "note";

/**
 * Service workload types
 */
export type WorkloadType =
  | "deployment"
  | "statefulset"
  | "daemonset"
  | "job"
  | "cronjob"
  | "serverless"
  | "managed";

/**
 * Task/issue status values
 */
export type TaskStatus =
  | "open"
  | "in_progress"
  | "blocked"
  | "review"
  | "done"
  | "closed"
  | "wontfix";

/**
 * Task/issue priority values
 */
export type TaskPriority = "critical" | "high" | "medium" | "low";

// ============================================================================
// Relationship Types
// ============================================================================

/**
 * Relationship kinds that can exist between entities.
 * Extensible - any string is valid, but common kinds have semantic meaning.
 */
export type RelationshipKind =
  | "depends_on"
  | "implements"
  | "calls"
  | "reads"
  | "writes"
  | "blocks"
  | "blocked_by"
  | "duplicates"
  | "related_to"
  | "deployed_as"
  | "authenticates"
  | "notifies"
  | string; // Allow custom relationship kinds

/**
 * A markdown link reference to another entity.
 * Format: [Label](relative/path/to/entity.md)
 */
export interface MarkdownLink {
  /** Display label from the link */
  label: string;
  /** Relative path to the target file */
  path: string;
  /** Resolved entity ID (after graph resolution) */
  entityId?: string;
}

/**
 * Relationships map in frontmatter.
 * Keys are relationship kinds, values are arrays of markdown links.
 */
export type RelationshipsMap = {
  [K in RelationshipKind]?: string[]; // Raw markdown link strings
};

/**
 * Parsed relationships map with resolved links.
 */
export type ParsedRelationshipsMap = {
  [K in RelationshipKind]?: MarkdownLink[];
};

/**
 * An edge in the entity graph representing a relationship.
 */
export interface RelationshipEdge {
  /** Source entity ID */
  from: string;
  /** Target entity ID */
  to: string;
  /** Relationship kind */
  kind: RelationshipKind;
  /** Optional label from the markdown link */
  label?: string;
}

// ============================================================================
// Entity Node Types
// ============================================================================

/**
 * Common fields present in all entity frontmatter.
 */
export interface CommonEntityFields {
  /** Entity type - determines validation schema */
  type: EntityType;
  /** Stable UUID that persists across renames */
  entityId: string;
  /** ISO8601 creation timestamp */
  createdAt: string;
  /** ISO8601 last update timestamp */
  updatedAt: string;
  /** Tags for filtering and categorization */
  tags?: string[];
  /** Relationships to other entities */
  relationships?: RelationshipsMap;
}

/**
 * Service-specific frontmatter fields.
 */
export interface ServiceFields {
  language?: string;
  port?: number;
  framework?: string;
  workload?: WorkloadType;
  healthCheck?: {
    path?: string;
    port?: number;
    protocol?: string;
    interval?: string;
    timeout?: string;
  };
  env?: Record<string, string>;
  /** Service subtype for polymorphism */
  subtype?: "service" | "frontend" | "tool" | "library" | "worker";
}

/**
 * Endpoint-specific frontmatter fields.
 */
export interface EndpointFields {
  path: string;
  methods: string[];
  handler?: {
    module?: string;
    function?: string;
  };
  middleware?: Array<{
    name: string;
    phase?: "request" | "response";
    config?: Record<string, unknown>;
  }>;
}

/**
 * Resource-specific frontmatter fields.
 */
export interface ResourceFields {
  kind: ResourceKind;
  engine?: string;
  provider?: string;
  image?: string;
  version?: string;
}

/**
 * Group-specific frontmatter fields.
 */
export interface GroupFields {
  kind?: GroupKind;
  status?: "open" | "closed" | "active";
  due?: string;
}

/**
 * Task-specific frontmatter fields.
 */
export interface TaskFields {
  status: TaskStatus;
  priority?: TaskPriority;
  assignees?: string[];
  labels?: string[];
  due?: string;
  estimate?: number;
}

/**
 * Note-specific frontmatter fields.
 */
export interface NoteFields {
  kind?: NoteKind;
  target?: string;
  author?: string;
  resolved?: boolean;
}

/**
 * Union of all type-specific fields.
 */
export type TypeSpecificFields =
  | ServiceFields
  | EndpointFields
  | ResourceFields
  | GroupFields
  | TaskFields
  | NoteFields;

/**
 * Complete entity frontmatter (common + all possible optional fields).
 * Uses a flat structure to avoid TypeScript intersection issues.
 */
export interface EntityFrontmatter extends CommonEntityFields {
  // Service fields
  language?: string;
  port?: number;
  framework?: string;
  workload?: WorkloadType;
  healthCheck?: {
    path?: string;
    port?: number;
    protocol?: string;
    interval?: string;
    timeout?: string;
  };
  env?: Record<string, string>;
  subtype?: "service" | "frontend" | "tool" | "library" | "worker";

  // Endpoint fields
  path?: string;
  methods?: string[];
  handler?: {
    module?: string;
    function?: string;
  };
  middleware?: Array<{
    name: string;
    phase?: "request" | "response";
    config?: Record<string, unknown>;
  }>;

  // Resource fields
  kind?: ResourceKind | GroupKind | NoteKind;
  engine?: string;
  provider?: string;
  image?: string;
  version?: string;

  // Group fields
  status?: "open" | "closed" | "active" | TaskStatus;
  due?: string;

  // Task fields
  priority?: TaskPriority;
  assignees?: string[];
  labels?: string[];
  estimate?: number;

  // Note fields
  target?: string;
  author?: string;
  resolved?: boolean;

  // Allow additional fields
  [key: string]: unknown;
}

/**
 * An entity node in the graph.
 * Represents a single markdown file with its parsed content.
 */
export interface EntityNode {
  /** Stable entity ID (from frontmatter) */
  entityId: string;
  /** Entity type */
  type: EntityType;
  /** Display name (from H1 heading or directory name) */
  name: string;
  /** Filesystem path relative to .arbiter directory */
  filePath: string;
  /** Whether this is a container (directory) or leaf (file) */
  isContainer: boolean;
  /** Parsed frontmatter */
  frontmatter: EntityFrontmatter;
  /** Markdown body content (after frontmatter) */
  body: string;
  /** Parent entity ID (derived from filesystem hierarchy) */
  parentId?: string;
  /** Child entity IDs (derived from filesystem hierarchy) */
  childIds: string[];
  /** Parsed relationships (after resolution) */
  relationships: ParsedRelationshipsMap;
}

// ============================================================================
// Entity Graph Types
// ============================================================================

/**
 * The complete entity graph loaded from the .arbiter directory.
 */
export interface EntityGraph {
  /** All nodes indexed by entityId */
  nodes: Map<string, EntityNode>;
  /** All relationship edges */
  edges: RelationshipEdge[];
  /** Root node (the .arbiter/README.md project entity) */
  rootId?: string;
  /** Index from file path to entity ID for quick lookups */
  pathIndex: Map<string, string>;
}

/**
 * Result of validating an entity graph.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

/**
 * A validation error.
 */
export interface ValidationError {
  entityId: string;
  filePath: string;
  field?: string;
  message: string;
  line?: number;
  column?: number;
}

/**
 * A validation warning.
 */
export interface ValidationWarning {
  entityId: string;
  filePath: string;
  field?: string;
  message: string;
}

// ============================================================================
// Storage Operation Types
// ============================================================================

/**
 * Options for creating or updating an entity.
 */
export interface SaveEntityOptions {
  /** Create as container (directory + README.md) if true */
  asContainer?: boolean;
  /** Parent entity path (for nested entities) */
  parentPath?: string;
  /** Skip validation */
  skipValidation?: boolean;
}

/**
 * Options for loading the entity graph.
 */
export interface LoadOptions {
  /** Base directory (defaults to .arbiter) */
  baseDir?: string;
  /** Skip relationship resolution */
  skipRelationships?: boolean;
  /** Filter by entity types */
  types?: EntityType[];
}

/**
 * Options for building CUE output.
 */
export interface CueBuildOptions {
  /** Include comments with source file paths */
  includeSourceComments?: boolean;
  /** Package name for the CUE output */
  packageName?: string;
  /** Format the output */
  format?: boolean;
}
