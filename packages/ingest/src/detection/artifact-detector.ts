/**
 * Artifact Type Detection Engine
 *
 * This module provides intelligent artifact type detection using the dependency matrix
 * and additional heuristics to accurately classify codebases into their primary purposes.
 */

import {
  type CategoryMatrix,
  DEPENDENCY_MATRIX,
  determineMostLikelyCategory,
  getAllCategoriesByConfidence,
  getCategoryExplanation,
} from "./dependency-matrix";

export interface DetectionContext {
  /** Primary language detected */
  language: string;
  /** All dependencies found in the project */
  dependencies: string[];
  /** Scripts or commands found (e.g., npm scripts, cargo commands) */
  scripts: Record<string, string>;
  /** File patterns that might indicate artifact type */
  filePatterns: string[];
  /** Package configuration (package.json, Cargo.toml, etc.) */
  packageConfig: Record<string, any>;
  /** Source code analysis results */
  sourceAnalysis?: SourceAnalysis;
}

export interface SourceAnalysis {
  /** Indicates if binary execution patterns are found */
  hasBinaryExecution: boolean;
  /** Server/service patterns detected */
  hasServerPatterns: boolean;
  /** Frontend/UI patterns detected */
  hasFrontendPatterns: boolean;
  /** CLI interaction patterns */
  hasCliPatterns: boolean;
  /** Data processing patterns */
  hasDataProcessingPatterns: boolean;
  /** Test patterns */
  hasTestPatterns: boolean;
  /** Build/packaging patterns */
  hasBuildPatterns: boolean;
  /** Game-specific patterns */
  hasGamePatterns: boolean;
  /** Mobile-specific patterns */
  hasMobilePatterns: boolean;
  /** Desktop app patterns */
  hasDesktopPatterns: boolean;
}

export interface DetectionResult {
  /** Primary artifact type */
  primaryType: keyof CategoryMatrix;
  /** Confidence score (0-1) */
  confidence: number;
  /** All possible types ranked by confidence */
  alternativeTypes: Array<{ type: keyof CategoryMatrix; confidence: number }>;
  /** Human-readable explanation of the decision */
  explanation: string[];
  /** Detailed breakdown of factors */
  factors: DetectionFactors;
}

export interface DetectionFactors {
  /** Dependency-based detection results */
  dependencyFactors: Array<{
    category: keyof CategoryMatrix;
    confidence: number;
    matches: string[];
  }>;
  /** Script-based indicators */
  scriptFactors: Array<{
    category: keyof CategoryMatrix;
    confidence: number;
    scripts: string[];
  }>;
  /** File pattern indicators */
  filePatternFactors: Array<{
    category: keyof CategoryMatrix;
    confidence: number;
    patterns: string[];
  }>;
  /** Package configuration indicators */
  configFactors: Array<{
    category: keyof CategoryMatrix;
    confidence: number;
    indicators: string[];
  }>;
  /** Source code analysis factors */
  sourceFactors?: Array<{
    category: keyof CategoryMatrix;
    confidence: number;
    patterns: string[];
  }>;
}

/**
 * Definition of a file pattern rule for artifact detection.
 */
interface FilePatternRule {
  category: keyof CategoryMatrix;
  patterns: RegExp[];
  maxConfidence: number;
  confidencePerMatch: number;
}

/**
 * Maximum confidence limits for each category from config analysis.
 */
const CONFIG_CONFIDENCE_LIMITS: Record<string, number> = {
  tool: 0.9,
  package: 0.8,
  frontend: 0.6,
  web_service: 0.5,
};

/**
 * Confidence added per indicator for each category.
 */
const CONFIG_CONFIDENCE_PER_INDICATOR: Record<string, number> = {
  tool: 0.4,
  package: 0.2,
  frontend: 0.2,
  web_service: 0.2,
};

/**
 * Weight configuration for factor aggregation.
 */
interface FactorWeights {
  dependency: number;
  source: number;
  config: number;
  script: number;
  filePattern: number;
}

/**
 * Weights when full evidence (source/config) is available.
 */
const WEIGHTS_FULL: FactorWeights = {
  dependency: 0.5,
  source: 0.25,
  config: 0.25,
  script: 0.08,
  filePattern: 0.05,
};

/**
 * Weights for lightweight signals (e.g., Go/C# binaries without detailed analysis).
 */
const WEIGHTS_LIGHTWEIGHT: FactorWeights = {
  dependency: 0.7,
  source: 0,
  config: 0,
  script: 0.2,
  filePattern: 0.1,
};

/**
 * File pattern rules for detecting artifact types.
 */
const FILE_PATTERN_RULES: FilePatternRule[] = [
  {
    category: "tool",
    patterns: [/bin\//, /cli\./, /command\./, /main\./, /cmd\//i],
    maxConfidence: 0.6,
    confidencePerMatch: 0.2,
  },
  {
    category: "web_service",
    patterns: [/server\./, /app\./, /routes?\//, /controllers?\//, /middleware\//],
    maxConfidence: 0.7,
    confidencePerMatch: 0.15,
  },
  {
    category: "frontend",
    patterns: [
      /components?\//,
      /pages?\//,
      /views?\//,
      /public\//,
      /assets?\//,
      /src\/.*\.(tsx?|jsx?|vue|svelte)$/,
    ],
    maxConfidence: 0.6,
    confidencePerMatch: 0.1,
  },
  {
    category: "package",
    patterns: [/lib\//, /src\/.*index\.(ts|js)$/, /dist\//],
    maxConfidence: 0.4,
    confidencePerMatch: 0.1,
  },
  {
    category: "desktop_app",
    patterns: [/electron/, /tauri/, /native/, /desktop/],
    maxConfidence: 0.8,
    confidencePerMatch: 0.3,
  },
  {
    category: "game",
    patterns: [/game/, /scenes?\//, /sprites?\//, /assets\/.*\.(png|jpg|wav|mp3)$/],
    maxConfidence: 0.7,
    confidencePerMatch: 0.2,
  },
  {
    category: "mobile",
    patterns: [/mobile/, /ios\//, /android\//, /react-native/],
    maxConfidence: 0.8,
    confidencePerMatch: 0.25,
  },
];

/**
 * Main artifact detection engine
 */
export class ArtifactDetector {
  /**
   * Detect the primary artifact type and alternatives
   */
  detect(context: DetectionContext): DetectionResult {
    const factors = this.analyzeAllFactors(context);
    const hasEvidence =
      factors.dependencyFactors.length > 0 ||
      factors.scriptFactors.length > 0 ||
      factors.filePatternFactors.length > 0 ||
      factors.configFactors.length > 0 ||
      (factors.sourceFactors?.length ?? 0) > 0;

    if (!hasEvidence) {
      const explanation = ["Detected as package based on:", "no strong detection signals"];
      const confidence = DEPENDENCY_MATRIX[context.language] ? 0.2 : 0;
      return {
        primaryType: "package",
        confidence,
        alternativeTypes: [],
        explanation,
        factors,
      };
    }

    const aggregatedScores = this.aggregateScores(factors);

    // Sort by confidence
    const sortedTypes = Object.entries(aggregatedScores)
      .map(([type, confidence]) => ({
        type: type as keyof CategoryMatrix,
        confidence,
      }))
      .sort((a, b) => b.confidence - a.confidence);

    const primaryType = sortedTypes[0]?.type || "package";
    const confidence = sortedTypes[0]?.confidence || 0.1;
    const alternativeTypes = sortedTypes.slice(1);

    const explanation = this.generateExplanation(context, factors, primaryType);

    return {
      primaryType,
      confidence,
      alternativeTypes,
      explanation,
      factors,
    };
  }

  /**
   * Analyze all factors that contribute to artifact type detection
   */
  private analyzeAllFactors(context: DetectionContext): DetectionFactors {
    const dependencyFactors = this.analyzeDependencyFactors(context);
    const scriptFactors = this.analyzeScriptFactors(context);
    const filePatternFactors = this.analyzeFilePatternFactors(context);
    const configFactors = this.analyzeConfigFactors(context);
    const sourceFactors = context.sourceAnalysis ? this.analyzeSourceFactors(context) : undefined;

    return {
      dependencyFactors,
      scriptFactors,
      filePatternFactors,
      configFactors,
      sourceFactors,
    };
  }

  /**
   * Analyze dependencies using the dependency matrix
   */
  private analyzeDependencyFactors(context: DetectionContext): Array<{
    category: keyof CategoryMatrix;
    confidence: number;
    matches: string[];
  }> {
    const results = getAllCategoriesByConfidence(context.dependencies, context.language);

    return results.map(({ category, confidence }) => ({
      category,
      confidence,
      matches: getCategoryExplanation(context.dependencies, context.language, category),
    }));
  }

  /**
   * Analyze scripts for artifact type indicators
   */
  private analyzeScriptFactors(context: DetectionContext): Array<{
    category: keyof CategoryMatrix;
    confidence: number;
    scripts: string[];
  }> {
    const factors: Array<{
      category: keyof CategoryMatrix;
      confidence: number;
      scripts: string[];
    }> = [];

    // CLI indicators in scripts
    const cliScripts = this.findScriptsMatching(context.scripts, [
      /bin\/.*$/, // Binary execution
      /cli/i, // CLI mentions
      /command/i, // Command mentions
      /--help/, // Help flags
      /--version/, // Version flags
      /go\s+run/i, // Go CLI entry point
      /dotnet\s+run/i, // .NET CLI entry point
    ]);
    if (cliScripts.length > 0) {
      factors.push({
        category: "tool",
        confidence: Math.min(0.8, cliScripts.length * 0.3),
        scripts: cliScripts,
      });
    }

    // Web service indicators
    const webScripts = this.findScriptsMatching(context.scripts, [
      /start.*server/i, // Server start
      /serve/i, // Serve commands
      /dev.*server/i, // Development server
      /nodemon/, // Development tool
      /pm2/, // Process manager
    ]);
    if (webScripts.length > 0) {
      factors.push({
        category: "web_service",
        confidence: Math.min(0.7, webScripts.length * 0.25),
        scripts: webScripts,
      });
    }

    // Frontend indicators
    const frontendScripts = this.findScriptsMatching(context.scripts, [
      /webpack/i,
      /vite/i,
      /rollup/i,
      /parcel/i,
      /react-scripts/i,
      /next\s+dev/i,
      /nuxt\s+dev/i,
      /start.*dev/i,
      /preview/i,
    ]);
    if (frontendScripts.length > 0) {
      factors.push({
        category: "frontend",
        confidence: Math.min(0.6, frontendScripts.length * 0.2),
        scripts: frontendScripts,
      });
    }

    // Testing indicators
    const testScripts = this.findScriptsMatching(context.scripts, [
      /test/i, // Test commands
      /jest/, // Jest
      /vitest/, // Vitest
      /cypress/, // E2E testing
      /playwright/, // E2E testing
    ]);
    if (testScripts.length > 0) {
      factors.push({
        category: "testing",
        confidence: Math.min(0.5, testScripts.length * 0.15),
        scripts: testScripts,
      });
    }

    // Build tool indicators
    const buildScripts = this.findScriptsMatching(context.scripts, [
      /build/i, // Build commands
      /compile/i, // Compilation
      /bundle/i, // Bundling
      /pack/i, // Packaging
      /dist/i, // Distribution
    ]);
    if (buildScripts.length > 0) {
      factors.push({
        category: "build_tool",
        confidence: Math.min(0.4, buildScripts.length * 0.1),
        scripts: buildScripts,
      });
    }

    return factors;
  }

  /**
   * Analyze file patterns for artifact type indicators
   */
  private analyzeFilePatternFactors(context: DetectionContext): Array<{
    category: keyof CategoryMatrix;
    confidence: number;
    patterns: string[];
  }> {
    return FILE_PATTERN_RULES.map((rule) => this.evaluateFilePatternRule(context, rule)).filter(
      (factor): factor is NonNullable<typeof factor> => factor !== null,
    );
  }

  /**
   * Evaluates a single file pattern rule against the context.
   */
  private evaluateFilePatternRule(
    context: DetectionContext,
    rule: FilePatternRule,
  ): { category: keyof CategoryMatrix; confidence: number; patterns: string[] } | null {
    const matchingPatterns = context.filePatterns.filter((pattern) =>
      rule.patterns.some((regex) => regex.test(pattern)),
    );

    if (matchingPatterns.length === 0) return null;

    return {
      category: rule.category,
      confidence: Math.min(rule.maxConfidence, matchingPatterns.length * rule.confidencePerMatch),
      patterns: matchingPatterns,
    };
  }

  /**
   * Analyze package configuration for indicators
   */
  private analyzeConfigFactors(context: DetectionContext): Array<{
    category: keyof CategoryMatrix;
    confidence: number;
    indicators: string[];
  }> {
    const config = context.packageConfig;

    const categoryIndicators: Map<keyof CategoryMatrix, string[]> = new Map([
      ["tool", this.detectCliIndicators(config)],
      ["package", this.detectModuleIndicators(config)],
      ["frontend", this.detectFrontendIndicators(config)],
      ["web_service", this.detectWebServiceIndicators(config)],
    ]);

    return Array.from(categoryIndicators.entries())
      .filter(([, indicators]) => indicators.length > 0)
      .map(([category, indicators]) => ({
        category,
        confidence: Math.min(
          CONFIG_CONFIDENCE_LIMITS[category],
          indicators.length * CONFIG_CONFIDENCE_PER_INDICATOR[category],
        ),
        indicators,
      }));
  }

  /**
   * Detects CLI-related indicators in package configuration.
   */
  private detectCliIndicators(config: Record<string, any>): string[] {
    const indicators: string[] = [];
    if (config.bin) {
      indicators.push("has bin field");
      if (typeof config.bin === "object") {
        indicators.push("binary command definitions", "explicit CLI entry point");
      }
    }
    if (config.main && typeof config.main === "string" && config.main.includes("bin")) {
      indicators.push("main points to bin");
    }
    if (config.preferGlobal) {
      indicators.push("preferGlobal flag");
    }
    if (config.entry_points?.console_scripts) {
      indicators.push("console script entry points", "exposed console commands");
    }
    return indicators;
  }

  /**
   * Module indicator rule definition
   */
  private static readonly MODULE_INDICATOR_RULES: Array<{
    check: (config: Record<string, any>) => boolean;
    indicator: string;
  }> = [
    { check: (c) => Boolean(c.main && !c.bin), indicator: "has main without bin" },
    { check: (c) => Boolean(c.exports), indicator: "has exports field" },
    { check: (c) => Boolean(c.types || c.typings), indicator: "provides TypeScript types" },
    {
      check: (c) => "private" in c && !c.private && !c.bin,
      indicator: "public package without CLI",
    },
    { check: (c) => Boolean(c.module), indicator: "has ESM module field" },
    {
      check: (c) => Boolean(c.peerDependencies && Object.keys(c.peerDependencies).length > 0),
      indicator: "has peer dependencies",
    },
    {
      check: (c) =>
        c.keywords?.some((k: string) => /module|util|helper|plugin|middleware/i.test(k)),
      indicator: "module-related keywords",
    },
  ];

  /**
   * Detects module/package indicators in package configuration.
   */
  private detectModuleIndicators(config: Record<string, any>): string[] {
    return ArtifactDetector.MODULE_INDICATOR_RULES.filter((rule) => rule.check(config)).map(
      (rule) => rule.indicator,
    );
  }

  /**
   * Detects frontend-related indicators in package configuration.
   */
  private detectFrontendIndicators(config: Record<string, any>): string[] {
    const indicators: string[] = [];
    if (config.private && (config.scripts?.build || config.scripts?.dev)) {
      indicators.push("private package with build/dev scripts");
    }
    if (config.homepage) indicators.push("has homepage field");
    if (config.browserslist) indicators.push("has browserslist config");
    if (config.scripts?.start && !config.scripts?.start.includes("node")) {
      indicators.push("non-node start script");
    }
    return indicators;
  }

  /**
   * Detects web service indicators in package configuration.
   */
  private detectWebServiceIndicators(config: Record<string, any>): string[] {
    const indicators: string[] = [];
    if (config.scripts?.start?.includes("node")) {
      indicators.push("node start script");
    }
    if (config.scripts?.["start:prod"] || config.scripts?.production) {
      indicators.push("production start scripts");
    }
    if (config.engines?.node && !config.bin) {
      indicators.push("node engine requirement without CLI");
    }
    return indicators;
  }

  /**
   * Source pattern detection rules
   */
  private static readonly SOURCE_PATTERN_RULES: Array<{
    category: keyof CategoryMatrix;
    confidence: number;
    pattern: string;
    check: (analysis: DetectionContext["sourceAnalysis"]) => boolean;
  }> = [
    {
      category: "web_service",
      confidence: 0.9,
      pattern: "server/service patterns detected",
      check: (a) => !!a?.hasServerPatterns,
    },
    {
      category: "frontend",
      confidence: 0.8,
      pattern: "frontend/UI patterns detected",
      check: (a) => !!a?.hasFrontendPatterns,
    },
    {
      category: "data_processing",
      confidence: 0.7,
      pattern: "data processing patterns detected",
      check: (a) => !!a?.hasDataProcessingPatterns,
    },
    {
      category: "game",
      confidence: 0.9,
      pattern: "game development patterns detected",
      check: (a) => !!a?.hasGamePatterns,
    },
    {
      category: "mobile",
      confidence: 0.8,
      pattern: "mobile development patterns detected",
      check: (a) => !!a?.hasMobilePatterns,
    },
    {
      category: "desktop_app",
      confidence: 0.8,
      pattern: "desktop application patterns detected",
      check: (a) => !!a?.hasDesktopPatterns,
    },
  ];

  /**
   * Collect CLI/tool patterns from source analysis
   */
  private collectToolPatterns(analysis: DetectionContext["sourceAnalysis"]): string[] {
    const patterns: string[] = [];
    if (analysis?.hasBinaryExecution) patterns.push("binary execution patterns");
    if (analysis?.hasCliPatterns) patterns.push("CLI interaction patterns");
    return patterns;
  }

  /**
   * Analyze source code patterns
   */
  private analyzeSourceFactors(context: DetectionContext): Array<{
    category: keyof CategoryMatrix;
    confidence: number;
    patterns: string[];
  }> {
    const factors: Array<{
      category: keyof CategoryMatrix;
      confidence: number;
      patterns: string[];
    }> = [];
    const analysis = context.sourceAnalysis;

    // Handle tool patterns (binary execution or CLI)
    const toolPatterns = this.collectToolPatterns(analysis);
    if (toolPatterns.length > 0) {
      factors.push({ category: "tool", confidence: 0.8, patterns: toolPatterns });
    }

    // Apply standard pattern rules
    for (const rule of ArtifactDetector.SOURCE_PATTERN_RULES) {
      if (rule.check(analysis)) {
        factors.push({
          category: rule.category,
          confidence: rule.confidence,
          patterns: [rule.pattern],
        });
      }
    }

    return factors;
  }

  /**
   * Aggregate scores from all factors using weighted combination
   */
  private aggregateScores(factors: DetectionFactors): Record<string, number> {
    const weights = this.selectWeights(factors);
    const scores = this.computeWeightedScores(factors, weights);

    if (this.needsFallbackDetection(scores)) {
      this.applyFallbackScores(factors, scores);
    }

    return this.normalizeScores(scores);
  }

  /**
   * Selects weight configuration based on available evidence.
   */
  private selectWeights(factors: DetectionFactors): FactorWeights {
    const hasSource = (factors.sourceFactors?.length ?? 0) > 0;
    const hasConfig = factors.configFactors.length > 0;

    // When we only have lightweight signals, lean on dependencies more heavily
    return hasSource || hasConfig ? WEIGHTS_FULL : WEIGHTS_LIGHTWEIGHT;
  }

  /**
   * Computes weighted scores from all factor types.
   */
  private computeWeightedScores(
    factors: DetectionFactors,
    weights: FactorWeights,
  ): Record<string, number> {
    const scores: Record<string, number> = {};

    const addFactorScore = (
      factorList: Array<{ category: string; confidence: number }> | undefined,
      weight: number,
    ) => {
      factorList?.forEach((factor) => {
        scores[factor.category] = (scores[factor.category] || 0) + factor.confidence * weight;
      });
    };

    addFactorScore(factors.dependencyFactors, weights.dependency);
    addFactorScore(factors.sourceFactors, weights.source);
    addFactorScore(factors.configFactors, weights.config);
    addFactorScore(factors.scriptFactors, weights.script);
    addFactorScore(factors.filePatternFactors, weights.filePattern);

    return scores;
  }

  /**
   * Checks if fallback detection is needed due to low/no scores.
   */
  private needsFallbackDetection(scores: Record<string, number>): boolean {
    const values = Object.values(scores);
    return values.length === 0 || Math.max(...values) < 0.1;
  }

  /**
   * Applies fallback scores when primary detection yields low results.
   */
  private applyFallbackScores(factors: DetectionFactors, scores: Record<string, number>): void {
    const fallbackRules: Array<{
      check: () => boolean;
      category: string;
      score: number;
    }> = [
      {
        check: () => factors.configFactors.some((f) => f.category === "tool" && f.confidence > 0.5),
        category: "tool",
        score: 0.7,
      },
      {
        check: () =>
          factors.configFactors.some((f) => f.category === "package" && f.confidence > 0.3),
        category: "package",
        score: 0.5,
      },
      {
        check: () =>
          factors.sourceFactors?.some((f) => f.category === "web_service" && f.confidence > 0.5) ??
          false,
        category: "web_service",
        score: 0.6,
      },
      {
        check: () =>
          factors.filePatternFactors.some((f) => f.category === "frontend" && f.confidence > 0.3),
        category: "frontend",
        score: 0.5,
      },
    ];

    for (const rule of fallbackRules) {
      if (rule.check()) {
        scores[rule.category] = rule.score;
        return;
      }
    }

    // Default fallback
    scores["package"] = 0.2;
  }

  /**
   * Normalizes scores to ensure they're within valid range.
   */
  private normalizeScores(scores: Record<string, number>): Record<string, number> {
    const normalized: Record<string, number> = {};
    for (const [key, value] of Object.entries(scores)) {
      normalized[key] = Math.min(1.0, value);
    }
    return normalized;
  }

  /**
   * Adds explanation lines from a factor if it matches the primary type.
   */
  private addFactorExplanation(
    explanation: string[],
    label: string,
    items: string[] | undefined,
    limit?: number,
  ): void {
    if (!items || items.length === 0) return;
    explanation.push(`${label}:`);
    explanation.push(...(limit ? items.slice(0, limit) : items));
  }

  /**
   * Generate human-readable explanation
   */
  private generateExplanation(
    _context: DetectionContext,
    factors: DetectionFactors,
    primaryType: keyof CategoryMatrix,
  ): string[] {
    const explanation: string[] = [`Detected as ${primaryType} based on:`];

    const depFactor = factors.dependencyFactors.find((f) => f.category === primaryType);
    this.addFactorExplanation(explanation, "Dependencies", depFactor?.matches, 3);

    const sourceFactor = factors.sourceFactors?.find((f) => f.category === primaryType);
    this.addFactorExplanation(explanation, "Source code", sourceFactor?.patterns);

    const configFactor = factors.configFactors.find((f) => f.category === primaryType);
    this.addFactorExplanation(explanation, "Configuration", configFactor?.indicators);

    const scriptFactor = factors.scriptFactors.find((f) => f.category === primaryType);
    this.addFactorExplanation(explanation, "Scripts", scriptFactor?.scripts, 2);

    return explanation;
  }

  /**
   * Helper method to find scripts matching patterns
   */
  private findScriptsMatching(scripts: Record<string, string>, patterns: RegExp[]): string[] {
    const matches: string[] = [];

    Object.entries(scripts).forEach(([name, command]) => {
      if (patterns.some((pattern) => pattern.test(name) || pattern.test(command))) {
        matches.push(`${name}: ${command}`);
      }
    });

    return matches;
  }
}

/**
 * Convenience function to detect artifact type
 */
export function detectArtifactType(context: DetectionContext): DetectionResult {
  const detector = new ArtifactDetector();
  return detector.detect(context);
}
