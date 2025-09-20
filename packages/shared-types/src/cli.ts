/**
 * Shared types for Arbiter CLI and API
 */

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
  severity: 'error';
}

export interface ValidationWarning {
  message: string;
  line?: number;
  column?: number;
  path?: string;
  severity: 'warning';
}

export interface ConfigEntry {
  key: string;
  value: string | number | boolean;
  description?: string;
}

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
export type ServiceType = 'bespoke' | 'prebuilt' | 'external';
export type DeploymentTarget = 'kubernetes' | 'compose' | 'both';

export interface ServiceConfig {
  name: string;
  serviceType: ServiceType;
  language: string;
  type: 'deployment' | 'statefulset' | 'daemonset' | 'job' | 'cronjob';

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
    type?: 'emptyDir' | 'persistentVolumeClaim' | 'configMap' | 'secret';
  }>;
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
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
}

export interface DeploymentConfig {
  target: DeploymentTarget;

  // Kubernetes configuration
  cluster?: {
    name: string;
    provider: 'kubernetes' | 'eks' | 'gke' | 'aks';
    context?: string;
    namespace: string;
    config?: Record<string, any>;
  };

  // Docker Compose configuration
  compose?: {
    version: '3.8' | '3.9';
    networks?: Record<string, any>;
    volumes?: Record<string, any>;
    profiles?: string[];
    environment?: Record<string, string>;
  };
}

export interface AssemblyConfig {
  config: {
    language: string;
    kind: string;
    buildTool?: string;
  };
  metadata: {
    name: string;
    description?: string;
    version: string;
  };
  deployment: DeploymentConfig;
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
    resolution: 'skip' | 'merge' | 'replace';
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
  output?: string;
  outputDir?: string;
  includeCi?: boolean;
  force?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  format?: 'auto' | 'json' | 'yaml' | 'typescript' | 'python' | 'rust' | 'go' | 'shell';
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
export interface IssueSpec {
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
  requiredFields: ['title', 'body'],
};

/** Issue validation result */
export interface IssueValidationResult {
  valid: boolean;
  errors: string[];
}

/** Validate an issue against the schema */
export function validateIssue(
  issue: Partial<IssueSpec>,
  config: IssueValidationConfig = DEFAULT_ISSUE_VALIDATION
): IssueValidationResult {
  const errors: string[] = [];

  // Check required fields
  for (const field of config.requiredFields) {
    if (!issue[field] || (typeof issue[field] === 'string' && issue[field]?.trim() === '')) {
      errors.push(`Field '${field}' is required`);
    }
  }

  // Validate title length
  if (issue.title && issue.title.length > config.maxTitleLength) {
    errors.push(`Title exceeds maximum length of ${config.maxTitleLength} characters`);
  }

  // Validate checklist structure if present
  if (issue.checklist) {
    issue.checklist.forEach((item, index) => {
      if (!item.id || typeof item.id !== 'string' || item.id.trim() === '') {
        errors.push(`Checklist item ${index} missing required 'id' field`);
      }
      if (!item.text || typeof item.text !== 'string' || item.text.trim() === '') {
        errors.push(`Checklist item ${index} missing required 'text' field`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/** Create a new issue with default structure */
export function createIssue(
  data: Pick<IssueSpec, 'title' | 'body'> & Partial<IssueSpec>
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
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
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
export type StateKind = 'visible' | 'hidden' | 'enabled' | 'disabled' | 'attached' | 'detached';
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
}

export interface ComponentsSpec {
  schemas?: Record<string, ComponentSchema>; // Names must match ^[A-Z][A-Za-z0-9]*$
}

// API path specifications
export interface PathOperation {
  request?: { $ref?: string; example?: any };
  response?: { $ref?: string; example?: any };
  status?: HTTPStatus;
}

export interface PathSpec {
  get?: { response: { $ref?: string; example?: any } };
  post?: PathOperation;
  put?: PathOperation;
  patch?: PathOperation;
  delete?: { response?: { $ref?: string; example?: any }; status?: HTTPStatus };
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

export interface FlowSpec {
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
      axe_severity_max?: 'minor' | 'moderate' | 'serious' | 'critical';
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

export interface FSMSpec {
  id: Slug;
  initial: Slug;
  states: Record<Slug, FSMState>;
}

// Complete App Specification
export interface AppSpec {
  product: ProductSpec;
  config?: {
    language?: string;
    [key: string]: any;
  };
  domain?: DomainSpec;
  components?: ComponentsSpec;
  paths?: Record<URLPath, PathSpec>;
  ui: UISpec;
  locators: Record<LocatorToken, CssSelector>;
  flows: FlowSpec[];
  services?: Record<string, ServiceConfig>;
  testability?: TestabilitySpec;
  ops?: OpsSpec;
  stateModels?: Record<Slug, FSMSpec>;
}

// Schema version detection and configuration
export interface SchemaVersion {
  version: 'v1' | 'app';
  detected_from: 'structure' | 'metadata' | 'default' | 'unified' | 'fallback';
}

export interface ConfigWithVersion {
  schema: SchemaVersion;
  v1?: AssemblyConfig;
  app?: AppSpec;
}
