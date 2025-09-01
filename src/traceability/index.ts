/**
 * Arbiter Traceability System
 * 
 * A comprehensive traceability system that provides REQ→SCENARIO→TEST→CODE linkage
 * following the Rails & Guarantees methodology. This system enables complete
 * traceability tracking, impact analysis, coverage assessment, and reporting.
 * 
 * Key Features:
 * - Bidirectional traceability linking
 * - Multi-format parsing (CUE, TypeScript, Markdown)
 * - Impact analysis for requirement and code changes
 * - Coverage analysis with gap identification
 * - Automatic relationship discovery
 * - Manual annotation support with validation
 * - Graph-based relationship management
 * - Comprehensive reporting and visualization
 * 
 * Usage:
 * ```typescript
 * import { createTraceabilityEngine } from './traceability';
 * 
 * const engine = createTraceabilityEngine({
 *   includePatterns: ['src/**\/*.{ts,cue,md}'],
 *   excludePatterns: ['node_modules/**'],
 *   features: {
 *     autoLinkDetection: true,
 *     impactAnalysis: true,
 *     coverageAnalysis: true
 *   }
 * });
 * 
 * await engine.initialize();
 * const result = await engine.analyzeProject('./src');
 * const report = await engine.generateReport('dashboard');
 * ```
 */

// Main engine and factory
export { TraceabilityEngine, createTraceabilityEngine } from './tracer.js';

// Core components
export { TraceabilityGraphManager, GraphUtils } from './graph.js';
export { ArtifactParser } from './parser.js';
export { TraceabilityAnalyzer } from './analyzer.js';
export { CodeAnnotator } from './annotator.js';
export { TraceabilityReporter } from './reporter.js';

// Type definitions
export type {
  // Core types
  Artifact,
  TraceabilityLink,
  TraceabilityGraph,
  ArtifactType,
  LinkType,
  ChangeType,
  Location,
  
  // Specific artifact types
  Requirement,
  Scenario,
  Test,
  Code,
  
  // Configuration
  TraceabilityConfig,
  ParserConfig,
  LinkRule,
  AnnotationPattern,
  ExtractionPattern,
  FeatureFlags,
  
  // Analysis results
  ImpactAnalysis,
  CoverageAnalysis,
  ArtifactChange,
  ArtifactImpact,
  RiskAssessment,
  RiskFactor,
  Recommendation,
  CoverageMetrics,
  CoverageGap,
  CoverageTrend,
  
  // Parsing
  ParseResult,
  ParseIssue,
  ParseMetadata,
  
  // Queries and results
  TraceabilityQuery,
  QueryResult,
  
  // Reports
  TraceabilityReport,
  ReportParameters,
  ReportSummary,
  
  // Graph operations
  TraversalOptions,
  ArtifactPath,
  GraphStatistics,
  
  // Export
  ExportOptions
} from './types.js';

// Utility functions and constants
export const DEFAULT_INCLUDE_PATTERNS = [
  '**/*.{ts,tsx,js,jsx}', // TypeScript/JavaScript
  '**/*.cue',             // CUE files
  '**/*.md',              // Markdown documentation
  '**/*.py'               // Python files
];

export const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.git/**',
  '**/.next/**',
  '**/coverage/**'
];

/**
 * Creates a default configuration for the traceability system
 */
export function createDefaultConfig(): import('./types.js').TraceabilityConfig {
  return {
    includePatterns: DEFAULT_INCLUDE_PATTERNS,
    excludePatterns: DEFAULT_EXCLUDE_PATTERNS,
    parsers: {
      TypeScriptParser: {
        enabled: true,
        options: {
          parseTests: true,
          parseJSDoc: true,
          extractImports: true
        }
      },
      CueParser: {
        enabled: true,
        options: {
          parseConstraints: true,
          parseDefinitions: true,
          extractReferences: true
        }
      },
      MarkdownParser: {
        enabled: true,
        options: {
          parseScenarios: true,
          parseRequirements: true,
          extractLinks: true
        }
      }
    },
    linkRules: [
      {
        id: 'test_to_code',
        name: 'Tests to Code',
        sourceType: 'test',
        targetType: 'code',
        linkType: 'tests',
        sourcePattern: /.*/,
        targetPattern: /.*/,
        confidence: 0.8,
        enabled: true
      },
      {
        id: 'code_to_requirement',
        name: 'Code to Requirements',
        sourceType: 'code',
        targetType: 'requirement',
        linkType: 'implements',
        sourcePattern: /.*/,
        targetPattern: /.*/,
        confidence: 0.6,
        enabled: true
      },
      {
        id: 'scenario_to_requirement',
        name: 'Scenarios to Requirements',
        sourceType: 'scenario',
        targetType: 'requirement',
        linkType: 'validates',
        sourcePattern: /.*/,
        targetPattern: /.*/,
        confidence: 0.7,
        enabled: true
      },
      {
        id: 'test_to_scenario',
        name: 'Tests to Scenarios',
        sourceType: 'test',
        targetType: 'scenario',
        linkType: 'validates',
        sourcePattern: /.*/,
        targetPattern: /.*/,
        confidence: 0.75,
        enabled: true
      }
    ],
    annotationPatterns: [
      {
        id: 'typescript_jsdoc',
        language: 'typescript',
        pattern: /\/\*\*[^*]*\*+(?:[^/*][^*]*\*+)*\/\s*@(implements|tests|validates|requires|references)\s+([^\s\n]+)/g,
        captureGroups: { type: 1, targetId: 2 },
        defaultLinkType: 'implements'
      },
      {
        id: 'typescript_single_line',
        language: 'typescript',
        pattern: /\/\/\s*@(implements|tests|validates|requires|references)\s+([^\s\n]+)/g,
        captureGroups: { type: 1, targetId: 2 },
        defaultLinkType: 'implements'
      },
      {
        id: 'cue_comment',
        language: 'cue',
        pattern: /\/\/\s*@(implements|tests|validates|requires|references)\s+([^\s\n]+)/g,
        captureGroups: { type: 1, targetId: 2 },
        defaultLinkType: 'implements'
      }
    ],
    minLinkConfidence: 0.5,
    features: {
      autoLinkDetection: true,
      annotationParsing: true,
      transitiveAnalysis: true,
      impactAnalysis: true,
      coverageAnalysis: true,
      graphOptimization: true
    }
  };
}

/**
 * Quick setup function for common use cases
 */
export async function quickSetup(projectRoot: string = process.cwd()): Promise<import('./tracer.js').TraceabilityEngine> {
  const config = createDefaultConfig();
  const engine = createTraceabilityEngine(config);
  
  await engine.initialize();
  await engine.analyzeProject(projectRoot);
  
  return engine;
}

/**
 * Version information
 */
export const VERSION = '1.0.0';

/**
 * System information
 */
export const SYSTEM_INFO = {
  name: 'Arbiter Traceability System',
  version: VERSION,
  description: 'Comprehensive REQ→SCENARIO→TEST→CODE traceability following Rails & Guarantees methodology',
  features: [
    'Bidirectional traceability linking',
    'Multi-format parsing (CUE, TypeScript, Markdown)',
    'Impact analysis',
    'Coverage analysis',
    'Automatic relationship discovery',
    'Manual annotation support',
    'Graph-based relationship management',
    'Comprehensive reporting'
  ],
  supportedFormats: [
    'TypeScript (.ts, .tsx)',
    'JavaScript (.js, .jsx)',
    'CUE (.cue)',
    'Markdown (.md)',
    'Python (.py)'
  ]
};