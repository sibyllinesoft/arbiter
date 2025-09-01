/**
 * TypeScript interfaces and types for the Arbiter traceability system
 * 
 * This module defines the core data structures for tracking relationships
 * between requirements, scenarios, tests, and code artifacts following
 * the Rails & Guarantees methodology.
 */

export type ArtifactType = 'requirement' | 'scenario' | 'test' | 'code';
export type LinkType = 'implements' | 'tests' | 'validates' | 'derives_from' | 'references';
export type ChangeType = 'added' | 'modified' | 'deleted' | 'moved';

/**
 * Base interface for all traceable artifacts
 */
export interface Artifact {
  /** Unique identifier for the artifact */
  id: string;
  /** Type of the artifact */
  type: ArtifactType;
  /** Human-readable name */
  name: string;
  /** Detailed description */
  description?: string;
  /** File path where the artifact is defined */
  filePath: string;
  /** Location within the file (line numbers, etc.) */
  location: Location;
  /** Hash of the artifact content for change detection */
  contentHash: string;
  /** Timestamp when artifact was last modified */
  lastModified: Date;
  /** Optional tags for categorization */
  tags: string[];
  /** Custom metadata */
  metadata: Record<string, unknown>;
}

/**
 * Location information within a file
 */
export interface Location {
  /** Starting line number (1-based) */
  startLine: number;
  /** Ending line number (1-based) */
  endLine: number;
  /** Starting column number (1-based, optional) */
  startColumn?: number;
  /** Ending column number (1-based, optional) */
  endColumn?: number;
  /** Byte offset in file (optional) */
  byteOffset?: number;
  /** Length in bytes (optional) */
  byteLength?: number;
}

/**
 * Requirement artifact representing a business or system requirement
 */
export interface Requirement extends Artifact {
  type: 'requirement';
  /** Priority level */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Requirement category */
  category: string;
  /** Source of the requirement (e.g., contract, specification) */
  source: string;
  /** Acceptance criteria */
  acceptanceCriteria: string[];
  /** Business value or rationale */
  businessValue?: string;
  /** Compliance or regulatory information */
  compliance?: string[];
}

/**
 * Scenario artifact representing behavior scenarios
 */
export interface Scenario extends Artifact {
  type: 'scenario';
  /** Scenario type (functional, non-functional, edge case, etc.) */
  scenarioType: string;
  /** Given-When-Then structure */
  given: string[];
  when: string[];
  then: string[];
  /** Examples or test data */
  examples?: Record<string, unknown>[];
  /** Expected outcomes */
  expectedOutcomes: string[];
}

/**
 * Test artifact representing test cases and suites
 */
export interface Test extends Artifact {
  type: 'test';
  /** Test framework used */
  framework: string;
  /** Test type (unit, integration, e2e, property-based) */
  testType: string;
  /** Test status */
  status: 'passing' | 'failing' | 'pending' | 'skipped';
  /** Test execution time in milliseconds */
  executionTime?: number;
  /** Coverage information */
  coverage?: Coverage;
  /** Test assertions */
  assertions: string[];
}

/**
 * Code artifact representing implementation code
 */
export interface Code extends Artifact {
  type: 'code';
  /** Programming language */
  language: string;
  /** Code type (function, class, module, etc.) */
  codeType: string;
  /** Function/method signatures */
  signatures?: string[];
  /** Dependencies */
  dependencies: string[];
  /** Complexity metrics */
  complexity?: ComplexityMetrics;
  /** Documentation coverage */
  documentationCoverage?: number;
}

/**
 * Coverage information for tests
 */
export interface Coverage {
  /** Line coverage percentage */
  lines: number;
  /** Branch coverage percentage */
  branches: number;
  /** Function coverage percentage */
  functions: number;
  /** Statement coverage percentage */
  statements: number;
}

/**
 * Code complexity metrics
 */
export interface ComplexityMetrics {
  /** Cyclomatic complexity */
  cyclomatic: number;
  /** Halstead complexity */
  halstead?: number;
  /** Lines of code */
  linesOfCode: number;
  /** Maintainability index */
  maintainability?: number;
}

/**
 * Link between artifacts representing traceability relationships
 */
export interface TraceabilityLink {
  /** Unique identifier for the link */
  id: string;
  /** Source artifact ID */
  sourceId: string;
  /** Target artifact ID */
  targetId: string;
  /** Type of relationship */
  linkType: LinkType;
  /** Link strength/confidence (0-1) */
  strength: number;
  /** Whether link was automatically detected or manually created */
  isAutomatic: boolean;
  /** Timestamp when link was created */
  createdAt: Date;
  /** Timestamp when link was last validated */
  lastValidated?: Date;
  /** Additional context or reasoning for the link */
  context?: string;
  /** Custom metadata */
  metadata: Record<string, unknown>;
}

/**
 * Traceability graph containing all artifacts and their relationships
 */
export interface TraceabilityGraph {
  /** All artifacts in the graph */
  artifacts: Map<string, Artifact>;
  /** All links in the graph */
  links: Map<string, TraceabilityLink>;
  /** Index of links by source artifact */
  linksBySource: Map<string, Set<string>>;
  /** Index of links by target artifact */
  linksByTarget: Map<string, Set<string>>;
  /** Index of artifacts by type */
  artifactsByType: Map<ArtifactType, Set<string>>;
  /** Index of artifacts by file path */
  artifactsByFile: Map<string, Set<string>>;
  /** Graph metadata */
  metadata: GraphMetadata;
}

/**
 * Metadata for the traceability graph
 */
export interface GraphMetadata {
  /** Timestamp when graph was created */
  createdAt: Date;
  /** Timestamp when graph was last updated */
  lastUpdated: Date;
  /** Version of the graph schema */
  version: string;
  /** Source directories analyzed */
  sourcePaths: string[];
  /** Configuration used for analysis */
  configuration: TraceabilityConfig;
}

/**
 * Configuration for traceability analysis
 */
export interface TraceabilityConfig {
  /** File patterns to include */
  includePatterns: string[];
  /** File patterns to exclude */
  excludePatterns: string[];
  /** Parsing configuration for different file types */
  parsers: Record<string, ParserConfig>;
  /** Link detection rules */
  linkRules: LinkRule[];
  /** Annotation patterns */
  annotationPatterns: AnnotationPattern[];
  /** Minimum confidence threshold for automatic links */
  minLinkConfidence: number;
  /** Enable/disable specific analysis features */
  features: FeatureFlags;
}

/**
 * Configuration for file parsers
 */
export interface ParserConfig {
  /** Whether parser is enabled */
  enabled: boolean;
  /** Parser-specific options */
  options: Record<string, unknown>;
  /** Custom extraction patterns */
  patterns?: ExtractionPattern[];
}

/**
 * Rule for detecting relationships between artifacts
 */
export interface LinkRule {
  /** Rule identifier */
  id: string;
  /** Rule name */
  name: string;
  /** Source artifact type pattern */
  sourceType: ArtifactType | RegExp;
  /** Target artifact type pattern */
  targetType: ArtifactType | RegExp;
  /** Link type to create */
  linkType: LinkType;
  /** Pattern to match in source artifact */
  sourcePattern: string | RegExp;
  /** Pattern to match in target artifact */
  targetPattern: string | RegExp;
  /** Confidence score for automatically detected links */
  confidence: number;
  /** Whether rule is enabled */
  enabled: boolean;
}

/**
 * Pattern for detecting annotations in code
 */
export interface AnnotationPattern {
  /** Pattern identifier */
  id: string;
  /** Language or file type */
  language: string;
  /** Regular expression pattern */
  pattern: string | RegExp;
  /** Capture groups mapping */
  captureGroups: Record<string, number>;
  /** Default link type for this annotation */
  defaultLinkType: LinkType;
}

/**
 * Pattern for extracting artifacts from files
 */
export interface ExtractionPattern {
  /** Pattern identifier */
  id: string;
  /** Regular expression pattern */
  pattern: string | RegExp;
  /** Artifact type to create */
  artifactType: ArtifactType;
  /** Field mappings from capture groups */
  fieldMappings: Record<string, string>;
}

/**
 * Feature flags for traceability analysis
 */
export interface FeatureFlags {
  /** Enable automatic link detection */
  autoLinkDetection: boolean;
  /** Enable code annotation parsing */
  annotationParsing: boolean;
  /** Enable transitive relationship analysis */
  transitiveAnalysis: boolean;
  /** Enable impact analysis */
  impactAnalysis: boolean;
  /** Enable coverage analysis */
  coverageAnalysis: boolean;
  /** Enable graph optimization */
  graphOptimization: boolean;
}

/**
 * Result of parsing a file for artifacts
 */
export interface ParseResult {
  /** File path that was parsed */
  filePath: string;
  /** Artifacts found in the file */
  artifacts: Artifact[];
  /** Links found in the file */
  links: TraceabilityLink[];
  /** Parsing errors or warnings */
  issues: ParseIssue[];
  /** Parser metadata */
  metadata: ParseMetadata;
}

/**
 * Issue encountered during parsing
 */
export interface ParseIssue {
  /** Issue severity */
  severity: 'error' | 'warning' | 'info';
  /** Issue message */
  message: string;
  /** Location where issue occurred */
  location?: Location;
  /** Issue code or type */
  code?: string;
  /** Suggested fix */
  suggestion?: string;
}

/**
 * Metadata from parsing operation
 */
export interface ParseMetadata {
  /** Parser used */
  parser: string;
  /** Parsing duration in milliseconds */
  duration: number;
  /** File size in bytes */
  fileSize: number;
  /** File modification time */
  fileModified: Date;
  /** Additional parser-specific data */
  parserData: Record<string, unknown>;
}

/**
 * Result of impact analysis
 */
export interface ImpactAnalysis {
  /** Changed artifacts */
  changedArtifacts: ArtifactChange[];
  /** Impacted artifacts */
  impactedArtifacts: ArtifactImpact[];
  /** Broken links */
  brokenLinks: TraceabilityLink[];
  /** Risk assessment */
  riskAssessment: RiskAssessment;
  /** Recommendations */
  recommendations: Recommendation[];
}

/**
 * Information about a changed artifact
 */
export interface ArtifactChange {
  /** Artifact that changed */
  artifact: Artifact;
  /** Type of change */
  changeType: ChangeType;
  /** Previous version of artifact (for modifications) */
  previousVersion?: Artifact;
  /** Details about what changed */
  changeDetails: ChangeDetail[];
}

/**
 * Details about specific changes in an artifact
 */
export interface ChangeDetail {
  /** Field that changed */
  field: string;
  /** Previous value */
  oldValue: unknown;
  /** New value */
  newValue: unknown;
  /** Impact of this specific change */
  impact: 'high' | 'medium' | 'low';
}

/**
 * Information about artifacts impacted by changes
 */
export interface ArtifactImpact {
  /** Impacted artifact */
  artifact: Artifact;
  /** Impact level */
  impactLevel: 'direct' | 'indirect' | 'transitive';
  /** Distance from changed artifact */
  distance: number;
  /** Confidence in impact assessment */
  confidence: number;
  /** Reasons for impact */
  reasons: string[];
}

/**
 * Risk assessment for changes
 */
export interface RiskAssessment {
  /** Overall risk level */
  overallRisk: 'critical' | 'high' | 'medium' | 'low';
  /** Risk factors */
  riskFactors: RiskFactor[];
  /** Mitigation strategies */
  mitigationStrategies: string[];
  /** Validation steps recommended */
  validationSteps: string[];
}

/**
 * Individual risk factor
 */
export interface RiskFactor {
  /** Risk factor identifier */
  id: string;
  /** Risk description */
  description: string;
  /** Risk level */
  level: 'critical' | 'high' | 'medium' | 'low';
  /** Likelihood of occurrence */
  likelihood: number;
  /** Impact if it occurs */
  impact: number;
  /** Risk score (likelihood × impact) */
  score: number;
}

/**
 * Recommendation for improving traceability
 */
export interface Recommendation {
  /** Recommendation identifier */
  id: string;
  /** Recommendation type */
  type: 'missing_link' | 'broken_link' | 'orphaned_artifact' | 'coverage_gap' | 'quality_issue';
  /** Priority level */
  priority: 'critical' | 'high' | 'medium' | 'low';
  /** Recommendation description */
  description: string;
  /** Suggested actions */
  actions: string[];
  /** Artifacts involved */
  artifacts: string[];
  /** Expected benefit */
  benefit: string;
  /** Effort estimate */
  effort: 'low' | 'medium' | 'high';
}

/**
 * Coverage analysis results
 */
export interface CoverageAnalysis {
  /** Overall coverage metrics */
  overall: CoverageMetrics;
  /** Coverage by artifact type */
  byType: Record<ArtifactType, CoverageMetrics>;
  /** Coverage gaps */
  gaps: CoverageGap[];
  /** Coverage trends over time */
  trends: CoverageTrend[];
}

/**
 * Coverage metrics
 */
export interface CoverageMetrics {
  /** Total number of artifacts */
  totalArtifacts: number;
  /** Number of covered artifacts */
  coveredArtifacts: number;
  /** Coverage percentage */
  coveragePercent: number;
  /** Number of links */
  totalLinks: number;
  /** Link density (links per artifact) */
  linkDensity: number;
  /** Completeness score */
  completenessScore: number;
}

/**
 * Coverage gap information
 */
export interface CoverageGap {
  /** Gap identifier */
  id: string;
  /** Gap type */
  type: 'uncovered_requirement' | 'untested_code' | 'missing_scenario' | 'orphaned_test';
  /** Gap description */
  description: string;
  /** Artifacts involved in the gap */
  artifacts: string[];
  /** Severity of the gap */
  severity: 'critical' | 'high' | 'medium' | 'low';
  /** Suggested actions to fill the gap */
  suggestions: string[];
}

/**
 * Coverage trend over time
 */
export interface CoverageTrend {
  /** Timestamp */
  timestamp: Date;
  /** Coverage metrics at this point */
  metrics: CoverageMetrics;
  /** Changes since previous measurement */
  changes: number;
}

/**
 * Traceability report
 */
export interface TraceabilityReport {
  /** Report identifier */
  id: string;
  /** Report name */
  name: string;
  /** Report type */
  type: 'matrix' | 'coverage' | 'impact' | 'gaps' | 'trends';
  /** Generation timestamp */
  generatedAt: Date;
  /** Report parameters */
  parameters: ReportParameters;
  /** Report data */
  data: unknown;
  /** Summary statistics */
  summary: ReportSummary;
  /** Export format */
  format: 'json' | 'html' | 'csv' | 'pdf';
}

/**
 * Parameters for generating reports
 */
export interface ReportParameters {
  /** Time range for analysis */
  timeRange?: {
    start: Date;
    end: Date;
  };
  /** Artifact types to include */
  artifactTypes?: ArtifactType[];
  /** File path filters */
  pathFilters?: string[];
  /** Additional filters */
  filters: Record<string, unknown>;
  /** Report options */
  options: Record<string, unknown>;
}

/**
 * Report summary statistics
 */
export interface ReportSummary {
  /** Total artifacts analyzed */
  totalArtifacts: number;
  /** Total links analyzed */
  totalLinks: number;
  /** Key findings */
  keyFindings: string[];
  /** Recommendations count by priority */
  recommendationsByPriority: Record<string, number>;
  /** Overall health score */
  healthScore: number;
}

/**
 * Query interface for searching the traceability graph
 */
export interface TraceabilityQuery {
  /** Query identifier */
  id?: string;
  /** Artifact type filters */
  artifactTypes?: ArtifactType[];
  /** Link type filters */
  linkTypes?: LinkType[];
  /** Text search terms */
  searchTerms?: string[];
  /** File path patterns */
  pathPatterns?: string[];
  /** Tag filters */
  tags?: string[];
  /** Date range filter */
  dateRange?: {
    start: Date;
    end: Date;
  };
  /** Custom filters */
  customFilters?: Record<string, unknown>;
  /** Sort criteria */
  sortBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  /** Result limit */
  limit?: number;
  /** Result offset */
  offset?: number;
}

/**
 * Query result
 */
export interface QueryResult {
  /** Matching artifacts */
  artifacts: Artifact[];
  /** Matching links */
  links: TraceabilityLink[];
  /** Total count (before limit/offset) */
  totalCount: number;
  /** Query execution time in milliseconds */
  executionTime: number;
  /** Query metadata */
  metadata: Record<string, unknown>;
}

/**
 * Export options for traceability data
 */
export interface ExportOptions {
  /** Export format */
  format: 'json' | 'xml' | 'csv' | 'yaml' | 'graphml';
  /** Include options */
  include: {
    artifacts: boolean;
    links: boolean;
    metadata: boolean;
    history: boolean;
  };
  /** Filtering options */
  filters?: TraceabilityQuery;
  /** Formatting options */
  formatting: {
    prettyPrint: boolean;
    includeSchema: boolean;
    compression?: 'gzip' | 'zip';
  };
}