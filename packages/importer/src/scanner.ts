/**
 * ScannerRunner - Multi-stage Brownfield Detection Pipeline Orchestrator
 *
 * This module implements a pure functional pipeline for analyzing existing codebases
 * and inferring architectural specifications. The pipeline follows a strict five-stage
 * approach with no side effects except file reading.
 *
 * Pipeline Stages:
 * 1. Discovery - File system walk with ignore rules
 * 2. Parse - Plugin-based evidence collection
 * 3. Infer - Artifact inference from evidence
 * 4. Normalize - De-duplication and confidence merging
 * 5. Validate - Sanity checks and error detection
 */

import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs-extra';
import { glob } from 'glob';
import {
  AnalysisConfiguration,
  AnalysisStatistics,
  ArtifactManifest,
  ArtifactType,
  ConfidenceScore,
  ConfigurationError,
  DirectoryInfo,
  Evidence,
  EvidenceType,
  FileIndex,
  FileInfo,
  FileSystemError,
  ImporterError,
  ImporterPlugin,
  InferenceContext,
  InferenceError,
  InferenceOptions,
  InferredArtifact,
  ParseContext,
  ParseError,
  ParseOptions,
  PluginError,
  ProjectMetadata,
} from './types';

// ============================================================================
// Scanner Configuration
// ============================================================================

/**
 * Configuration for the ScannerRunner
 */
export interface ScannerConfig {
  /** Root directory to analyze */
  projectRoot: string;
  /** Parse options */
  parseOptions: ParseOptions;
  /** Inference options */
  inferenceOptions: InferenceOptions;
  /** Registered plugins */
  plugins: ImporterPlugin[];
  /** Ignore patterns (like .gitignore) */
  ignorePatterns: string[];
  /** Maximum concurrent operations */
  maxConcurrency: number;
  /** Enable debug logging */
  debug: boolean;
}

/**
 * Default configuration values
 */
const DEFAULT_SCANNER_CONFIG: Partial<ScannerConfig> = {
  parseOptions: {
    deepAnalysis: false,
    targetLanguages: [],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    includeBinaries: false,
    patterns: {
      include: ['**/*'],
      exclude: [],
    },
  },
  inferenceOptions: {
    minConfidence: 0.3,
    inferRelationships: true,
    maxDependencyDepth: 5,
    useHeuristics: true,
  },
  ignorePatterns: [
    'node_modules/**',
    '.git/**',
    '**/.DS_Store',
    '**/Thumbs.db',
    '**/*.log',
    'dist/**',
    'build/**',
    'target/**',
    '**/__pycache__/**',
    '**/*.pyc',
    '.next/**',
    '.nuxt/**',
    'coverage/**',
  ],
  maxConcurrency: 10,
  debug: false,
};

// ============================================================================
// Plugin Registry
// ============================================================================

/**
 * Registry for managing importer detection plugins
 */
export class PluginRegistry {
  private plugins = new Map<string, ImporterPlugin>();
  private enabledPlugins = new Set<string>();

  /**
   * Register a plugin with the registry
   */
  register(plugin: ImporterPlugin): void {
    const name = plugin.name();
    if (this.plugins.has(name)) {
      throw new ConfigurationError(`Plugin ${name} is already registered`);
    }
    this.plugins.set(name, plugin);
    this.enabledPlugins.add(name);
  }

  /**
   * Unregister a plugin
   */
  unregister(name: string): void {
    this.plugins.delete(name);
    this.enabledPlugins.delete(name);
  }

  /**
   * Enable a plugin
   */
  enable(name: string): void {
    if (!this.plugins.has(name)) {
      throw new ConfigurationError(`Plugin ${name} is not registered`);
    }
    this.enabledPlugins.add(name);
  }

  /**
   * Disable a plugin
   */
  disable(name: string): void {
    this.enabledPlugins.delete(name);
  }

  /**
   * Get all enabled plugins
   */
  getEnabled(): ImporterPlugin[] {
    return Array.from(this.enabledPlugins)
      .map(name => this.plugins.get(name))
      .filter((plugin): plugin is ImporterPlugin => plugin !== undefined);
  }

  /**
   * Get plugins that support a specific file
   */
  getSupportingPlugins(filePath: string, fileContent?: string): ImporterPlugin[] {
    return this.getEnabled().filter(plugin => {
      try {
        return plugin.supports(filePath, fileContent);
      } catch (error) {
        // Plugin error in supports() check - skip this plugin
        return false;
      }
    });
  }

  /**
   * Get plugin by name
   */
  get(name: string): ImporterPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * List all registered plugin names
   */
  list(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Clear all plugins
   */
  clear(): void {
    this.plugins.clear();
    this.enabledPlugins.clear();
  }
}

// ============================================================================
// File System Utilities
// ============================================================================

/**
 * Build efficient file index with basename and suffix lookups
 */
async function buildFileIndex(
  projectRoot: string,
  ignorePatterns: string[],
  parseOptions: ParseOptions
): Promise<FileIndex> {
  const files = new Map<string, FileInfo>();
  const directories = new Map<string, DirectoryInfo>();

  // Build combined glob patterns
  const includePatterns =
    parseOptions.patterns.include.length > 0 ? parseOptions.patterns.include : ['**/*'];

  const excludePatterns = [...ignorePatterns, ...parseOptions.patterns.exclude];

  // Find all files using glob
  const allFiles = await glob(includePatterns, {
    cwd: projectRoot,
    ignore: excludePatterns,
    absolute: true,
    nodir: true,
    dot: false,
  });

  // Process each file
  for (const filePath of allFiles) {
    try {
      const stats = await fs.stat(filePath);

      if (!stats.isFile()) continue;

      // Skip files that are too large
      if (stats.size > parseOptions.maxFileSize) continue;

      const relativePath = path.relative(projectRoot, filePath);
      const extension = path.extname(filePath).toLowerCase();

      // Check if binary
      const isBinary = await isFileB(filePath, parseOptions.includeBinaries);
      if (isBinary && !parseOptions.includeBinaries) continue;

      // Generate file hash
      const hash = await generateFileHash(filePath);

      // Detect language
      const language = detectLanguage(filePath, extension);

      // Filter by target languages if specified
      if (parseOptions.targetLanguages.length > 0 && language) {
        if (!parseOptions.targetLanguages.includes(language)) continue;
      }

      const fileInfo: FileInfo = {
        path: filePath,
        relativePath,
        size: stats.size,
        lastModified: stats.mtime.getTime(),
        extension,
        isBinary,
        hash,
        language,
      };

      files.set(filePath, fileInfo);

      // Track directory info
      const dirPath = path.dirname(filePath);
      if (!directories.has(dirPath)) {
        const dirStats = await fs.stat(dirPath);
        directories.set(dirPath, {
          path: dirPath,
          relativePath: path.relative(projectRoot, dirPath),
          fileCount: 0,
          totalSize: 0,
          lastModified: dirStats.mtime.getTime(),
        });
      }

      // Update directory stats
      const dirInfo = directories.get(dirPath)!;
      dirInfo.fileCount++;
      dirInfo.totalSize += stats.size;
      dirInfo.lastModified = Math.max(dirInfo.lastModified, stats.mtime.getTime());
    } catch (error) {
      // Skip files that can't be read
      continue;
    }
  }

  return {
    root: projectRoot,
    files,
    directories,
    timestamp: Date.now(),
  };
}

/**
 * Check if a file is binary
 */
async function isFileB(filePath: string, includeBinaries: boolean): Promise<boolean> {
  if (includeBinaries) return false;

  try {
    const buffer = await fs.readFile(filePath, { flag: 'r' });
    const sample = buffer.subarray(0, Math.min(1024, buffer.length));

    // Check for null bytes (common in binary files)
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0) return true;
    }

    return false;
  } catch {
    return true; // Assume binary if can't read
  }
}

/**
 * Generate SHA-256 hash of file content
 */
async function generateFileHash(filePath: string): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
  } catch {
    return '';
  }
}

/**
 * Detect programming language from file path and extension
 */
function detectLanguage(filePath: string, extension: string): string | undefined {
  const languageMap: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp',
    '.rs': 'rust',
    '.go': 'go',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.dart': 'dart',
    '.r': 'r',
    '.R': 'r',
    '.sql': 'sql',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.fish': 'shell',
    '.ps1': 'powershell',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.json': 'json',
    '.xml': 'xml',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
  };

  return languageMap[extension];
}

// ============================================================================
// Confidence Scoring and Merging
// ============================================================================

/**
 * Merge confidence scores using weighted average
 */
function mergeConfidenceScores(scores: ConfidenceScore[]): ConfidenceScore {
  if (scores.length === 0) {
    return {
      overall: 0,
      breakdown: {},
      factors: [],
    };
  }

  if (scores.length === 1) {
    return scores[0];
  }

  // Calculate weighted average overall confidence
  const totalWeight = scores.reduce((sum, score) => sum + score.overall, 0);
  const overall = totalWeight / scores.length;

  // Merge breakdowns
  const breakdown: Record<string, number> = {};
  const allKeys = new Set(scores.flatMap(score => Object.keys(score.breakdown)));

  for (const key of allKeys) {
    const values = scores
      .map(score => score.breakdown[key])
      .filter((value): value is number => value !== undefined);

    if (values.length > 0) {
      breakdown[key] = values.reduce((sum, value) => sum + value, 0) / values.length;
    }
  }

  // Merge factors
  const factors = scores.flatMap(score => score.factors);

  return {
    overall,
    breakdown,
    factors,
  };
}

/**
 * Create confidence score from evidence
 */
function calculateConfidenceFromEvidence(evidence: Evidence[]): ConfidenceScore {
  if (evidence.length === 0) {
    return {
      overall: 0,
      breakdown: {},
      factors: [],
    };
  }

  // Calculate overall confidence as weighted average
  const totalConfidence = evidence.reduce((sum, e) => sum + e.confidence, 0);
  const overall = totalConfidence / evidence.length;

  // Calculate breakdown by evidence type
  const breakdown: Record<string, number> = {};
  const evidenceByType = new Map<string, Evidence[]>();

  for (const e of evidence) {
    if (!evidenceByType.has(e.type)) {
      evidenceByType.set(e.type, []);
    }
    evidenceByType.get(e.type)!.push(e);
  }

  for (const [type, evidenceList] of evidenceByType) {
    const typeConfidence =
      evidenceList.reduce((sum, e) => sum + e.confidence, 0) / evidenceList.length;
    breakdown[type] = typeConfidence;
  }

  // Generate confidence factors
  const factors = evidence.map(e => ({
    description: `Evidence from ${e.source} in ${path.basename(e.filePath)}`,
    weight: e.confidence,
    source: e.source,
  }));

  return {
    overall,
    breakdown,
    factors,
  };
}

// ============================================================================
// Main Scanner Runner Class
// ============================================================================

/**
 * Main orchestrator for the importer detection pipeline
 */
export class ScannerRunner {
  private config: ScannerConfig;
  private pluginRegistry: PluginRegistry;
  private cache = new Map<string, unknown>();

  constructor(config: Partial<ScannerConfig> = {}) {
    this.config = {
      ...DEFAULT_SCANNER_CONFIG,
      ...config,
    } as ScannerConfig;

    this.pluginRegistry = new PluginRegistry();

    // Register provided plugins
    if (config.plugins) {
      for (const plugin of config.plugins) {
        this.pluginRegistry.register(plugin);
      }
    }
  }

  /**
   * Run the complete importer detection pipeline
   */
  async scan(): Promise<ArtifactManifest> {
    const startTime = Date.now();

    try {
      this.debug('Starting importer detection pipeline');

      // Stage 1: Discovery
      this.debug('Stage 1: Discovery - Building file index');
      const fileIndex = await this.discoverFiles();

      // Stage 2: Parse
      this.debug('Stage 2: Parse - Collecting evidence');
      const evidence = await this.parseFiles(fileIndex);

      // Stage 3: Infer
      this.debug('Stage 3: Infer - Inferring artifacts');
      const artifacts = await this.inferArtifacts(evidence, fileIndex);

      // Stage 4: Normalize
      this.debug('Stage 4: Normalize - Normalizing and merging');
      const normalizedArtifacts = await this.normalizeArtifacts(artifacts);

      // Stage 5: Validate
      this.debug('Stage 5: Validate - Validating results');
      const validatedArtifacts = await this.validateArtifacts(normalizedArtifacts);

      // Generate final manifest
      const manifest = await this.generateManifest(
        validatedArtifacts,
        evidence,
        fileIndex,
        startTime
      );

      this.debug(`Pipeline completed in ${Date.now() - startTime}ms`);
      return manifest;
    } catch (error) {
      if (error instanceof ImporterError) {
        throw error;
      }
      throw new InferenceError(`Pipeline failed: ${error}`);
    }
  }

  // ============================================================================
  // Stage 1: Discovery
  // ============================================================================

  /**
   * Stage 1: Discover files in the project with ignore rules
   */
  private async discoverFiles(): Promise<FileIndex> {
    try {
      return await buildFileIndex(
        this.config.projectRoot,
        this.config.ignorePatterns,
        this.config.parseOptions
      );
    } catch (error) {
      throw new FileSystemError(this.config.projectRoot, `Failed to build file index: ${error}`);
    }
  }

  // ============================================================================
  // Stage 2: Parse
  // ============================================================================

  /**
   * Stage 2: Parse files using plugins to collect evidence
   */
  private async parseFiles(fileIndex: FileIndex): Promise<Evidence[]> {
    const allEvidence: Evidence[] = [];
    const failedFiles: string[] = [];

    const parseContext: ParseContext = {
      projectRoot: this.config.projectRoot,
      fileIndex,
      options: this.config.parseOptions,
      cache: this.cache,
    };

    // Process files in batches to control concurrency
    const files = Array.from(fileIndex.files.values());
    const batchSize = this.config.maxConcurrency;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      const batchPromises = batch.map(async fileInfo => {
        try {
          return await this.parseFile(fileInfo, parseContext);
        } catch (error) {
          failedFiles.push(fileInfo.path);
          if (error instanceof ParseError) {
            this.debug(`Parse error for ${fileInfo.path}: ${error.message}`);
          } else {
            this.debug(`Unexpected error parsing ${fileInfo.path}: ${error}`);
          }
          return [];
        }
      });

      const batchResults = await Promise.all(batchPromises);
      allEvidence.push(...batchResults.flat());
    }

    this.debug(
      `Collected ${allEvidence.length} evidence items from ${files.length - failedFiles.length}/${files.length} files`
    );

    if (failedFiles.length > 0) {
      this.debug(`Failed to parse ${failedFiles.length} files`);
    }

    return allEvidence;
  }

  /**
   * Parse a single file using appropriate plugins
   */
  private async parseFile(fileInfo: FileInfo, parseContext: ParseContext): Promise<Evidence[]> {
    // Skip binary files unless explicitly included
    if (fileInfo.isBinary && !this.config.parseOptions.includeBinaries) {
      return [];
    }

    // Read file content for text files
    let fileContent: string | undefined;
    if (!fileInfo.isBinary) {
      try {
        fileContent = await fs.readFile(fileInfo.path, 'utf-8');
      } catch (error) {
        throw new ParseError(fileInfo.path, `Failed to read file: ${error}`);
      }
    }

    // Find plugins that support this file
    const supportingPlugins = this.pluginRegistry.getSupportingPlugins(fileInfo.path, fileContent);

    if (supportingPlugins.length === 0) {
      return [];
    }

    // Collect evidence from all supporting plugins
    const evidence: Evidence[] = [];

    for (const plugin of supportingPlugins) {
      try {
        const pluginEvidence = await plugin.parse(fileInfo.path, fileContent, parseContext);
        evidence.push(...pluginEvidence);
      } catch (error) {
        throw new PluginError(
          plugin.name(),
          `Failed to parse ${fileInfo.path}: ${error}`,
          error as Error
        );
      }
    }

    return evidence;
  }

  // ============================================================================
  // Stage 3: Infer
  // ============================================================================

  /**
   * Stage 3: Infer artifacts from collected evidence
   */
  private async inferArtifacts(
    evidence: Evidence[],
    fileIndex: FileIndex
  ): Promise<InferredArtifact[]> {
    const inferenceContext: InferenceContext = {
      projectRoot: this.config.projectRoot,
      fileIndex,
      allEvidence: evidence,
      options: this.config.inferenceOptions,
      cache: this.cache,
    };

    const allArtifacts: InferredArtifact[] = [];
    const enabledPlugins = this.pluginRegistry.getEnabled();

    // Each plugin can infer artifacts from the complete evidence set
    for (const plugin of enabledPlugins) {
      try {
        const pluginArtifacts = await plugin.infer(evidence, inferenceContext);
        allArtifacts.push(...pluginArtifacts);
      } catch (error) {
        throw new PluginError(plugin.name(), `Failed to infer artifacts: ${error}`, error as Error);
      }
    }

    this.debug(`Inferred ${allArtifacts.length} artifacts from ${evidence.length} evidence items`);
    return allArtifacts;
  }

  // ============================================================================
  // Stage 4: Normalize
  // ============================================================================

  /**
   * Stage 4: Normalize artifacts by de-duplicating and merging confidence
   */
  private async normalizeArtifacts(artifacts: InferredArtifact[]): Promise<InferredArtifact[]> {
    // Group artifacts by type and identifier for merging
    const artifactGroups = new Map<string, InferredArtifact[]>();

    for (const artifact of artifacts) {
      const key = `${artifact.artifact.type}:${artifact.artifact.id}`;
      if (!artifactGroups.has(key)) {
        artifactGroups.set(key, []);
      }
      artifactGroups.get(key)!.push(artifact);
    }

    const normalizedArtifacts: InferredArtifact[] = [];

    // Merge artifacts with the same type and ID
    for (const [key, group] of artifactGroups) {
      if (group.length === 1) {
        normalizedArtifacts.push(group[0]);
      } else {
        // Merge multiple artifacts with the same identifier
        const merged = this.mergeArtifacts(group);
        normalizedArtifacts.push(merged);
      }
    }

    // Filter by minimum confidence threshold
    const filteredArtifacts = normalizedArtifacts.filter(
      artifact => artifact.confidence.overall >= this.config.inferenceOptions.minConfidence
    );

    this.debug(
      `Normalized ${artifacts.length} artifacts to ${normalizedArtifacts.length}, filtered to ${filteredArtifacts.length} above confidence threshold`
    );

    return filteredArtifacts;
  }

  /**
   * Merge multiple artifacts with the same identifier
   */
  private mergeArtifacts(artifacts: InferredArtifact[]): InferredArtifact {
    if (artifacts.length === 1) {
      return artifacts[0];
    }

    const first = artifacts[0];

    // Merge confidence scores
    const confidenceScores = artifacts.map(a => a.confidence);
    const mergedConfidence = mergeConfidenceScores(confidenceScores);

    // Merge provenance
    const allEvidence = new Set(artifacts.flatMap(a => a.provenance.evidence));
    const allPlugins = new Set(artifacts.flatMap(a => a.provenance.plugins));
    const allRules = new Set(artifacts.flatMap(a => a.provenance.rules));

    // Merge relationships (de-duplicate by type and target)
    const relationshipMap = new Map<string, (typeof first.relationships)[0]>();
    for (const artifact of artifacts) {
      for (const rel of artifact.relationships) {
        const key = `${rel.type}:${rel.targetId}`;
        const existing = relationshipMap.get(key);
        if (!existing || rel.confidence > existing.confidence) {
          relationshipMap.set(key, rel);
        }
      }
    }

    // Merge metadata (later artifacts override earlier ones)
    const mergedMetadata = { ...first.artifact.metadata };
    for (let i = 1; i < artifacts.length; i++) {
      Object.assign(mergedMetadata, artifacts[i].artifact.metadata);
    }

    return {
      artifact: {
        ...first.artifact,
        metadata: mergedMetadata,
      },
      confidence: mergedConfidence,
      provenance: {
        evidence: Array.from(allEvidence),
        plugins: Array.from(allPlugins),
        rules: Array.from(allRules),
        timestamp: Math.max(...artifacts.map(a => a.provenance.timestamp)),
        pipelineVersion: first.provenance.pipelineVersion,
      },
      relationships: Array.from(relationshipMap.values()),
    };
  }

  // ============================================================================
  // Stage 5: Validate
  // ============================================================================

  /**
   * Stage 5: Validate artifacts for sanity and consistency
   */
  private async validateArtifacts(artifacts: InferredArtifact[]): Promise<InferredArtifact[]> {
    const validArtifacts: InferredArtifact[] = [];
    const errors: string[] = [];

    for (const artifact of artifacts) {
      try {
        this.validateArtifact(artifact);
        validArtifacts.push(artifact);
      } catch (error) {
        errors.push(`Artifact ${artifact.artifact.id}: ${error}`);
      }
    }

    if (errors.length > 0) {
      this.debug(`Validation errors: ${errors.join(', ')}`);
    }

    this.debug(`Validated ${validArtifacts.length}/${artifacts.length} artifacts`);
    return validArtifacts;
  }

  /**
   * Validate a single artifact
   */
  private validateArtifact(artifact: InferredArtifact): void {
    // Basic validation
    if (!artifact.artifact.id) {
      throw new Error('Artifact missing ID');
    }

    if (!artifact.artifact.name) {
      throw new Error('Artifact missing name');
    }

    if (artifact.confidence.overall < 0 || artifact.confidence.overall > 1) {
      throw new Error('Invalid confidence score');
    }

    // Type-specific validation
    switch (artifact.artifact.type) {
      case 'service':
        this.validateServiceArtifact(artifact);
        break;
      case 'binary':
        this.validateBinaryArtifact(artifact);
        break;
      // Add other type validations as needed
    }
  }

  private validateServiceArtifact(artifact: InferredArtifact): void {
    const metadata = artifact.artifact.metadata;

    if (!metadata.language) {
      throw new Error('Service missing language');
    }

    if (typeof metadata.port === 'number' && (metadata.port < 1 || metadata.port > 65535)) {
      throw new Error('Invalid port number');
    }
  }

  private validateBinaryArtifact(artifact: InferredArtifact): void {
    const metadata = artifact.artifact.metadata;

    if (!metadata.language) {
      throw new Error('Binary missing language');
    }

    if (!metadata.entryPoint) {
      throw new Error('Binary missing entry point');
    }
  }

  // ============================================================================
  // Manifest Generation
  // ============================================================================

  /**
   * Generate the final artifact manifest
   */
  private async generateManifest(
    artifacts: InferredArtifact[],
    evidence: Evidence[],
    fileIndex: FileIndex,
    startTime: number
  ): Promise<ArtifactManifest> {
    const projectMetadata = await this.generateProjectMetadata(fileIndex);
    const statistics = this.generateStatistics(artifacts, evidence, startTime);
    const configuration = this.generateConfiguration();

    return {
      version: '1.0.0',
      project: projectMetadata,
      artifacts,
      statistics,
      configuration,
      timestamp: Date.now(),
    };
  }

  /**
   * Generate project metadata
   */
  private async generateProjectMetadata(fileIndex: FileIndex): Promise<ProjectMetadata> {
    const files = Array.from(fileIndex.files.values());

    // Detect languages
    const languages = new Set(
      files.map(f => f.language).filter((lang): lang is string => lang !== undefined)
    );

    // Detect frameworks (basic heuristic)
    const frameworks = new Set<string>();
    const packageJsonFiles = files.filter(f => f.relativePath.endsWith('package.json'));
    for (const file of packageJsonFiles) {
      try {
        const content = await fs.readFile(file.path, 'utf-8');
        const pkg = JSON.parse(content);

        // Check dependencies for common frameworks
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps.react) frameworks.add('react');
        if (deps.vue) frameworks.add('vue');
        if (deps.angular) frameworks.add('angular');
        if (deps.express) frameworks.add('express');
        if (deps.fastify) frameworks.add('fastify');
        if (deps.next) frameworks.add('next.js');
        if (deps.nuxt) frameworks.add('nuxt.js');
      } catch {
        // Ignore JSON parse errors
      }
    }

    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const projectName = path.basename(this.config.projectRoot);

    return {
      name: projectName,
      root: this.config.projectRoot,
      languages: Array.from(languages),
      frameworks: Array.from(frameworks),
      fileCount: files.length,
      totalSize,
    };
  }

  /**
   * Generate analysis statistics
   */
  private generateStatistics(
    artifacts: InferredArtifact[],
    evidence: Evidence[],
    startTime: number
  ): AnalysisStatistics {
    // Count artifacts by type
    const artifactCounts: Record<ArtifactType, number> = {
      service: 0,
      binary: 0,
      library: 0,
      job: 0,
      schema: 0,
      config: 0,
      deployment: 0,
      test: 0,
      frontend: 0,
      database: 0,
      cache: 0,
      queue: 0,
      proxy: 0,
      monitor: 0,
      auth: 0,
      docs: 0,
    };

    for (const artifact of artifacts) {
      artifactCounts[artifact.artifact.type]++;
    }

    // Count evidence by type
    const evidenceCounts: Record<EvidenceType, number> = {
      dependency: 0,
      import: 0,
      export: 0,
      function: 0,
      class: 0,
      interface: 0,
      config: 0,
      route: 0,
      schema: 0,
      test: 0,
      comment: 0,
      annotation: 0,
      environment: 0,
      build: 0,
      deployment: 0,
      infrastructure: 0,
    };

    for (const item of evidence) {
      evidenceCounts[item.type]++;
    }

    // Calculate average confidence by artifact type
    const averageConfidence: Record<ArtifactType, number> = {} as Record<ArtifactType, number>;
    const confidenceByType = new Map<ArtifactType, number[]>();

    for (const artifact of artifacts) {
      const type = artifact.artifact.type;
      if (!confidenceByType.has(type)) {
        confidenceByType.set(type, []);
      }
      confidenceByType.get(type)!.push(artifact.confidence.overall);
    }

    for (const [type, confidences] of confidenceByType) {
      averageConfidence[type] = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
    }

    return {
      artifactCounts,
      evidenceCounts,
      averageConfidence,
      processingTimeMs: Date.now() - startTime,
      pluginsExecuted: this.pluginRegistry.getEnabled().map(p => p.name()),
      failedFiles: [], // Could track this in parseFiles if needed
    };
  }

  /**
   * Generate analysis configuration
   */
  private generateConfiguration(): AnalysisConfiguration {
    return {
      parseOptions: this.config.parseOptions,
      inferenceOptions: this.config.inferenceOptions,
      enabledPlugins: this.pluginRegistry.getEnabled().map(p => p.name()),
      pluginConfiguration: {}, // Could be extended for per-plugin config
    };
  }

  // ============================================================================
  // Plugin Management
  // ============================================================================

  /**
   * Register a plugin
   */
  registerPlugin(plugin: ImporterPlugin): void {
    this.pluginRegistry.register(plugin);
  }

  /**
   * Get the plugin registry
   */
  getPluginRegistry(): PluginRegistry {
    return this.pluginRegistry;
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Debug logging
   */
  private debug(message: string): void {
    if (this.config.debug) {
      console.debug(`[ScannerRunner] ${message}`);
    }
  }
}

/**
 * Convenience function to create and run a scanner
 */
export async function scanProject(
  projectRoot: string,
  config: Partial<ScannerConfig> = {}
): Promise<ArtifactManifest> {
  const scanner = new ScannerRunner({
    projectRoot,
    ...config,
  });

  return await scanner.scan();
}

/**
 * Export the default scanner configuration for external use
 */
export { DEFAULT_SCANNER_CONFIG };
