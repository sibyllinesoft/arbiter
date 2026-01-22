/**
 * Shared types for Arbiter CLI and API
 */

/**
 * Project structure configuration for directory layout
 *
 * @public
 */
export interface ProjectStructureConfig {
  /** Primary location for client-facing applications */
  clientsDirectory: string;
  /** Primary location for backend and API services */
  servicesDirectory: string;
  /** Shared packages and domain libraries */
  packagesDirectory: string;
  /** Developer tooling, CLIs, and automation scripts */
  toolsDirectory: string;
  /** Project documentation output */
  docsDirectory: string;
  /** Shared test suites and golden fixtures */
  testsDirectory: string;
  /** Infrastructure as code and deployment assets */
  infraDirectory: string;
  /** Flags that force certain artifact directories to live inside their owning package */
  packageRelative?: {
    docsDirectory?: boolean;
    testsDirectory?: boolean;
    infraDirectory?: boolean;
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  message: string;
  line?: number;
  column?: number;
  path?: string;
  severity: "error";
}

export interface ValidationWarning {
  message: string;
  line?: number;
  column?: number;
  path?: string;
  severity: "warning";
}

export interface ConfigEntry {
  key: string;
  value: string | number | boolean;
  description?: string;
}

// ---------- Entity Metadata ----------

/**
 * Base metadata for all tracked entities.
 * Enables UUID tracking across renames and timestamps for change history.
 *
 * @public
 */
export interface EntityMeta {
  /** Stable UUID identifier - persists across renames */
  entityId?: string;
  /** Creation timestamp (ISO 8601) */
  createdAt?: ISODateTime;
  /** Last modification timestamp (ISO 8601) */
  updatedAt?: ISODateTime;
}

/**
 * Entity types that support tracking with UUIDs and timestamps.
 *
 * @public
 */
export type TrackedEntityType =
  | "service"
  | "client"
  | "package"
  | "tool"
  | "group"
  | "endpoint"
  | "view"
  | "actor"
  | "capability"
  | "operation"
  | "flow"
  | "route"
  | "schema"
  | "database"
  | "issue"
  | "process"
  | "comment";

export interface TemplateInfo {
  name: string;
  description: string;
  files: string[];
  variables?: string[];
}

export interface ExportFormat {
  name: string;
  extension: string;
  description: string;
  mimeType?: string;
}

// CLI-specific types
export interface CliOptions {
  verbose?: boolean;
  quiet?: boolean;
  watch?: boolean;
  config?: string;
}

export interface CommandResult {
  success: boolean;
  message?: string;
  data?: unknown;
  exitCode: number;
}

// API Request/Response types from CLI
export interface AnalyzeRequest {
  text: string;
  projectId?: string;
  timeout?: number;
}

export interface AnalysisResult {
  valid: boolean;
  errors: Array<{
    message: string;
    path?: string;
    line?: number;
    column?: number;
  }>;
  output?: any;
  executionTime: number;
}

export interface CreateProject {
  name: string;
  description?: string;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationRequest {
  text?: string; // Added for compatibility
  files: string[];
  projectId?: string;
  config?: any;
}

// Enhanced deployment and service types
export type ServiceArtifactType = "internal" | "external";
export type ServiceWorkload = "deployment" | "statefulset" | "daemonset" | "job" | "cronjob";
export type DeploymentTarget = "kubernetes" | "compose" | "both";

export type DependencyKind =
  | "service"
  | "database"
  | "cache"
  | "queue"
  | "search"
  | "message-bus"
  | "external"
  | string;

export interface ServiceDependencySpec {
  /** Unique name of the dependency within this artifact */
  name?: string; // optional for backward compatibility
  /** Optional bucket/type so dependencies can be grouped */
  type?: DependencyKind;
  /** Target identifier (service key, resource name, external handle) */
  target?: string;
  /** Legacy field kept for compatibility with older specs */
  service?: string;
  version?: string;
  kind?: string; // e.g., "postgres", "redis"
  optional?: boolean;
  contractRef?: string;
  description?: string;
}

export type DependencyGroups = Record<string, ServiceDependencySpec[]>;

export interface ExternalResourceSpec {
  kind: string; // e.g., "database", "cache", "queue"
  engine?: string; // e.g., "postgres", "redis"
  version?: string;
  tier?: string; // e.g., "standard", "enterprise"
  size?: string; // e.g., "db.m6i.large"
  backup?: {
    enabled?: boolean;
    retentionDays?: number;
    window?: string;
    multiRegion?: boolean;
  };
  maintenance?: {
    window?: string;
  };
  endpoints?: Record<string, string>;
  notes?: string;
}

export interface ServiceConfig extends EntityMeta {
  name: string;
  /** Whether this is an external/third-party service */
  external?: boolean;
  /** C4/grouping kind - defaults to "service", can be "container", "component", etc. */
  kind?: string;
  /** Arbitrary metadata for context-specific properties */
  metadata?: Record<string, unknown>;
  source?: ServiceSourceConfig;
  workload?: ServiceWorkload;
  language: string;
  // Platform compatibility: optional platform-specific identifiers (e.g., cloudflare_worker)
  serviceType?: string;
  // Image and build configuration
  image?: string;
  sourceDirectory?: string;
  buildContext?: {
    dockerfile?: string;
    buildArgs?: Record<string, string>;
    target?: string;
  };

  // Runtime configuration
  replicas?: number;
  ports?: Array<{
    name: string;
    port: number;
    targetPort?: number;
    protocol?: string;
  }>;
  env?: Record<string, string>;
  volumes?: Array<{
    name: string;
    path: string;
    size?: string;
    type?: "emptyDir" | "persistentVolumeClaim" | "configMap" | "secret";
  }>;
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
  healthCheck?: {
    path?: string;
    port?: number;
    protocol?: string;
    interval?: string;
    timeout?: string;
    initialDelay?: number;
    periodSeconds?: number;
  };

  // Enhanced configuration management
  config?: {
    files?: Array<{
      name: string;
      path: string;
      content: string | Record<string, any>;
      configMap?: boolean;
    }>;
    secrets?: Array<{
      name: string;
      key: string;
      value?: string;
      external?: string;
    }>;
  };

  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  endpoints?: Record<Slug, ServiceEndpointSpec>;
  resource?: ExternalResourceSpec;
  /**
   * Grouped dependencies by type/bucket (preferred). Legacy shapes are still accepted for backwards compatibility.
   */
  dependencies?: DependencyGroups | Record<string, ServiceDependencySpec> | string[];
  /** Group this service belongs to */
  memberOf?: string;
}

export interface ServiceDeploymentOverride {
  replicas?: number;
  image?: string;
  env?: Record<string, string>;
  config?: ServiceConfig["config"];
  resources?: ServiceConfig["resources"];
  volumes?: ServiceConfig["volumes"];
  annotations?: Record<string, string>;
  labels?: Record<string, string>;
  healthCheck?: ServiceConfig["healthCheck"];
  dependsOn?: string[];
  extensions?: Record<string, unknown>;
}

export type ServiceSourceConfig =
  | { kind: "monorepo"; directory: string; packageManager?: string }
  | { kind: "container"; image: string; registry?: string }
  | { kind: "repository"; url: string; branch?: string; commit?: string }
  | { kind: "package"; name: string; version?: string; registry?: string }
  | { kind: "managed"; provider: string; product?: string; plan?: string }
  | { kind: "url"; url: string };

export interface MiddlewareReference {
  name?: Human;
  /**
   * Optional file path for brownfield/spec-sync scenarios. When omitted the generator derives paths
   * from the project structure instead of hard-coding directories in the spec itself.
   */
  module?: string;
  function?: string;
  phase?: "request" | "response" | "both";
  config?: Record<string, unknown>;
}

export interface ModuleHandlerReference {
  type: "module";
  /** Optional override for the concrete module location when linking to pre-existing code. */
  module?: string;
  function?: string;
}

export interface EndpointHandlerReference {
  type: "endpoint";
  service: string;
  endpoint: Slug;
}

export type HandlerReference = ModuleHandlerReference | EndpointHandlerReference;

export interface ServiceEndpointSpec {
  description?: string;
  path: string;
  methods: HTTPMethod[];
  handler: HandlerReference;
  implements: string;
  middleware?: MiddlewareReference[];
}

export interface DeploymentConfig {
  target: DeploymentTarget;
  environment?: string;

  // Kubernetes configuration
  cluster?: {
    name: string;
    provider: "kubernetes" | "eks" | "gke" | "aks";
    context?: string;
    namespace: string;
    config?: Record<string, any>;
  };

  // Docker Compose configuration
  compose?: {
    version?: string;
    networks?: Record<string, any>;
    volumes?: Record<string, any>;
    profiles?: string[];
    environment?: Record<string, string>;
  };

  services?: Record<string, ServiceDeploymentOverride>;
}

export interface AssemblyConfig {
  config: {
    language?: string;
    buildTool?: string;
  };
  metadata: {
    name: string;
    description?: string;
    version: string;
  };
  environments?: Record<string, DeploymentConfig>;
  /**
   * @deprecated use environments
   */
  deployments?: Record<string, DeploymentConfig>;
  services: Record<string, ServiceConfig>;
}

// Test composition types
export interface TestCase {
  name: string;
  namespace: string;
  description?: string;
  steps: TestStep[];
  metadata?: {
    generated?: boolean;
    source?: string;
    lastModified?: string;
  };
}

export interface TestStep {
  action: string;
  params?: Record<string, any>;
  expected?: any;
}

export interface TestSuite {
  name: string;
  namespace: string;
  cases: TestCase[];
  setup?: TestStep[];
  teardown?: TestStep[];
}

export interface TestCompositionResult {
  merged: TestSuite[];
  conflicts: Array<{
    test: string;
    reason: string;
    resolution: "skip" | "merge" | "replace";
  }>;
  generated: TestCase[];
  preserved: TestCase[];
}

export interface ValidationResponse {
  valid: boolean;
  success: boolean; // Added for compatibility
  warnings?: ValidationWarning[]; // Added for compatibility
  errors: Array<{
    message: string;
    path?: string;
    line?: number;
    column?: number;
  }>;
  results?: any;
}

export interface IRResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// Generation options for enhanced functionality
export interface EnhancedGenerateOptions {
  projectDir?: string;
  includeCi?: boolean;
  force?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  format?: "auto" | "json" | "yaml" | "typescript" | "python" | "rust" | "go" | "shell";
  spec?: string;

  // Enhanced options
  deploymentTarget?: DeploymentTarget;
  skipTests?: boolean;
  mergeTests?: boolean;
  testNamespace?: string;
  composeFile?: string;
}

// =============================================================================
// ISSUE SCHEMA SPECIFICATION
// =============================================================================

// Exact issue schema specification with clean, standardized approach
export interface IssueSpec extends EntityMeta {
  /** Title of the issue - required, max 255 characters */
  title: string;
  /** Body content with Markdown and templating support - required */
  body: string;
  /** Semantic labels that map to GitHub/GitLab labels - optional */
  labels?: string[];
  /** Acceptance criteria - optional */
  acceptance_criteria?: string[];
  /** Checklist items with proper structure - optional */
  checklist?: ChecklistItem[];
  /** Related links - optional */
  links?: string[];
}

/** Checklist item structure */
export interface ChecklistItem {
  /** Unique identifier for the checklist item */
  id: string;
  /** Display text for the checklist item */
  text: string;
  /** Whether the item is completed - optional, defaults to false */
  done?: boolean;
}

/** Issue validation configuration */
export interface IssueValidationConfig {
  /** Maximum allowed title length */
  maxTitleLength: number;
  /** Required fields */
  requiredFields: (keyof IssueSpec)[];
}

/** Default issue validation configuration */
export const DEFAULT_ISSUE_VALIDATION: IssueValidationConfig = {
  maxTitleLength: 255,
  requiredFields: ["title", "body"],
};

/** Issue validation result */
export interface IssueValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate required fields on an issue
 */
function validateRequiredFields(
  issue: Partial<IssueSpec>,
  requiredFields: (keyof IssueSpec)[],
): string[] {
  const errors: string[] = [];
  for (const field of requiredFields) {
    const value = issue[field];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      errors.push(`Field '${field}' is required`);
    }
  }
  return errors;
}

/**
 * Validate title length
 */
function validateTitleLength(title: string | undefined, maxLength: number): string[] {
  if (title && title.length > maxLength) {
    return [`Title exceeds maximum length of ${maxLength} characters`];
  }
  return [];
}

/**
 * Validate a single checklist item
 */
function validateChecklistItem(item: ChecklistItem, index: number): string[] {
  const errors: string[] = [];
  if (!item.id || typeof item.id !== "string" || item.id.trim() === "") {
    errors.push(`Checklist item ${index} missing required 'id' field`);
  }
  if (!item.text || typeof item.text !== "string" || item.text.trim() === "") {
    errors.push(`Checklist item ${index} missing required 'text' field`);
  }
  return errors;
}

/**
 * Validate checklist structure
 */
function validateChecklist(checklist: ChecklistItem[] | undefined): string[] {
  if (!checklist) return [];
  return checklist.flatMap((item, index) => validateChecklistItem(item, index));
}

/** Validate an issue against the schema */
export function validateIssue(
  issue: Partial<IssueSpec>,
  config: IssueValidationConfig = DEFAULT_ISSUE_VALIDATION,
): IssueValidationResult {
  const errors: string[] = [
    ...validateRequiredFields(issue, config.requiredFields),
    ...validateTitleLength(issue.title, config.maxTitleLength),
    ...validateChecklist(issue.checklist),
  ];

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** Create a new issue with default structure */
export function createIssue(
  data: Pick<IssueSpec, "title" | "body"> & Partial<IssueSpec>,
): IssueSpec {
  return {
    title: data.title,
    body: data.body,
    labels: data.labels || [],
    acceptance_criteria: data.acceptance_criteria || [],
    checklist: data.checklist || [],
    links: data.links || [],
  };
}

/** Create a checklist item with proper structure */
export function createChecklistItem(text: string, done = false): ChecklistItem {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    text,
    done,
  };
}

// =============================================================================
// APP SPECIFICATION TYPES
// =============================================================================
// Types for the app-centric schema format

// Core primitives matching CUE definitions
export type Slug = string; // Pattern: ^[a-z0-9]+(?:[._-][a-z0-9]+)*$
export type Human = string; // Non-empty human-readable label
export type Email = string; // Pattern: ^[^@\s]+@[^@\s]+\.[^@\s]+$
export type ISODateTime = string; // Pattern: ^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$
export type URLPath = string; // Pattern: ^/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*$
export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type HTTPStatus = number; // 100-599

// Domain tokens
export type RouteID = string; // Pattern: ^[a-z0-9]+(?::[a-z0-9_-]+)+$ (e.g., invoices:detail)
export type Cap = Slug; // Capability (e.g., approve)
export type Role = Slug; // Role (e.g., manager)

// Locator contract
export type LocatorToken = string; // Pattern: ^[a-z]+:[a-z0-9_-]+$ (e.g., btn:approve)
export type CssSelector = string; // Non-empty single-line selector

// Flow types
export type FlowID = Slug;
export type StateKind = "visible" | "hidden" | "enabled" | "disabled" | "attached" | "detached";
export type FactoryName = Slug;

export interface TextMatch {
  eq?: string;
  contains?: string;
  regex?: string;
}

export interface ExpectUI {
  locator: LocatorToken;
  state?: StateKind;
  text?: TextMatch;
}

export interface ExpectAPI {
  method: HTTPMethod;
  path: URLPath;
  status: HTTPStatus;
  bodyExample?: any;
  headers?: Record<string, string>;
}

export interface HttpMediaType {
  schema?: any;
  schemaRef?: string;
  example?: any;
}

export type HttpContent = Record<string, HttpMediaType>;

export interface HttpRequestBody {
  description?: string;
  required?: boolean;
  content: HttpContent;
}

export interface HttpResponse {
  description: string;
  headers?: Record<string, unknown>;
  content?: HttpContent;
}

export interface HttpParameter {
  name: string;
  in: "path" | "query" | "header" | "cookie";
  description?: string;
  required?: boolean;
  schema?: any;
  schemaRef?: string;
  deprecated?: boolean;
  example?: any;
}

export interface Seed {
  factory: FactoryName;
  as: Slug;
  with?: any;
}

// Product specification
export interface ProductSpec {
  name: Human;
  goals?: Human[];
  constraints?: Human[];
  roles?: Role[];
  slos?: {
    p95_page_load_ms?: number;
    uptime?: string; // e.g., "99.9%"
  };
}

// Domain specification
export interface DomainSpec {
  enums?: Record<Slug, Slug[]>; // e.g., InvoiceStatus: ["DRAFT","APPROVED","SENT"]
  permissions?: Record<Cap, Role[]>; // e.g., approve: ["manager","admin"]
}

// Component schemas (OpenAPI-like)
export interface ComponentSchema {
  example: any;
  examples?: any[];
  rules?: any;
  schemaFormat?: "json" | "cue";
  cue?: string;
  cueFile?: string;
}

export interface ComponentsSpec {
  schemas?: Record<string, ComponentSchema>; // Names must match ^[A-Z][A-Za-z0-9]*$
}

// API path specifications
export type AssertionSeverity = "error" | "warn" | "info";

export interface CueAssertionObject {
  assert: boolean;
  message?: Human;
  severity?: AssertionSeverity;
  tags?: Slug[];
}

export type CueAssertion = boolean | CueAssertionObject;

export type CueAssertionBlock = Record<Slug, CueAssertion>;

export interface PathOperation {
  operationId?: string;
  summary?: string | null;
  description?: string | null;
  tags?: string[];
  deprecated?: boolean;
  parameters?: HttpParameter[];
  requestBody?: HttpRequestBody;
  responses: Record<string, HttpResponse>;
  assertions?: CueAssertionBlock;
}

export interface PathSpec {
  get?: PathOperation;
  post?: PathOperation;
  put?: PathOperation;
  patch?: PathOperation;
  delete?: PathOperation;
}

// UI specification
export interface UIRoute {
  id: RouteID;
  path: URLPath;
  capabilities: Cap[];
  components?: Human[];
}

export interface UISpec {
  routes: UIRoute[];
}

// Flow specification
export interface FlowStep {
  visit?: string | RouteID;
  click?: LocatorToken;
  fill?: { locator: LocatorToken; value: string };
  expect?: ExpectUI;
  expect_api?: ExpectAPI;
}

export interface FlowVariant {
  name: Slug;
  override?: any;
}

export interface FlowSpec extends EntityMeta {
  id: FlowID;
  preconditions?: {
    role?: Role;
    seed?: Seed[];
    env?: Slug;
  };
  steps: FlowStep[];
  variants?: FlowVariant[];
}

// Testability specification
export interface TestabilitySpec {
  network?: {
    stub?: boolean;
    passthrough?: URLPath[];
  };
  clock?: {
    fixed?: ISODateTime;
  };
  seeds?: {
    factories?: Record<FactoryName, any>;
  };
  quality_gates?: {
    a11y?: {
      axe_severity_max?: "minor" | "moderate" | "serious" | "critical";
    };
    perf?: {
      p95_nav_ms_max?: number;
    };
  };
}

// Ops specification
export interface OpsSpec {
  feature_flags?: Slug[];
  environments?: Slug[];
  security?: {
    auth?: Slug;
    scopes?: Slug[];
  };
}

// State model specification (XState-like)
export interface FSMState {
  on?: Record<Slug, Slug>;
}

export interface FSMSpec extends EntityMeta {
  id: Slug;
  initial: Slug;
  states: Record<Slug, FSMState>;
}

export interface CapabilitySpec extends EntityMeta {
  name?: Human;
  description?: string;
  owner?: Human;
  gherkin?: string;
  depends_on?: Cap[];
  tags?: Slug[];
}

/**
 * Relationship type - open-ended to support various contexts.
 * Common values: uses, depends_on, calls, reads, writes, authenticates, notifies
 *
 * @public
 */
export type RelationshipType = Slug;

/**
 * Explicit connection between entities.
 * Complements implicit relationships derived from dependencies and handler refs.
 *
 * @public
 */
export interface RelationshipSpec extends EntityMeta {
  /** Source entity slug (service, client, package, actor, group) */
  from: Slug;
  /** Target entity slug */
  to: Slug;
  /** Human-readable description of the relationship */
  label?: string;
  /** Detailed description */
  description?: string;
  /** Relationship semantics (uses, depends_on, calls, reads, writes, etc.) */
  type?: RelationshipType;
  /** Technology or protocol (e.g., "HTTPS/JSON", "gRPC", "PostgreSQL", "AMQP") */
  technology?: string;
  /** Whether the relationship is bidirectional */
  bidirectional?: boolean;
  /** Tags for filtering/categorization */
  tags?: Slug[];
}

// Complete App Specification
export interface AppSpec {
  product: ProductSpec;
  config?: {
    [key: string]: any;
  };
  capabilities?: Record<Slug, CapabilitySpec>;
  resources?: Record<string, any> | any[];
  operations?: Record<string, OperationSpec>;
  behaviors: FlowSpec[];
  services?: Record<string, ServiceConfig>;
  clients?: Record<string, ClientConfig>;
  /** Reusable packages/libraries */
  packages?: Record<string, PackageConfig>;
  /** Developer tooling and automation */
  tools?: Record<string, ToolConfig>;
  /** Artifact groups for organizing related artifacts */
  groups?: Record<string, GroupSpec>;
  environments?: Record<string, DeploymentConfig>;
  testability?: TestabilitySpec;
  ops?: OpsSpec;
  processes?: Record<Slug, FSMSpec>;
  /**
   * @deprecated use processes
   */
  stateModels?: Record<Slug, FSMSpec>;
  /**
   * @deprecated use environments
   */
  deployments?: Record<string, DeploymentConfig>;
  /**
   * @deprecated use environments
   */
  deployment?: DeploymentConfig;
  /**
   * @deprecated use resources
   */
  components?: ComponentsSpec;
  /**
   * @deprecated use resources
   */
  paths?: Record<string, Record<URLPath, PathSpec>>;
  /**
   * @deprecated use resources
   */
  ui?: UISpec;
  /**
   * @deprecated use resources
   */
  locators?: Record<LocatorToken, CssSelector>;
  /**
   * @deprecated use resources
   */
  enums?: Record<Slug, Slug[]>;
  /**
   * @deprecated use resources
   */
  permissions?: Record<Cap, Role[]>;
  tests?: any[];
  epics?: any[];
  docs?: any;
  security?: any;
  performance?: any;
  observability?: any;
  data?: any;
  metadata?: Record<string, unknown>;
  /** Explicit relationships between entities (complements implicit deps) */
  relationships?: Record<Slug, RelationshipSpec>;
  /** Work items tracking spec changes */
  issues?: Record<Slug, IssueConfig>;
  /** Comments attached to entities (discussions, agent guidance, memory) */
  comments?: Record<Slug, CommentConfig>;
}

export interface OperationSpec extends EntityMeta {
  id?: string;
  version?: string;
  description?: string;
  tags?: string[];
  deprecated?: boolean;
  parameters?: any[];
  requestBody?: any;
  responses: Record<string, any>;
  assertions?: any;
}

// Schema version detection and configuration
export interface SchemaVersion {
  version: "app";
  detected_from: "structure" | "metadata" | "default" | "unified" | "fallback";
}

export interface ConfigWithVersion {
  schema: SchemaVersion;
  app: AppSpec;
}

/**
 * View/route specification within a client application (component level).
 *
 * @public
 */
export interface ClientViewSpec extends EntityMeta {
  /** Human-readable description */
  description?: string;
  /** Route path pattern (e.g., "/users/:id") */
  path?: string;
  /** Route identifier (e.g., "users:detail") */
  route?: string;
  /** Component/page that renders this view */
  component?: string;
  /** Required capabilities/permissions */
  requires?: string[];
  /** Tags for filtering */
  tags?: string[];
}

export interface ClientConfig extends EntityMeta {
  language: string;
  template?: string;
  framework?: string;
  sourceDirectory?: string;
  description?: string;
  /** C4/grouping kind - defaults to "client", can be "container", "component", etc. */
  kind?: string;
  /** Arbitrary metadata for context-specific properties */
  metadata?: Record<string, unknown>;
  tags?: string[];
  port?: number;
  env?: Record<string, string>;
  hooks?: string[];
  /** Component-level children (views/routes) */
  views?: Record<Slug, ClientViewSpec>;
  /** Group this client belongs to */
  memberOf?: string;
}

/**
 * Configuration for a reusable package/library.
 *
 * @public
 */
export interface PackageConfig extends EntityMeta {
  name?: string;
  description?: string;
  /** C4/grouping kind - defaults to "package", can be "component", "library", etc. */
  kind?: string;
  /** Arbitrary metadata for context-specific properties */
  metadata?: Record<string, unknown>;
  language?: string;
  template?: string;
  sourceDirectory?: string;
  tags?: string[];
  /** Group this package belongs to */
  memberOf?: string;
}

/**
 * Configuration for developer tooling and automation.
 *
 * @public
 */
export interface ToolConfig extends EntityMeta {
  name?: string;
  description?: string;
  /** C4/grouping kind - defaults to "tool" */
  kind?: string;
  /** Arbitrary metadata for context-specific properties */
  metadata?: Record<string, unknown>;
  language?: string;
  template?: string;
  sourceDirectory?: string;
  tags?: string[];
  /** Group this tool belongs to */
  memberOf?: string;
}

/**
 * Group type/kind - open-ended to support context-specific groupings.
 * Common sync values: group, milestone, epic, release, sprint, iteration
 * Architecture values: system, container, component, domain, layer, boundary
 *
 * @public
 */
export type GroupType = string;

/**
 * Group status for milestone/epic tracking.
 *
 * @public
 */
export type GroupStatus = "open" | "closed" | "active";

/**
 * Configuration for an artifact group used to organize related artifacts.
 *
 * Milestones (GitHub), epics (GitLab/Jira), and releases are represented as groups
 * with the appropriate `kind` field. Architecture levels (system, container, component)
 * also use `kind` for C4-style views.
 *
 * @public
 */
export interface GroupSpec extends EntityMeta {
  /** Display name of the group */
  name: string;
  /** Description of what this group contains */
  description?: string;
  /**
   * Group kind - identifies what this group represents
   * Sync: group, milestone, epic, release, sprint, iteration
   * Architecture: system, container, component, domain, layer, boundary
   */
  kind?: GroupType;
  /** Arbitrary metadata for context-specific properties */
  metadata?: Record<string, unknown>;
  /** Override directory name (defaults to slugified name) */
  directory?: string;
  /** Tags for filtering/categorization */
  tags?: string[];
  /** Override project structure within this group */
  structure?: Partial<ProjectStructureConfig>;
  /** Parent group (for nested groups) */
  memberOf?: string;
  /** Due date for milestone/release groups */
  due?: ISODateTime;
  /** Group status */
  status?: GroupStatus;

  // ---------- External Source Tracking ----------
  /** Where this group originated (local spec or external system) */
  source?: ExternalSource;
  /** External system ID (e.g., GitHub milestone number, GitLab epic ID) */
  externalId?: string;
  /** Full URL to the group in the external system */
  externalUrl?: string;
  /** Repository or project in the external system */
  externalRepo?: string;
}

/**
 * Issue priority levels.
 *
 * @public
 */
export type IssuePriority = "critical" | "high" | "medium" | "low";

/**
 * Issue workflow status.
 *
 * @public
 */
export type IssueStatus =
  | "open"
  | "in_progress"
  | "blocked"
  | "review"
  | "done"
  | "closed"
  | "wontfix";

/**
 * Reference to another entity.
 *
 * @public
 */
export interface EntityRef {
  /** Entity type (e.g., "service", "endpoint") */
  type: TrackedEntityType;
  /** Entity identifier (UUID or slug) */
  id: string;
}

/**
 * External system source types.
 *
 * @public
 */
export type ExternalSource = "local" | "github" | "gitlab" | "jira" | "linear";

/**
 * Issue type for categorization (compatible with GitHub/GitLab/Jira).
 *
 * @public
 */
export type IssueType =
  | "issue"
  | "bug"
  | "feature"
  | "task"
  | "epic"
  | "milestone"
  | "story"
  | "spike";

/**
 * Configuration for a trackable work item (issue, epic, etc.).
 *
 * Compatible with GitHub Issues, GitLab Issues, and Jira for bidirectional sync.
 *
 * @public
 */
export interface IssueConfig extends EntityMeta {
  /** Issue title (required) */
  title: string;
  /** Detailed description of the issue */
  description?: string;
  /** Issue type/category */
  type?: IssueType;
  /** Current workflow status */
  status?: IssueStatus;
  /** Priority level */
  priority?: IssuePriority;
  /** References to other entities this issue relates to */
  references?: EntityRef[];
  /** People or teams responsible (supports multiple assignees like GitHub/GitLab) */
  assignees?: string[];
  /** Labels for categorization (maps to GitHub labels, GitLab labels) */
  labels?: string[];
  /** Due date in ISO format */
  due?: ISODateTime;
  /** Creation timestamp */
  created?: ISODateTime;
  /** Last update timestamp */
  updated?: ISODateTime;
  /** Closed/completed timestamp */
  closedAt?: ISODateTime;
  /** Parent issue for hierarchical tracking (epic/story relationship) */
  parent?: string;
  /** Milestone this issue belongs to (maps to GitHub milestone, GitLab milestone) */
  milestone?: string;
  /** Related issues */
  related?: Array<{
    issue: string;
    type: "blocks" | "blocked-by" | "duplicates" | "related-to";
  }>;
  /** Group this issue belongs to */
  memberOf?: string;

  // ---------- Estimation & Tracking ----------
  /** Story points / weight (GitLab weight, Jira story points) */
  weight?: number;
  /** Time estimate in hours */
  estimate?: number;
  /** Time spent in hours */
  timeSpent?: number;

  // ---------- External Source Tracking ----------
  /** Where this issue originated (local spec or external system) */
  source?: ExternalSource;
  /** External system issue ID (e.g., GitHub issue number "123", Jira key "PROJ-123") */
  externalId?: string;
  /** Full URL to the issue in the external system */
  externalUrl?: string;
  /** Repository or project in the external system (e.g., "owner/repo") */
  externalRepo?: string;
}

/**
 * Comment purpose/category.
 *
 * @public
 */
export type CommentKind = "discussion" | "guidance" | "memory" | "decision" | "note";

/**
 * Configuration for a comment attached to entities in the spec.
 *
 * Comments serve multiple purposes:
 * 1. Human discussions: Notes, feedback, and commentary on issues/epics/entities
 * 2. Agent guidance: Additional context beyond description fields to guide code generation
 * 3. Knowledge graph: Memory storage for AI agents to persist context and decisions
 *
 * @public
 */
export interface CommentConfig extends EntityMeta {
  /** Comment content (markdown supported) */
  content: string;
  /** Entity this comment is attached to (entity UUID or slug) */
  target: string;
  /** Type of target entity (e.g., "issue", "service", "endpoint") */
  targetType?: TrackedEntityType;
  /** Author of the comment */
  author?: string;
  /** Optional thread ID for grouping related comments */
  threadId?: string;
  /** Parent comment ID for nested replies */
  parentId?: string;
  /** Comment purpose/category */
  kind?: CommentKind;
  /** Tags for filtering/categorization */
  tags?: string[];
  /** Timestamp when comment was created */
  created?: ISODateTime;
  /** Timestamp when comment was last edited */
  edited?: ISODateTime;
  /** Whether this comment is resolved/archived */
  resolved?: boolean;

  // ---------- External Source Tracking ----------
  /** Where this comment originated (local spec or external system) */
  source?: ExternalSource;
  /** External system comment ID */
  externalId?: string;
  /** Full URL to the comment in the external system */
  externalUrl?: string;
}
