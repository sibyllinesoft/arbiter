/**
 * Core types and interfaces for the Brownfield Detection Pipeline
 *
 * This module defines the complete type system for analyzing existing codebases
 * and inferring architectural specifications. The pipeline follows a plugin-based
 * architecture with structured evidence collection and confidence scoring.
 */

// ============================================================================
// Core Plugin Interface
// ============================================================================

/**
 * Base plugin interface for importer detection
 * All detection plugins must implement these methods
 */
export interface ImporterPlugin {
  /**
   * Unique identifier for this plugin
   */
  name(): string;

  /**
   * Check if this plugin can analyze the given file/directory
   *
   * @param filePath - Path to the file or directory to analyze
   * @param fileContent - Content of the file (for file-based plugins)
   * @returns true if this plugin can process the given input
   */
  supports(filePath: string, fileContent?: string): boolean;

  /**
   * Parse the file/directory and extract structured evidence
   *
   * @param filePath - Path to the file or directory
   * @param fileContent - Content of the file (for file-based plugins)
   * @param context - Additional context for parsing
   * @returns Structured evidence extracted from the file
   */
  parse(filePath: string, fileContent?: string, context?: ParseContext): Promise<Evidence[]>;

  /**
   * Infer artifacts from the collected evidence
   *
   * @param evidence - Array of evidence collected from all sources
   * @param context - Inference context with project-wide information
   * @returns Array of inferred artifacts with confidence scores
   */
  infer(evidence: Evidence[], context: InferenceContext): Promise<InferredArtifact[]>;
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Context provided during the parsing phase
 */
export interface ParseContext {
  /** Root directory of the project being analyzed */
  projectRoot?: string;
  /** File index containing information about all files in the project */
  fileIndex: FileIndex;
  /** Configuration options for parsing */
  options: ParseOptions;
  /** Cache for expensive operations */
  cache: Map<string, unknown>;
}

/**
 * Context provided during the inference phase
 */
export interface InferenceContext {
  /** Root directory of the project being analyzed */
  projectRoot?: string;
  /** Complete file index of the project */
  fileIndex: FileIndex;
  /** All evidence collected from all plugins */
  allEvidence: Evidence[];
  /** Configuration options for inference */
  options: InferenceOptions;
  /** Cache for expensive operations */
  cache: Map<string, unknown>;
  /** Project metadata including overridden project name */
  projectMetadata: ProjectMetadata;
}

/**
 * Configuration options for the parsing phase
 */
export interface ParseOptions {
  /** Whether to perform deep analysis (slower but more accurate) */
  deepAnalysis: boolean;
  /** Languages to focus on (empty array means all) */
  targetLanguages: string[];
  /** Maximum file size to analyze (in bytes) */
  maxFileSize: number;
  /** Whether to analyze binary files */
  includeBinaries: boolean;
  /** Custom patterns to include/exclude */
  patterns: {
    include: string[];
    exclude: string[];
  };
}

/**
 * Configuration options for the inference phase
 */
export interface InferenceOptions {
  /** Minimum confidence threshold for including artifacts */
  minConfidence: number;
  /** Whether to infer relationships between artifacts */
  inferRelationships: boolean;
  /** Maximum depth for dependency analysis */
  maxDependencyDepth: number;
  /** Whether to use heuristics for ambiguous cases */
  useHeuristics: boolean;
}

// ============================================================================
// Artifact Types
// ============================================================================

/**
 * Types of artifacts that can be detected in a importer project
 */
export type ArtifactType =
  | 'service' // HTTP services, APIs, microservices
  | 'binary' // Executable binaries
  | 'tool' // Command-line interface tools
  | 'module' // Reusable modules, components, libraries
  | 'job' // Background jobs, cron jobs, workers
  | 'schema' // Database schemas, API schemas
  | 'config' // Configuration files, environment settings
  | 'deployment' // Deployment configurations, infrastructure
  | 'test' // Test suites, test configurations
  | 'frontend' // Web frontends, SPAs, static sites
  | 'database' // Database instances, data stores
  | 'cache' // Caching layers, in-memory stores
  | 'queue' // Message queues, event streams
  | 'proxy' // Load balancers, reverse proxies
  | 'monitor' // Monitoring, logging, alerting
  | 'auth' // Authentication, authorization services
  | 'docs' // Documentation, specifications
  | 'infrastructure'; // Infrastructure as code

/**
 * Base artifact interface
 */
export interface BaseArtifact {
  /** Unique identifier for this artifact */
  id: string;
  /** Type of artifact */
  type: ArtifactType;
  /** Human-readable name */
  name: string;
  /** Detailed description */
  description?: string;
  /** Tags for categorization */
  tags: string[];
  /** Metadata specific to the artifact type */
  metadata: Record<string, unknown> & {
    sourceFile?: string;
  };
}

/**
 * Service artifact representing an HTTP service or API
 */
export interface ServiceArtifact extends BaseArtifact {
  type: 'service';
  metadata: {
    sourceFile?: string;
    root?: string;
    /** Programming language */
    language: string;
    /** Framework used (e.g., 'express', 'fastapi', 'spring') */
    framework?: string;
    /** Port number the service runs on */
    port?: number;
    /** Base path or context root */
    basePath?: string;
    /** Environment variables required */
    environmentVariables: string[];
    /** Dependencies on other services */
    dependencies: ServiceDependency[];
    /** Endpoints exposed by this service */
    endpoints: ServiceEndpoint[];
    /** Health check configuration */
    healthCheck?: HealthCheckConfig;
    /** Container image name from Docker/compose files */
    containerImage?: string;
    /** Docker build context path */
    buildContext?: string;
    /** Dockerfile path relative to build context */
    dockerfile?: string;
    /** Raw Dockerfile contents when available */
    dockerfileContent?: string;
  };
}

/**
 * Binary artifact representing an executable
 */
export interface BinaryArtifact extends BaseArtifact {
  type: 'binary';
  metadata: {
    sourceFile?: string;
    root?: string;
    /** Programming language */
    language: string;
    /** Build system (e.g., 'maven', 'gradle', 'npm') */
    buildSystem?: string;
    /** Entry point file */
    entryPoint: string;
    /** Command line arguments */
    arguments: string[];
    /** Environment variables required */
    environmentVariables: string[];
    /** Runtime dependencies */
    dependencies: string[];
  };
}

/**
 * Tool artifact representing a command-line interface tool
 */
export interface ToolArtifact extends BaseArtifact {
  type: 'tool';
  metadata: {
    /** Programming language */
    language: string;
    /** Command-line framework used (e.g., 'commander', 'click', 'clap') */
    framework?: string;
    /** Build system (e.g., 'maven', 'gradle', 'npm') */
    buildSystem?: string;
    /** Entry point file */
    entryPoint: string;
    /** Available commands */
    commands: string[];
    /** Command line arguments */
    arguments: string[];
    /** Environment variables required */
    environmentVariables: string[];
    /** Runtime dependencies */
    dependencies: string[];
  };
}

/**
 * Module artifact representing reusable modules, components, or libraries
 */
export interface ModuleArtifact extends BaseArtifact {
  type: 'module';
  metadata: {
    sourceFile?: string;
    root?: string;
    /** Programming language */
    language: string;
    /** Framework used (e.g., 'react', 'vue', 'lodash') */
    framework?: string;
    /** Package manager (e.g., 'npm', 'pip', 'maven') */
    packageManager?: string;
    /** Public API exposed by the module */
    publicApi: string[];
    /** Internal dependencies */
    dependencies: string[];
    /** Routes if frontend module */
    routes?: FrontendRoute[];
    /** API endpoints consumed */
    apiDependencies?: string[];
    /** Version information */
    version?: string;
  };
}

/**
 * Job artifact representing background jobs or scheduled tasks
 */
export interface JobArtifact extends BaseArtifact {
  type: 'job';
  metadata: {
    /** Programming language */
    language: string;
    /** Job scheduler (e.g., 'cron', 'kubernetes', 'airflow') */
    scheduler?: string;
    /** Schedule expression */
    schedule?: string;
    /** Entry point for the job */
    entryPoint: string;
    /** Environment variables required */
    environmentVariables: string[];
    /** Dependencies on other services/jobs */
    dependencies: string[];
  };
}

/**
 * Schema artifact representing data schemas
 */
export interface SchemaArtifact extends BaseArtifact {
  type: 'schema';
  metadata: {
    /** Schema format (e.g., 'json-schema', 'openapi', 'protobuf') */
    format: string;
    /** Version of the schema */
    version?: string;
    /** Tables or entities defined */
    entities: SchemaEntity[];
    /** Database type if applicable */
    databaseType?: string;
  };
}

/**
 * Frontend artifact representing web frontends
 */
export interface FrontendArtifact extends BaseArtifact {
  type: 'frontend';
  metadata: {
    sourceFile?: string;
    root?: string;
    /** Frontend framework (e.g., 'react', 'vue', 'angular') */
    framework?: string;
    /** Build system (e.g., 'webpack', 'vite', 'parcel') */
    buildSystem?: string;
    /** Routes defined in the application */
    routes: FrontendRoute[];
    /** API endpoints this frontend consumes */
    apiDependencies: string[];
    /** Environment variables required */
    environmentVariables: string[];
  };
}

/**
 * Database artifact representing database instances
 */
export interface DatabaseArtifact extends BaseArtifact {
  type: 'database';
  metadata: {
    /** Database type (e.g., 'postgresql', 'mysql', 'mongodb') */
    databaseType: string;
    /** Database version */
    version?: string;
    /** Database schemas/collections */
    schemas: string[];
    /** Port number */
    port?: number;
    /** Configuration parameters */
    configuration: Record<string, unknown>;
  };
}

/**
 * Deployment artifact representing deployment configurations
 */
export interface DeploymentArtifact extends BaseArtifact {
  type: 'deployment';
  metadata: {
    sourceFile?: string;
    /** Deployment platform (e.g., 'kubernetes', 'docker-compose', 'terraform') */
    platform: string;
    /** Target environment */
    environment?: string;
    /** Namespace or scope */
    namespace?: string;
    /** Deployment resources */
    resources?: Array<{ kind: string; name: string; apiVersion?: string }>;
    /** Configuration files */
    configFiles?: string[];
    /** Deployment strategy */
    strategy?: string;
    /** Scaling configuration */
    scaling?: {
      min?: number;
      max?: number;
      targetCPU?: number;
    };
  };
}
/**
 * Infrastructure artifact representing IaC configurations (Kubernetes, Terraform)
 */
export interface InfrastructureArtifact extends BaseArtifact {
  type: 'infrastructure';
  metadata: {
    sourceFile?: string;
    /** Root directory containing the IaC files */
    root: string;
    /** List of all files in this infrastructure group */
    files: string[];
    /** Type of infrastructure: 'kubernetes' or 'terraform' */
    kind: 'kubernetes' | 'terraform';
    /** Detected resources/deployments */
    resources?: Array<{ kind: string; name: string; apiVersion?: string }>;
  };
}

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Service dependency representing a connection to another service
 */
export interface ServiceDependency {
  /** Name of the dependent service */
  serviceName: string;
  /** Type of dependency (e.g., 'http', 'database', 'queue') */
  type: string;
  /** Whether this dependency is required for the service to function */
  required: boolean;
  /** Configuration for the dependency */
  configuration?: Record<string, unknown>;
}

/**
 * Service endpoint representing an API endpoint
 */
export interface ServiceEndpoint {
  /** HTTP method */
  method: string;
  /** URL path */
  path: string;
  /** Request/response schema */
  schema?: string;
  /** Description of the endpoint */
  description?: string;
  /** Whether authentication is required */
  authenticated?: boolean;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Health check endpoint path */
  path: string;
  /** Expected status code */
  expectedStatusCode: number;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Check interval in seconds */
  intervalSeconds: number;
}

/**
 * Schema entity representing a table or data structure
 */
export interface SchemaEntity {
  /** Entity name */
  name: string;
  /** Fields/columns in the entity */
  fields: SchemaField[];
  /** Relationships to other entities */
  relationships: SchemaRelationship[];
}

/**
 * Schema field representing a column or property
 */
export interface SchemaField {
  /** Field name */
  name: string;
  /** Data type */
  type: string;
  /** Whether the field is required */
  required: boolean;
  /** Field constraints */
  constraints?: string[];
}

/**
 * Schema relationship between entities
 */
export interface SchemaRelationship {
  /** Type of relationship (e.g., 'one-to-many', 'many-to-many') */
  type: string;
  /** Target entity */
  targetEntity: string;
  /** Foreign key field */
  foreignKey?: string;
}

/**
 * Frontend route definition
 */
export interface FrontendRoute {
  /** Route path */
  path: string;
  /** Component name */
  component?: string;
  /** Route name/title */
  name?: string;
  /** Whether authentication is required */
  authenticated?: boolean;
}

// ============================================================================
// Evidence and File System Types
// ============================================================================

/**
 * Evidence collected during the parsing phase
 */
export interface Evidence {
  /** Unique identifier for this evidence */
  id: string;
  /** Plugin that collected this evidence */
  source: string;
  /** Type of evidence */
  type: EvidenceType;
  /** File path where evidence was found */
  filePath: string;
  /** Line number in the file (if applicable) */
  lineNumber?: number;
  /** Raw data extracted */
  data: Record<string, unknown>;
  /** Additional metadata */
  metadata: EvidenceMetadata;
}

/**
 * Types of evidence that can be collected
 */
export type EvidenceType =
  | 'dependency' // Package dependencies
  | 'import' // Import statements
  | 'export' // Export declarations
  | 'function' // Function definitions
  | 'class' // Class definitions
  | 'interface' // Interface definitions
  | 'config' // Configuration values
  | 'route' // HTTP route definitions
  | 'schema' // Schema definitions
  | 'test' // Test cases
  | 'comment' // Documentation comments
  | 'annotation' // Decorators/annotations
  | 'environment' // Environment variable usage
  | 'build' // Build configuration
  | 'deployment' // Deployment configuration
  | 'infrastructure'; // Infrastructure as code

/**
 * Metadata attached to evidence
 */
export interface EvidenceMetadata {
  /** Timestamp when evidence was collected */
  timestamp: number;
  /** Size of the file in bytes */
  fileSize: number;
  /** MIME type of the file */
  mimeType?: string;
  /** Git information if available */
  git?: {
    lastModified: number;
    author?: string;
    commit?: string;
  };
  /** Additional context-specific metadata */
  [key: string]: unknown;
}

/**
 * Index of all files in the project
 */
export interface FileIndex {
  /** Root directory of the project */
  root: string;
  /** Map of file paths to file information */
  files: Map<string, FileInfo>;
  /** Map of directory paths to directory information */
  directories: Map<string, DirectoryInfo>;
  /** Generated timestamp */
  timestamp: number;
}

/**
 * Information about a single file
 */
export interface FileInfo {
  /** Absolute path to the file */
  path: string;
  /** Relative path from project root */
  relativePath: string;
  /** File size in bytes */
  size: number;
  /** Last modified timestamp */
  lastModified: number;
  /** MIME type */
  mimeType?: string;
  /** File extension */
  extension: string;
  /** Whether the file is binary */
  isBinary: boolean;
  /** File hash for change detection */
  hash?: string;
  /** Language detected (if applicable) */
  language?: string;
  /** Additional metadata including git information */
  metadata?: {
    git?: {
      lastModified?: number;
      author?: string;
      commit?: string;
    };
    [key: string]: unknown;
  };
}

/**
 * Information about a directory
 */
export interface DirectoryInfo {
  /** Absolute path to the directory */
  path: string;
  /** Relative path from project root */
  relativePath: string;
  /** Number of files in the directory (recursive) */
  fileCount: number;
  /** Total size of all files in the directory (recursive) */
  totalSize: number;
  /** Last modified timestamp (most recent file) */
  lastModified: number;
}

// ============================================================================
// Confidence and Provenance
// ============================================================================

/**
 * Confidence scoring for inferred artifacts
 */
export interface ConfidenceScore {
  /** Overall confidence (0-1) */
  overall: number;
  /** Breakdown by evidence type */
  breakdown: Record<string, number>;
  /** Factors that contributed to the confidence */
  factors: ConfidenceFactor[];
}

/**
 * Individual factor contributing to confidence
 */
export interface ConfidenceFactor {
  /** Description of the factor */
  description: string;
  /** Weight of this factor (-1 to 1) */
  weight: number;
  /** Source of this factor */
  source: string;
}

/**
 * Provenance tracking for artifacts
 */
export interface Provenance {
  /** Evidence that led to this artifact */
  evidence: string[];
  /** Plugins involved in inference */
  plugins: string[];
  /** Inference rules applied */
  rules: string[];
  /** Timestamp of inference */
  timestamp: number;
  /** Version of the pipeline */
  pipelineVersion: string;
}

// ============================================================================
// Inferred Artifacts and Output
// ============================================================================

/**
 * Artifact with inference metadata
 */
export interface InferredArtifact {
  /** The inferred artifact */
  artifact: BaseArtifact;
  /** Provenance information */
  provenance: Provenance;
  /** Relationships to other artifacts */
  relationships: ArtifactRelationship[];
}

/**
 * Relationship between artifacts
 */
export interface ArtifactRelationship {
  /** Type of relationship */
  type: RelationshipType;
  /** Target artifact ID */
  targetId: string;
  /** Confidence in this relationship */
  confidence: number;
  /** Additional metadata about the relationship */
  metadata?: Record<string, unknown>;
}

/**
 * Types of relationships between artifacts
 */
export type RelationshipType =
  | 'depends_on' // A depends on B
  | 'provides' // A provides B
  | 'consumes' // A consumes B
  | 'deploys' // A deploys B
  | 'tests' // A tests B
  | 'configures' // A configures B
  | 'documents' // A documents B
  | 'implements' // A implements B
  | 'extends' // A extends B
  | 'contains'; // A contains B

/**
 * Final output of the importer detection pipeline
 * This is the stable contract that consumers can rely on
 */
export interface ArtifactManifest {
  /** Version of the manifest format */
  version: string;
  /** Metadata about the analyzed project */
  project: ProjectMetadata;
  /** Artifacts grouped by config file */
  perConfig: Record<string, InferredArtifact[]>;
  /** All inferred artifacts (flattened for backward compatibility) */
  artifacts: InferredArtifact[];
  /** Source-to-artifact provenance mapping: file basename -> array of artifact IDs */
  provenance: Record<string, string[]>;
  /** Global statistics and metrics */
  statistics: AnalysisStatistics;
  /** Configuration used for the analysis */
  configuration: AnalysisConfiguration;
  /** Generation timestamp */
  timestamp: number;
}

/**
 * Metadata about the analyzed project
 */
export interface ProjectMetadata {
  /** Project name */
  name: string;
  /** Project root directory */
  root: string;
  /** Detected languages */
  languages: string[];
  /** Detected frameworks */
  frameworks: string[];
  /** Total number of files analyzed */
  fileCount: number;
  /** Total size of all files */
  totalSize: number;
  /** Git information if available */
  git?: {
    repository?: string;
    branch?: string;
    commit?: string;
    lastModified?: number;
  };
}

/**
 * Statistics from the analysis
 */
export interface AnalysisStatistics {
  /** Number of artifacts by type */
  artifactCounts: Record<ArtifactType, number>;
  /** Number of evidence items by type */
  evidenceCounts: Record<EvidenceType, number>;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Plugins that were executed */
  pluginsExecuted: string[];
  /** Files that could not be processed */
  failedFiles: string[];
}

/**
 * Configuration used for the analysis
 */
export interface AnalysisConfiguration {
  /** Parse options */
  parseOptions: ParseOptions;
  /** Inference options */
  inferenceOptions: InferenceOptions;
  /** Plugins enabled */
  enabledPlugins: string[];
  /** Custom configuration per plugin */
  pluginConfiguration: Record<string, Record<string, unknown>>;
}

// ============================================================================
// Persistence Types
// ============================================================================

/**
 * Specification revision for tracking artifact changes
 */
export interface Spec {
  /** Unique ID for this spec revision */
  revision_id: string;
  /** ID of the parent spec (null for root) */
  parent_revision_id?: string;
  /** Scope this spec applies to (e.g., 'packages/utils') */
  scope: string;
  /** Creation timestamp */
  timestamp: number;
  /** Config files that generated this spec */
  config_files?: string[];
}

/**
 * Log entry for artifact actions
 */
export interface ArtifactLogEntry {
  /** Unique ID for this log entry */
  id: string;
  /** Spec revision this action belongs to */
  spec_id: string;
  /** Name of the artifact */
  artifact_name: string;
  /** Type of the artifact */
  artifact_type: ArtifactType;
  /** Hash of the artifact content */
  artifact_hash: string;
  /** JSON stringified artifact data */
  artifact_data: string;
  /** JSON stringified provenance data */
  provenance_data?: string;
  /** JSON stringified confidence data */
  confidence_data?: string;
  /** Action type */
  action: ActionType;
  /** Timestamp of the action */
  timestamp: number;
}

/**
 * Possible actions in the artifact log
 */
export type ActionType = 'add' | 'remove';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Base error for importer detection operations
 */
export abstract class ImporterError extends Error {
  abstract readonly code: string;
  abstract readonly category: ErrorCategory;

  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Categories of errors
 */
export type ErrorCategory = 'plugin' | 'parsing' | 'inference' | 'filesystem' | 'configuration';

/**
 * Plugin execution error
 */
export class PluginError extends ImporterError {
  readonly code = 'PLUGIN_ERROR';
  readonly category = 'plugin' as const;

  constructor(
    public readonly pluginName: string,
    message: string,
    cause?: Error
  ) {
    super(`Plugin ${pluginName}: ${message}`, cause);
  }
}

/**
 * File parsing error
 */
export class ParseError extends ImporterError {
  readonly code = 'PARSE_ERROR';
  readonly category = 'parsing' as const;

  constructor(
    public readonly filePath: string,
    message: string,
    cause?: Error
  ) {
    super(`Failed to parse ${filePath}: ${message}`, cause);
  }
}

/**
 * Inference error
 */
export class InferenceError extends ImporterError {
  readonly code = 'INFERENCE_ERROR';
  readonly category = 'inference' as const;

  constructor(message: string, cause?: Error) {
    super(`Inference failed: ${message}`, cause);
  }
}

/**
 * File system error
 */
export class FileSystemError extends ImporterError {
  readonly code = 'FILESYSTEM_ERROR';
  readonly category = 'filesystem' as const;

  constructor(
    public readonly path: string,
    message: string,
    cause?: Error
  ) {
    super(`File system error at ${path}: ${message}`, cause);
  }
}

/**
 * Configuration error
 */
export class ConfigurationError extends ImporterError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly category = 'configuration' as const;

  constructor(message: string, cause?: Error) {
    super(`Configuration error: ${message}`, cause);
  }
}
