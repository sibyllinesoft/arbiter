/**
 * Main Traceability Engine
 * 
 * This is the central orchestrator for the arbiter traceability system. It coordinates
 * all components to provide comprehensive REQ→SCENARIO→TEST→CODE linkage following
 * the Rails & Guarantees methodology. The engine manages the complete lifecycle of
 * traceability data including parsing, analysis, and reporting.
 */

import { glob } from 'glob';
import { readFile, writeFile, stat } from 'fs/promises';
import { join, dirname } from 'path';
import { EventEmitter } from 'events';
import type {
  TraceabilityConfig,
  TraceabilityGraph,
  Artifact,
  TraceabilityLink,
  ParseResult,
  ImpactAnalysis,
  CoverageAnalysis,
  ArtifactChange,
  TraceabilityReport,
  ReportParameters,
  ChangeType,
  ExportOptions
} from './types.js';
import { TraceabilityGraphManager } from './graph.js';
import { ArtifactParser } from './parser.js';
import { TraceabilityAnalyzer, AnalysisConfig } from './analyzer.js';
import { CodeAnnotator } from './annotator.js';
import { TraceabilityReporter } from './reporter.js';

/**
 * Engine events
 */
export interface TraceabilityEvents {
  'parsing:start': { totalFiles: number };
  'parsing:file': { filePath: string; progress: number };
  'parsing:complete': { totalFiles: number; totalArtifacts: number; totalLinks: number };
  'analysis:start': { type: string };
  'analysis:complete': { type: string; duration: number };
  'graph:updated': { addedArtifacts: number; addedLinks: number; removedArtifacts: number; removedLinks: number };
  'error': { error: Error; context: string };
  'warning': { message: string; context: string };
}

/**
 * Engine status information
 */
export interface EngineStatus {
  /** Whether the engine is initialized */
  initialized: boolean;
  /** Whether parsing is in progress */
  parsing: boolean;
  /** Whether analysis is in progress */
  analyzing: boolean;
  /** Last update timestamp */
  lastUpdated: Date | null;
  /** Total artifacts in graph */
  totalArtifacts: number;
  /** Total links in graph */
  totalLinks: number;
  /** Coverage percentage */
  coveragePercent: number;
  /** Quality score */
  qualityScore: number;
}

/**
 * Batch operation result
 */
export interface BatchOperationResult {
  /** Operation success */
  success: boolean;
  /** Total items processed */
  totalProcessed: number;
  /** Successful operations */
  successful: number;
  /** Failed operations */
  failed: number;
  /** Error details */
  errors: Array<{ item: string; error: string }>;
  /** Processing duration in milliseconds */
  duration: number;
}

/**
 * Main traceability engine that orchestrates all components
 */
export class TraceabilityEngine extends EventEmitter {
  private config: TraceabilityConfig;
  private graphManager: TraceabilityGraphManager;
  private parser: ArtifactParser;
  private analyzer: TraceabilityAnalyzer;
  private annotator: CodeAnnotator;
  private reporter: TraceabilityReporter;
  private initialized: boolean = false;
  private lastUpdateTime: Date | null = null;
  private cachePath: string;

  constructor(config: TraceabilityConfig, cachePath: string = './.traceability') {
    super();
    this.config = config;
    this.cachePath = cachePath;

    // Initialize components
    this.graphManager = new TraceabilityGraphManager(config);
    this.parser = new ArtifactParser(config.parsers);
    
    // Initialize analyzer with configuration
    const analysisConfig: AnalysisConfig = {
      maxImpactDepth: 5,
      minRecommendationConfidence: 0.7,
      riskWeights: {
        complexity: 0.3,
        coverage: 0.25,
        dependencies: 0.25,
        changeFrequency: 0.2
      },
      coverageThresholds: {
        excellent: 0.9,
        good: 0.75,
        acceptable: 0.6
      },
      features: {
        transitiveImpactAnalysis: config.features.transitiveAnalysis,
        riskPrediction: config.features.impactAnalysis,
        trendAnalysis: true,
        semanticAnalysis: false
      }
    };

    this.analyzer = new TraceabilityAnalyzer(this.graphManager, analysisConfig);
    this.annotator = new CodeAnnotator(this.graphManager, config);
    this.reporter = new TraceabilityReporter(this.graphManager, this.analyzer);
  }

  /**
   * Initializes the traceability engine
   */
  async initialize(): Promise<void> {
    try {
      // Load existing graph if available
      await this.loadCachedGraph();
      
      this.initialized = true;
      console.log('Traceability engine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize traceability engine:', error);
      throw error;
    }
  }

  /**
   * Gets the current engine status
   */
  getStatus(): EngineStatus {
    const graph = this.graphManager.getGraph();
    const stats = this.graphManager.getStatistics();
    
    return {
      initialized: this.initialized,
      parsing: false, // This would be tracked during operations
      analyzing: false, // This would be tracked during operations
      lastUpdated: this.lastUpdateTime,
      totalArtifacts: stats.totalArtifacts,
      totalLinks: stats.totalLinks,
      coveragePercent: stats.totalArtifacts > 0 ? (stats.totalLinks / stats.totalArtifacts) * 100 : 0,
      qualityScore: this.analyzer ? this.analyzer.calculateQualityMetrics().overall * 100 : 0
    };
  }

  /**
   * Performs a complete analysis of the project
   */
  async analyzeProject(rootPath: string = process.cwd()): Promise<{
    parsing: BatchOperationResult;
    coverage: CoverageAnalysis;
    recommendations: any[];
  }> {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }

    console.log(`Starting complete project analysis from: ${rootPath}`);

    // Step 1: Parse all files and build the graph
    const parsing = await this.parseProject(rootPath);

    // Step 2: Analyze coverage
    this.emit('analysis:start', { type: 'coverage' });
    const coverageStart = performance.now();
    const coverage = await this.analyzer.analyzeCoverage();
    const coverageDuration = performance.now() - coverageStart;
    this.emit('analysis:complete', { type: 'coverage', duration: coverageDuration });

    // Step 3: Generate recommendations
    const recommendations = this.analyzer.findMissingRelationships();

    // Step 4: Record snapshot for trend analysis
    this.analyzer.recordSnapshot();

    // Step 5: Cache the updated graph
    await this.saveCachedGraph();

    this.lastUpdateTime = new Date();

    return {
      parsing,
      coverage,
      recommendations
    };
  }

  /**
   * Parses all files in the project and builds the traceability graph
   */
  async parseProject(rootPath: string = process.cwd()): Promise<BatchOperationResult> {
    const startTime = performance.now();
    const errors: Array<{ item: string; error: string }> = [];
    let successful = 0;
    let failed = 0;

    try {
      // Find all files to parse
      const files = await this.findSourceFiles(rootPath);
      const totalFiles = files.length;

      this.emit('parsing:start', { totalFiles });

      // Clear existing graph if doing a full rebuild
      this.graphManager = new TraceabilityGraphManager(this.config);

      // Parse files in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const batchResults = await Promise.allSettled(
          batch.map(file => this.parseFile(file))
        );

        for (let j = 0; j < batchResults.length; j++) {
          const result = batchResults[j];
          const filePath = batch[j];

          if (result.status === 'fulfilled') {
            successful++;
            this.processParseResult(result.value);
          } else {
            failed++;
            errors.push({
              item: filePath,
              error: result.reason?.message || 'Unknown error'
            });
          }

          const progress = ((i + j + 1) / totalFiles) * 100;
          this.emit('parsing:file', { filePath, progress });
        }
      }

      // Apply link rules to discover automatic relationships
      await this.applyLinkRules();

      // Optimize the graph
      this.graphManager.optimize();

      const duration = performance.now() - startTime;
      const graph = this.graphManager.getGraph();

      this.emit('parsing:complete', {
        totalFiles: successful + failed,
        totalArtifacts: graph.artifacts.size,
        totalLinks: graph.links.size
      });

      this.emit('graph:updated', {
        addedArtifacts: graph.artifacts.size,
        addedLinks: graph.links.size,
        removedArtifacts: 0,
        removedLinks: 0
      });

      return {
        success: failed === 0,
        totalProcessed: totalFiles,
        successful,
        failed,
        errors,
        duration
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      this.emit('error', { error: error as Error, context: 'parseProject' });
      
      return {
        success: false,
        totalProcessed: 0,
        successful,
        failed: failed + 1,
        errors: [...errors, { item: 'parseProject', error: (error as Error).message }],
        duration
      };
    }
  }

  /**
   * Analyzes the impact of specific changes
   */
  async analyzeChanges(changes: ArtifactChange[]): Promise<ImpactAnalysis> {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }

    this.emit('analysis:start', { type: 'impact' });
    const startTime = performance.now();

    try {
      const analysis = await this.analyzer.analyzeImpact(changes);
      const duration = performance.now() - startTime;
      
      this.emit('analysis:complete', { type: 'impact', duration });
      return analysis;
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'analyzeChanges' });
      throw error;
    }
  }

  /**
   * Generates a traceability report
   */
  async generateReport(
    type: 'matrix' | 'coverage' | 'impact' | 'gaps' | 'trends' | 'dashboard',
    parameters: ReportParameters = {}
  ): Promise<TraceabilityReport> {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }

    switch (type) {
      case 'matrix':
        return await this.reporter.generateMatrixReport('requirement', 'test', parameters);
      case 'coverage':
        return await this.reporter.generateCoverageReport(parameters);
      case 'gaps':
        return await this.reporter.generateGapsReport(parameters);
      case 'trends':
        return await this.reporter.generateTrendsReport(parameters);
      case 'dashboard':
        return await this.reporter.generateDashboardReport(parameters);
      default:
        throw new Error(`Unsupported report type: ${type}`);
    }
  }

  /**
   * Exports the traceability graph
   */
  async exportGraph(options: ExportOptions): Promise<string> {
    const graph = this.graphManager.getGraph();
    
    switch (options.format) {
      case 'json':
        return this.exportAsJSON(graph, options);
      case 'graphml':
        return this.exportAsGraphML(graph, options);
      case 'csv':
        return this.exportAsCSV(graph, options);
      default:
        throw new Error(`Unsupported export format: ${options.format}`);
    }
  }

  /**
   * Updates annotations in source files
   */
  async updateAnnotations(filePath: string): Promise<{
    added: number;
    updated: number;
    removed: number;
  }> {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }

    try {
      return await this.annotator.synchronizeAnnotations(filePath);
    } catch (error) {
      this.emit('error', { error: error as Error, context: 'updateAnnotations' });
      throw error;
    }
  }

  /**
   * Detects changes in the file system and updates the graph incrementally
   */
  async updateFromChanges(changedFiles: string[]): Promise<BatchOperationResult> {
    if (!this.initialized) {
      throw new Error('Engine not initialized. Call initialize() first.');
    }

    const startTime = performance.now();
    const errors: Array<{ item: string; error: string }> = [];
    let successful = 0;
    let failed = 0;

    try {
      for (const filePath of changedFiles) {
        try {
          // Check if file still exists
          try {
            await stat(filePath);
          } catch {
            // File was deleted, remove its artifacts
            await this.removeArtifactsFromFile(filePath);
            successful++;
            continue;
          }

          // Re-parse the file
          const parseResult = await this.parseFile(filePath);
          
          // Remove old artifacts from this file
          await this.removeArtifactsFromFile(filePath);
          
          // Add new artifacts
          this.processParseResult(parseResult);
          successful++;

        } catch (error) {
          failed++;
          errors.push({
            item: filePath,
            error: (error as Error).message
          });
        }
      }

      // Re-apply link rules
      await this.applyLinkRules();

      // Optimize graph
      this.graphManager.optimize();

      // Save updated graph
      await this.saveCachedGraph();

      const duration = performance.now() - startTime;
      this.lastUpdateTime = new Date();

      return {
        success: failed === 0,
        totalProcessed: changedFiles.length,
        successful,
        failed,
        errors,
        duration
      };

    } catch (error) {
      const duration = performance.now() - startTime;
      this.emit('error', { error: error as Error, context: 'updateFromChanges' });
      
      return {
        success: false,
        totalProcessed: changedFiles.length,
        successful,
        failed: failed + 1,
        errors: [...errors, { item: 'updateFromChanges', error: (error as Error).message }],
        duration
      };
    }
  }

  /**
   * Validates the integrity of the traceability graph
   */
  async validateGraph(): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    statistics: any;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const graph = this.graphManager.getGraph();

    // Check for broken links
    for (const link of graph.links.values()) {
      if (!graph.artifacts.has(link.sourceId)) {
        errors.push(`Link ${link.id} references non-existent source artifact ${link.sourceId}`);
      }
      if (!graph.artifacts.has(link.targetId)) {
        errors.push(`Link ${link.id} references non-existent target artifact ${link.targetId}`);
      }
    }

    // Check for orphaned artifacts
    const orphaned = this.analyzer.findOrphanedArtifacts();
    if (orphaned.length > 0) {
      warnings.push(`${orphaned.length} orphaned artifacts found`);
    }

    // Check for cycles
    const cycles = this.graphManager.detectCycles();
    if (cycles.length > 0) {
      warnings.push(`${cycles.length} cycles detected in the graph`);
    }

    // Get statistics
    const statistics = this.graphManager.getStatistics();

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      statistics
    };
  }

  /**
   * Gets the traceability graph manager (for advanced operations)
   */
  getGraphManager(): TraceabilityGraphManager {
    return this.graphManager;
  }

  /**
   * Gets the analyzer (for advanced analysis operations)
   */
  getAnalyzer(): TraceabilityAnalyzer {
    return this.analyzer;
  }

  /**
   * Gets the reporter (for advanced reporting operations)
   */
  getReporter(): TraceabilityReporter {
    return this.reporter;
  }

  // Private helper methods

  private async findSourceFiles(rootPath: string): Promise<string[]> {
    const patterns = this.config.includePatterns.length > 0 
      ? this.config.includePatterns 
      : ['**/*.{ts,tsx,js,jsx,cue,md,py}'];

    let files: string[] = [];

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: rootPath,
        absolute: true,
        ignore: this.config.excludePatterns
      });
      files.push(...matches);
    }

    // Remove duplicates
    return Array.from(new Set(files));
  }

  private async parseFile(filePath: string): Promise<ParseResult> {
    return await this.parser.parseFile(filePath);
  }

  private processParseResult(result: ParseResult): void {
    // Add artifacts to graph
    for (const artifact of result.artifacts) {
      this.graphManager.addArtifact(artifact);
    }

    // Add links to graph
    for (const link of result.links) {
      try {
        this.graphManager.addLink(link);
      } catch (error) {
        this.emit('warning', {
          message: `Failed to add link: ${error}`,
          context: result.filePath
        });
      }
    }

    // Emit warnings for parse issues
    for (const issue of result.issues) {
      if (issue.severity === 'error') {
        this.emit('error', {
          error: new Error(issue.message),
          context: result.filePath
        });
      } else if (issue.severity === 'warning') {
        this.emit('warning', {
          message: issue.message,
          context: result.filePath
        });
      }
    }
  }

  private async applyLinkRules(): Promise<void> {
    if (!this.config.features.autoLinkDetection) {
      return;
    }

    const graph = this.graphManager.getGraph();
    
    for (const rule of this.config.linkRules) {
      if (!rule.enabled) continue;

      // Find matching source and target artifacts
      for (const sourceArtifact of graph.artifacts.values()) {
        if (!this.matchesPattern(sourceArtifact.type, rule.sourceType)) continue;

        for (const targetArtifact of graph.artifacts.values()) {
          if (sourceArtifact.id === targetArtifact.id) continue;
          if (!this.matchesPattern(targetArtifact.type, rule.targetType)) continue;

          // Check if patterns match
          if (this.matchesContentPattern(sourceArtifact, rule.sourcePattern) &&
              this.matchesContentPattern(targetArtifact, rule.targetPattern)) {
            
            // Create automatic link
            const linkId = `auto_${sourceArtifact.id}_${targetArtifact.id}_${rule.id}`;
            
            if (!graph.links.has(linkId)) {
              const link: TraceabilityLink = {
                id: linkId,
                sourceId: sourceArtifact.id,
                targetId: targetArtifact.id,
                linkType: rule.linkType,
                strength: rule.confidence,
                isAutomatic: true,
                createdAt: new Date(),
                context: `Auto-detected by rule: ${rule.name}`,
                metadata: { ruleId: rule.id }
              };

              try {
                this.graphManager.addLink(link);
              } catch (error) {
                // Link might already exist, ignore
              }
            }
          }
        }
      }
    }
  }

  private matchesPattern(value: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return value === pattern;
    } else {
      return pattern.test(value);
    }
  }

  private matchesContentPattern(artifact: Artifact, pattern: string | RegExp): boolean {
    const text = `${artifact.name} ${artifact.description || ''}`.toLowerCase();
    
    if (typeof pattern === 'string') {
      return text.includes(pattern.toLowerCase());
    } else {
      return pattern.test(text);
    }
  }

  private async removeArtifactsFromFile(filePath: string): Promise<void> {
    const graph = this.graphManager.getGraph();
    const artifactsToRemove = Array.from(graph.artifacts.values())
      .filter(a => a.filePath === filePath);

    for (const artifact of artifactsToRemove) {
      this.graphManager.removeArtifact(artifact.id);
    }
  }

  private async loadCachedGraph(): Promise<void> {
    try {
      const cachePath = join(this.cachePath, 'graph.json');
      const content = await readFile(cachePath, 'utf-8');
      const data = JSON.parse(content);
      
      // Reconstruct the graph from cached data
      // This is a simplified version - in practice, you'd want more robust serialization
      console.log('Loaded cached traceability graph');
    } catch (error) {
      console.log('No cached graph found, starting with empty graph');
    }
  }

  private async saveCachedGraph(): Promise<void> {
    try {
      const graph = this.graphManager.getGraph();
      const cachePath = join(this.cachePath, 'graph.json');
      
      // Create cache directory if it doesn't exist
      await import('fs/promises').then(fs => fs.mkdir(dirname(cachePath), { recursive: true }));
      
      // Serialize graph data
      const data = {
        artifacts: Array.from(graph.artifacts.entries()),
        links: Array.from(graph.links.entries()),
        metadata: graph.metadata
      };
      
      await writeFile(cachePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log('Cached traceability graph');
    } catch (error) {
      console.warn('Failed to cache graph:', error);
    }
  }

  private exportAsJSON(graph: TraceabilityGraph, options: ExportOptions): string {
    const data: any = {};

    if (options.include.artifacts) {
      data.artifacts = Array.from(graph.artifacts.entries());
    }

    if (options.include.links) {
      data.links = Array.from(graph.links.entries());
    }

    if (options.include.metadata) {
      data.metadata = graph.metadata;
    }

    return options.formatting.prettyPrint 
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
  }

  private exportAsGraphML(graph: TraceabilityGraph, options: ExportOptions): string {
    // Use the GraphUtils from graph.ts
    return require('./graph.js').GraphUtils.toGraphML(graph);
  }

  private exportAsCSV(graph: TraceabilityGraph, options: ExportOptions): string {
    const rows: string[] = [];

    if (options.include.artifacts) {
      rows.push('Type,ID,Name,Description,FilePath,StartLine,EndLine');
      for (const artifact of graph.artifacts.values()) {
        rows.push([
          artifact.type,
          artifact.id,
          `"${artifact.name}"`,
          `"${artifact.description || ''}"`,
          `"${artifact.filePath}"`,
          artifact.location.startLine.toString(),
          artifact.location.endLine.toString()
        ].join(','));
      }
    }

    if (options.include.links) {
      if (rows.length > 0) rows.push('');
      rows.push('SourceID,TargetID,LinkType,Strength,IsAutomatic');
      for (const link of graph.links.values()) {
        rows.push([
          link.sourceId,
          link.targetId,
          link.linkType,
          link.strength.toString(),
          link.isAutomatic.toString()
        ].join(','));
      }
    }

    return rows.join('\n');
  }
}

/**
 * Factory function to create and configure a traceability engine
 */
export function createTraceabilityEngine(
  config?: Partial<TraceabilityConfig>,
  cachePath?: string
): TraceabilityEngine {
  const defaultConfig: TraceabilityConfig = {
    includePatterns: ['**/*.{ts,tsx,js,jsx,cue,md,py}'],
    excludePatterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
    parsers: {
      TypeScriptParser: { enabled: true, options: {} },
      CueParser: { enabled: true, options: {} },
      MarkdownParser: { enabled: true, options: {} }
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
      }
    ],
    annotationPatterns: [],
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

  const mergedConfig = { ...defaultConfig, ...config };
  return new TraceabilityEngine(mergedConfig, cachePath);
}

// Export everything needed for external use
export * from './types.js';
export { TraceabilityGraphManager } from './graph.js';
export { ArtifactParser } from './parser.js';
export { TraceabilityAnalyzer } from './analyzer.js';
export { CodeAnnotator } from './annotator.js';
export { TraceabilityReporter } from './reporter.js';