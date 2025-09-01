/**
 * TypeScript interfaces for the CI/CD gates system
 * Defines core types for gate execution, configuration, and reporting
 */

export interface GateExecutionContext {
  /** Working directory for the execution */
  workingDirectory: string;
  /** Git commit SHA being validated */
  commitSha: string;
  /** Base commit SHA for comparison */
  baseSha?: string;
  /** Branch name */
  branch: string;
  /** Pull/merge request ID if applicable */
  pullRequestId?: string;
  /** CI/CD platform context */
  ciContext: CIPlatformContext;
  /** Changed files in this commit/PR */
  changedFiles: string[];
  /** Environment variables */
  environment: Record<string, string>;
}

export interface CIPlatformContext {
  /** Platform type */
  platform: 'github' | 'gitlab' | 'bitbucket' | 'azure-devops' | 'generic';
  /** API endpoint URL */
  apiUrl: string;
  /** Authentication token */
  token: string;
  /** Repository identifier */
  repository: string;
  /** Build/job ID */
  buildId: string;
}

export interface GateResult {
  /** Gate identifier */
  gateId: string;
  /** Gate display name */
  name: string;
  /** Execution status */
  status: GateStatus;
  /** Execution start time */
  startTime: Date;
  /** Execution end time */
  endTime: Date;
  /** Execution duration in milliseconds */
  duration: number;
  /** Detailed results */
  details: GateDetails;
  /** Error information if failed */
  error?: GateError;
  /** Metrics collected during execution */
  metrics: Record<string, number>;
}

export enum GateStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  ERROR = 'error'
}

export interface GateDetails {
  /** Summary message */
  summary: string;
  /** Detailed findings */
  findings: GateFinding[];
  /** Recommendations for improvement */
  recommendations: string[];
  /** Links to detailed reports */
  reportUrls: string[];
}

export interface GateFinding {
  /** Finding severity */
  severity: 'error' | 'warning' | 'info';
  /** Finding category */
  category: string;
  /** Finding message */
  message: string;
  /** File path if applicable */
  file?: string;
  /** Line number if applicable */
  line?: number;
  /** Column number if applicable */
  column?: number;
  /** Rule or check that triggered this finding */
  rule?: string;
}

export interface GateError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Detailed error information */
  details?: string;
  /** Stack trace */
  stack?: string;
}

export interface GateConfiguration {
  /** Gate identifier */
  id: string;
  /** Gate display name */
  name: string;
  /** Gate description */
  description: string;
  /** Whether gate is enabled */
  enabled: boolean;
  /** Gate execution mode */
  mode: GateMode;
  /** Gate-specific settings */
  settings: Record<string, any>;
  /** Dependencies on other gates */
  dependencies: string[];
  /** Timeout in milliseconds */
  timeout: number;
  /** Retry configuration */
  retry: RetryConfiguration;
}

export enum GateMode {
  /** Block merge on failure */
  BLOCKING = 'blocking',
  /** Warn on failure but don't block */
  WARNING = 'warning',
  /** Report only, no blocking or warnings */
  REPORTING = 'reporting'
}

export interface RetryConfiguration {
  /** Maximum number of retries */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  delay: number;
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;
}

export interface GateExecutionReport {
  /** Report ID */
  id: string;
  /** Execution timestamp */
  timestamp: Date;
  /** Execution context */
  context: GateExecutionContext;
  /** Overall execution status */
  status: GateStatus;
  /** Individual gate results */
  gateResults: GateResult[];
  /** Summary statistics */
  summary: ExecutionSummary;
  /** Quality score */
  qualityScore: number;
  /** Merge recommendation */
  mergeRecommendation: MergeRecommendation;
}

export interface ExecutionSummary {
  /** Total number of gates executed */
  totalGates: number;
  /** Number of gates that passed */
  passedGates: number;
  /** Number of gates that failed */
  failedGates: number;
  /** Number of gates with warnings */
  warningGates: number;
  /** Number of gates skipped */
  skippedGates: number;
  /** Total execution time */
  totalDuration: number;
}

export interface MergeRecommendation {
  /** Whether merge should be allowed */
  allowed: boolean;
  /** Reason for the recommendation */
  reason: string;
  /** Blocking issues that must be resolved */
  blockingIssues: string[];
  /** Warning issues to consider */
  warningIssues: string[];
  /** Override token if emergency merge is needed */
  overrideToken?: string;
}

export interface CoverageMetrics {
  /** Line coverage percentage */
  linesCovered: number;
  /** Branch coverage percentage */
  branchCovered: number;
  /** Function coverage percentage */
  functionsCovered: number;
  /** Statement coverage percentage */
  statementsCovered: number;
  /** Total lines */
  totalLines: number;
  /** Total branches */
  totalBranches: number;
  /** Total functions */
  totalFunctions: number;
  /** Total statements */
  totalStatements: number;
}

export interface QualityMetrics {
  /** Code complexity score */
  complexity: number;
  /** Maintainability index */
  maintainability: number;
  /** Technical debt ratio */
  technicalDebt: number;
  /** Duplication percentage */
  duplication: number;
  /** Security vulnerability count by severity */
  vulnerabilities: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

export interface TraceabilityMetrics {
  /** Percentage of requirements with scenarios */
  requirementCoverage: number;
  /** Percentage of scenarios with tests */
  scenarioCoverage: number;
  /** Percentage of tests with implementations */
  implementationCoverage: number;
  /** Number of orphaned artifacts */
  orphanedArtifacts: number;
  /** Number of broken links */
  brokenLinks: number;
}

export interface GatePlugin {
  /** Plugin identifier */
  id: string;
  /** Plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Execute the gate */
  execute(context: GateExecutionContext, config: GateConfiguration): Promise<GateResult>;
  /** Validate configuration */
  validateConfig(config: Record<string, any>): ValidationResult;
  /** Get default configuration */
  getDefaultConfig(): Record<string, any>;
}

export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: string[];
  /** Validation warnings */
  warnings: string[];
}

export interface OverrideRequest {
  /** Override reason */
  reason: string;
  /** Requestor information */
  requestor: string;
  /** Approval required */
  requiresApproval: boolean;
  /** Expiration time */
  expiresAt: Date;
  /** Override scope */
  scope: OverrideScope;
}

export interface OverrideScope {
  /** Repository */
  repository: string;
  /** Branch pattern */
  branches: string[];
  /** Gate IDs to override */
  gates: string[];
  /** Number of uses allowed */
  usesAllowed: number;
}

export interface HistoricalTrend {
  /** Date of measurement */
  date: Date;
  /** Quality score */
  qualityScore: number;
  /** Coverage percentage */
  coverage: number;
  /** Number of vulnerabilities */
  vulnerabilities: number;
  /** Build duration */
  buildDuration: number;
  /** Success rate */
  successRate: number;
}

export interface GateExecutor {
  /** Execute a single gate */
  executeGate(gate: GateConfiguration, context: GateExecutionContext): Promise<GateResult>;
  /** Validate gate configuration */
  validateConfiguration(config: GateConfiguration): ValidationResult;
  /** Check if gate should be skipped */
  shouldSkip(gate: GateConfiguration, context: GateExecutionContext): boolean;
}

export interface MergeBlocker {
  /** Block merge based on gate results */
  blockMerge(report: GateExecutionReport): Promise<void>;
  /** Unblock merge with override */
  overrideMerge(report: GateExecutionReport, override: OverrideRequest): Promise<void>;
  /** Get current merge status */
  getMergeStatus(context: GateExecutionContext): Promise<MergeStatus>;
}

export interface MergeStatus {
  /** Whether merge is blocked */
  blocked: boolean;
  /** Blocking reasons */
  reasons: string[];
  /** Override options */
  overrideOptions: OverrideOption[];
}

export interface OverrideOption {
  /** Override type */
  type: 'emergency' | 'hotfix' | 'approved' | 'administrative';
  /** Required permissions */
  permissions: string[];
  /** Approval required */
  requiresApproval: boolean;
}

export interface GateScheduler {
  /** Schedule gate execution */
  scheduleGates(gates: GateConfiguration[], context: GateExecutionContext): Promise<GateResult[]>;
  /** Execute gates in parallel where possible */
  executeParallel(gates: GateConfiguration[], context: GateExecutionContext): Promise<GateResult[]>;
  /** Execute gates sequentially with dependencies */
  executeSequential(gates: GateConfiguration[], context: GateExecutionContext): Promise<GateResult[]>;
}

export interface ReportGenerator {
  /** Generate HTML report */
  generateHtmlReport(report: GateExecutionReport): Promise<string>;
  /** Generate JSON report */
  generateJsonReport(report: GateExecutionReport): string;
  /** Generate markdown summary */
  generateMarkdownSummary(report: GateExecutionReport): string;
  /** Generate CI platform status */
  generateCIStatus(report: GateExecutionReport): CIStatusUpdate;
}

export interface CIStatusUpdate {
  /** Status check name */
  name: string;
  /** Status state */
  state: 'pending' | 'success' | 'failure' | 'error';
  /** Description */
  description: string;
  /** Target URL for details */
  targetUrl?: string;
}

export type GateFactory = (id: string) => GateExecutor | undefined;
export type ConfigurationProvider = () => Promise<GateConfiguration[]>;
export type MetricsCollector = (result: GateResult) => Promise<void>;