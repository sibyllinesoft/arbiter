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
    const factors: Array<{
      category: keyof CategoryMatrix;
      confidence: number;
      patterns: string[];
    }> = [];

    // CLI indicators
    const cliPatterns = context.filePatterns.filter(
      (pattern) =>
        /bin\//.test(pattern) ||
        /cli\./.test(pattern) ||
        /command\./.test(pattern) ||
        /main\./.test(pattern) ||
        /cmd\//i.test(pattern),
    );
    if (cliPatterns.length > 0) {
      factors.push({
        category: "tool",
        confidence: Math.min(0.6, cliPatterns.length * 0.2),
        patterns: cliPatterns,
      });
    }

    // Web service patterns
    const webPatterns = context.filePatterns.filter(
      (pattern) =>
        /server\./.test(pattern) ||
        /app\./.test(pattern) ||
        /routes?\//.test(pattern) ||
        /controllers?\//.test(pattern) ||
        /middleware\//.test(pattern),
    );
    if (webPatterns.length > 0) {
      factors.push({
        category: "web_service",
        confidence: Math.min(0.7, webPatterns.length * 0.15),
        patterns: webPatterns,
      });
    }

    // Frontend patterns
    const frontendPatterns = context.filePatterns.filter(
      (pattern) =>
        /components?\//.test(pattern) ||
        /pages?\//.test(pattern) ||
        /views?\//.test(pattern) ||
        /public\//.test(pattern) ||
        /assets?\//.test(pattern) ||
        /src\/.*\.(tsx?|jsx?|vue|svelte)$/.test(pattern),
    );
    if (frontendPatterns.length > 0) {
      factors.push({
        category: "frontend",
        confidence: Math.min(0.6, frontendPatterns.length * 0.1),
        patterns: frontendPatterns,
      });
    }

    // Library/module patterns
    const modulePatterns = context.filePatterns.filter(
      (pattern) =>
        /lib\//.test(pattern) || /src\/.*index\.(ts|js)$/.test(pattern) || /dist\//.test(pattern),
    );
    if (modulePatterns.length > 0) {
      factors.push({
        category: "package",
        confidence: Math.min(0.4, modulePatterns.length * 0.1),
        patterns: modulePatterns,
      });
    }

    // Desktop app patterns
    const desktopPatterns = context.filePatterns.filter(
      (pattern) =>
        /electron/.test(pattern) ||
        /tauri/.test(pattern) ||
        /native/.test(pattern) ||
        /desktop/.test(pattern),
    );
    if (desktopPatterns.length > 0) {
      factors.push({
        category: "desktop_app",
        confidence: Math.min(0.8, desktopPatterns.length * 0.3),
        patterns: desktopPatterns,
      });
    }

    // Game patterns
    const gamePatterns = context.filePatterns.filter(
      (pattern) =>
        /game/.test(pattern) ||
        /scenes?\//.test(pattern) ||
        /sprites?\//.test(pattern) ||
        /assets\/.*\.(png|jpg|wav|mp3)$/.test(pattern),
    );
    if (gamePatterns.length > 0) {
      factors.push({
        category: "game",
        confidence: Math.min(0.7, gamePatterns.length * 0.2),
        patterns: gamePatterns,
      });
    }

    // Mobile patterns
    const mobilePatterns = context.filePatterns.filter(
      (pattern) =>
        /mobile/.test(pattern) ||
        /ios\//.test(pattern) ||
        /android\//.test(pattern) ||
        /react-native/.test(pattern),
    );
    if (mobilePatterns.length > 0) {
      factors.push({
        category: "mobile",
        confidence: Math.min(0.8, mobilePatterns.length * 0.25),
        patterns: mobilePatterns,
      });
    }

    return factors;
  }

  /**
   * Analyze package configuration for indicators
   */
  private analyzeConfigFactors(context: DetectionContext): Array<{
    category: keyof CategoryMatrix;
    confidence: number;
    indicators: string[];
  }> {
    const factors: Array<{
      category: keyof CategoryMatrix;
      confidence: number;
      indicators: string[];
    }> = [];

    const config = context.packageConfig;

    // CLI indicators
    const cliIndicators: string[] = [];
    if (config.bin) {
      cliIndicators.push("has bin field");
      if (typeof config.bin === "object") {
        cliIndicators.push("binary command definitions");
        cliIndicators.push("explicit CLI entry point");
      }
    }
    if (config.main && typeof config.main === "string" && config.main.includes("bin")) {
      cliIndicators.push("main points to bin");
    }
    if (config.preferGlobal) {
      cliIndicators.push("preferGlobal flag");
    }
    if (config.entry_points?.console_scripts) {
      cliIndicators.push("console script entry points");
      cliIndicators.push("exposed console commands");
    }
    if (cliIndicators.length > 0) {
      factors.push({
        category: "tool",
        confidence: Math.min(0.9, cliIndicators.length * 0.4),
        indicators: cliIndicators,
      });
    }

    // Module indicators - enhanced detection
    const moduleIndicators: string[] = [];
    if (config.main && !config.bin) {
      moduleIndicators.push("has main without bin");
    }
    if (config.exports) {
      moduleIndicators.push("has exports field");
    }
    if (config.types || config.typings) {
      moduleIndicators.push("provides TypeScript types");
    }
    if ("private" in config && !config.private && !config.bin) {
      moduleIndicators.push("public package without CLI");
    }
    // Check for module-specific fields
    if (config.module) {
      moduleIndicators.push("has ESM module field");
    }
    if (config.peerDependencies && Object.keys(config.peerDependencies).length > 0) {
      moduleIndicators.push("has peer dependencies");
    }
    if (config.keywords?.some((k: string) => /module|util|helper|plugin|middleware/i.test(k))) {
      moduleIndicators.push("module-related keywords");
    }
    if (moduleIndicators.length > 0) {
      factors.push({
        category: "package",
        confidence: Math.min(0.8, moduleIndicators.length * 0.2),
        indicators: moduleIndicators,
      });
    }

    // Frontend indicators - enhanced detection
    const frontendIndicators: string[] = [];
    if (config.private && (config.scripts?.build || config.scripts?.dev)) {
      frontendIndicators.push("private package with build/dev scripts");
    }
    if (config.homepage) {
      frontendIndicators.push("has homepage field");
    }
    if (config.browserslist) {
      frontendIndicators.push("has browserslist config");
    }
    if (config.scripts?.start && !config.scripts?.start.includes("node")) {
      frontendIndicators.push("non-node start script");
    }
    if (frontendIndicators.length > 0) {
      factors.push({
        category: "frontend",
        confidence: Math.min(0.6, frontendIndicators.length * 0.2),
        indicators: frontendIndicators,
      });
    }

    // Web service indicators - new detection
    const webServiceIndicators: string[] = [];
    if (config.scripts?.start?.includes("node")) {
      webServiceIndicators.push("node start script");
    }
    if (config.scripts?.["start:prod"] || config.scripts?.production) {
      webServiceIndicators.push("production start scripts");
    }
    if (config.engines?.node && !config.bin) {
      webServiceIndicators.push("node engine requirement without CLI");
    }
    if (webServiceIndicators.length > 0) {
      factors.push({
        category: "web_service",
        confidence: Math.min(0.5, webServiceIndicators.length * 0.2),
        indicators: webServiceIndicators,
      });
    }

    return factors;
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

    const analysis = context.sourceAnalysis!;

    if (analysis.hasBinaryExecution || analysis.hasCliPatterns) {
      const patterns: string[] = [];
      if (analysis.hasBinaryExecution) patterns.push("binary execution patterns");
      if (analysis.hasCliPatterns) patterns.push("CLI interaction patterns");

      factors.push({
        category: "tool",
        confidence: 0.8,
        patterns,
      });
    }

    if (analysis.hasServerPatterns) {
      factors.push({
        category: "web_service",
        confidence: 0.9,
        patterns: ["server/service patterns detected"],
      });
    }

    if (analysis.hasFrontendPatterns) {
      factors.push({
        category: "frontend",
        confidence: 0.8,
        patterns: ["frontend/UI patterns detected"],
      });
    }

    if (analysis.hasDataProcessingPatterns) {
      factors.push({
        category: "data_processing",
        confidence: 0.7,
        patterns: ["data processing patterns detected"],
      });
    }

    if (analysis.hasGamePatterns) {
      factors.push({
        category: "game",
        confidence: 0.9,
        patterns: ["game development patterns detected"],
      });
    }

    if (analysis.hasMobilePatterns) {
      factors.push({
        category: "mobile",
        confidence: 0.8,
        patterns: ["mobile development patterns detected"],
      });
    }

    if (analysis.hasDesktopPatterns) {
      factors.push({
        category: "desktop_app",
        confidence: 0.8,
        patterns: ["desktop application patterns detected"],
      });
    }

    return factors;
  }

  /**
   * Aggregate scores from all factors using weighted combination
   */
  private aggregateScores(factors: DetectionFactors): Record<string, number> {
    const scores: Record<string, number> = {};

    const hasSource = (factors.sourceFactors?.length ?? 0) > 0;
    const hasConfig = factors.configFactors.length > 0;

    // When we only have lightweight signals (e.g., Go or C# binaries) lean on
    // dependencies more heavily so obvious CLI frameworks still rank highly.
    const weights =
      hasSource || hasConfig
        ? {
            dependency: 0.5,
            source: 0.25,
            config: 0.25,
            script: 0.08,
            filePattern: 0.05,
          }
        : {
            dependency: 0.7,
            source: 0,
            config: 0,
            script: 0.2,
            filePattern: 0.1,
          };

    // Aggregate dependency factors
    factors.dependencyFactors.forEach((factor) => {
      scores[factor.category] =
        (scores[factor.category] || 0) + factor.confidence * weights.dependency;
    });

    // Aggregate source factors (if available)
    factors.sourceFactors?.forEach((factor) => {
      scores[factor.category] = (scores[factor.category] || 0) + factor.confidence * weights.source;
    });

    // Aggregate config factors
    factors.configFactors.forEach((factor) => {
      scores[factor.category] = (scores[factor.category] || 0) + factor.confidence * weights.config;
    });

    // Aggregate script factors
    factors.scriptFactors.forEach((factor) => {
      scores[factor.category] = (scores[factor.category] || 0) + factor.confidence * weights.script;
    });

    // Aggregate file pattern factors
    factors.filePatternFactors.forEach((factor) => {
      scores[factor.category] =
        (scores[factor.category] || 0) + factor.confidence * weights.filePattern;
    });

    // Enhanced default detection based on common patterns
    if (Object.keys(scores).length === 0 || Math.max(...Object.values(scores)) < 0.1) {
      // Try to make a more intelligent guess based on available evidence

      // Strong CLI indicators
      if (factors.configFactors.some((f) => f.category === "tool" && f.confidence > 0.5)) {
        scores["tool"] = 0.7;
      }
      // Strong package indicators
      else if (factors.configFactors.some((f) => f.category === "package" && f.confidence > 0.3)) {
        scores["package"] = 0.5;
      }
      // Check for web service patterns
      else if (
        factors.sourceFactors?.some((f) => f.category === "web_service" && f.confidence > 0.5)
      ) {
        scores["web_service"] = 0.6;
      }
      // Check for frontend patterns
      else if (
        factors.filePatternFactors.some((f) => f.category === "frontend" && f.confidence > 0.3)
      ) {
        scores["frontend"] = 0.5;
      }
      // Default to package with low confidence
      else {
        scores["package"] = 0.2;
      }
    }

    // Normalize scores but keep them reasonable
    Object.keys(scores).forEach((key) => {
      scores[key] = Math.min(1.0, scores[key]);
    });

    return scores;
  }

  /**
   * Generate human-readable explanation
   */
  private generateExplanation(
    context: DetectionContext,
    factors: DetectionFactors,
    primaryType: keyof CategoryMatrix,
  ): string[] {
    const explanation: string[] = [];

    explanation.push(`Detected as ${primaryType} based on:`);

    // Add dependency explanations
    const depFactor = factors.dependencyFactors.find((f) => f.category === primaryType);
    if (depFactor && depFactor.matches.length > 0) {
      explanation.push("Dependencies:");
      explanation.push(...depFactor.matches.slice(0, 3));
    }

    // Add source code explanations
    const sourceFactor = factors.sourceFactors?.find((f) => f.category === primaryType);
    if (sourceFactor && sourceFactor.patterns.length > 0) {
      explanation.push("Source code:");
      explanation.push(...sourceFactor.patterns);
    }

    // Add config explanations
    const configFactor = factors.configFactors.find((f) => f.category === primaryType);
    if (configFactor && configFactor.indicators.length > 0) {
      explanation.push("Configuration:");
      explanation.push(...configFactor.indicators);
    }

    // Add script explanations
    const scriptFactor = factors.scriptFactors.find((f) => f.category === primaryType);
    if (scriptFactor && scriptFactor.scripts.length > 0) {
      explanation.push("Scripts:");
      explanation.push(...scriptFactor.scripts.slice(0, 2));
    }

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
