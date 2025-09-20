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
 * Git-first file discovery with allowlist and content guards
 */
async function buildFileIndex(
  projectRoot: string,
  ignorePatterns: string[],
  parseOptions: ParseOptions
): Promise<FileIndex> {
  const files = new Map<string, FileInfo>();
  const directories = new Map<string, DirectoryInfo>();

  // Try git-first enumeration, fall back to glob if no git repo
  const allFiles =
    (await tryGitFileEnumeration(projectRoot)) ??
    (await fallbackGlobEnumeration(projectRoot, ignorePatterns, parseOptions));

  // Process each file with enhanced filters and git metadata
  for (const filePath of allFiles) {
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) continue;

      // Skip files that are too large
      if (stats.size > parseOptions.maxFileSize) continue;

      const relativePath = path.relative(projectRoot, filePath);
      const extension = path.extname(filePath).toLowerCase();

      // Apply path heuristics - drop noise paths
      if (shouldIgnorePath(relativePath)) continue;

      // Apply config allowlist with basename check
      if (!passesConfigAllowlist(relativePath, path.basename(filePath))) continue;

      // Check if binary
      const isBinary = await isFileB(filePath, parseOptions.includeBinaries);
      if (isBinary && !parseOptions.includeBinaries) continue;

      // Apply content guards for config files
      if (!(await passesContentGuard(filePath, extension))) continue;

      // Generate file hash
      const hash = await generateFileHash(filePath);

      // Detect language
      const language = detectLanguage(filePath, extension);

      // Filter by target languages if specified
      if (parseOptions.targetLanguages.length > 0 && language) {
        if (!parseOptions.targetLanguages.includes(language)) continue;
      }

      // Enrich with git metadata
      const gitMetadata = await attachGitMetadata(filePath, projectRoot);

      const fileInfo: FileInfo = {
        path: filePath,
        relativePath,
        size: stats.size,
        lastModified: stats.mtime.getTime(),
        extension,
        isBinary,
        hash,
        language,
        metadata: {
          git: gitMetadata,
        },
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
 * Try git-first file enumeration with metadata enrichment
 */
async function tryGitFileEnumeration(projectRoot: string): Promise<string[] | null> {
  try {
    // Check if we're in a git repository
    const gitDir = path.join(projectRoot, '.git');
    if (!(await fs.pathExists(gitDir))) {
      return null;
    }

    // Use git ls-files to enumerate tracked files
    const { spawn } = await import('child_process');
    const { promisify } = await import('util');
    const exec = promisify(spawn);

    return new Promise((resolve, reject) => {
      const gitProcess = spawn('git', ['ls-files', '-z'], {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      gitProcess.stdout?.on('data', data => {
        stdout += data.toString();
      });

      gitProcess.stderr?.on('data', data => {
        stderr += data.toString();
      });

      gitProcess.on('close', code => {
        if (code !== 0) {
          reject(new Error(`git ls-files failed: ${stderr}`));
          return;
        }

        // Parse null-terminated output and convert to absolute paths
        const relativeFiles = stdout.split('\0').filter(f => f.length > 0);
        const absoluteFiles = relativeFiles.map(f => path.resolve(projectRoot, f));
        resolve(absoluteFiles);
      });

      gitProcess.on('error', error => {
        reject(error);
      });
    });
  } catch (error) {
    // Fall back to glob enumeration
    return null;
  }
}

/**
 * Fallback glob enumeration when git is not available
 */
async function fallbackGlobEnumeration(
  projectRoot: string,
  ignorePatterns: string[],
  parseOptions: ParseOptions
): Promise<string[]> {
  // Build combined glob patterns
  const includePatterns =
    parseOptions.patterns.include.length > 0 ? parseOptions.patterns.include : ['**/*'];

  const excludePatterns = [...ignorePatterns, ...parseOptions.patterns.exclude];

  // Find all files using glob
  return await glob(includePatterns, {
    cwd: projectRoot,
    ignore: excludePatterns,
    absolute: true,
    nodir: true,
    dot: false,
  });
}

/**
 * Check if path should be ignored based on noise heuristics
 */
function shouldIgnorePath(relativePath: string): boolean {
  const noisePaths = [
    '**/examples/**',
    '**/sample/**',
    '**/samples/**',
    '**/test/**',
    '**/tests/**',
    '**/__tests__/**',
    '**/vendor/**',
    '**/.history/**',
    '**/backup/**',
    '**/backups/**',
    '**/tmp/**',
    '**/temp/**',
    '**/.cache/**',
    '**/cache/**',
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/target/**',
    '**/__pycache__/**',
    '**/*.pyc',
    '.next/**',
    '.nuxt/**',
    'coverage/**',
  ];

  return noisePaths.some(pattern => {
    // Convert glob pattern to regex for matching
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '[^/]');
    return new RegExp(`^${regexPattern}$`).test(relativePath);
  });
}

/**
 * Check if file passes config allowlist based on basename and path
 */
function passesConfigAllowlist(relativePath: string, basename: string): boolean {
  // Config file patterns with high confidence
  const configPatterns = [
    // Containers/Orchestration
    /^Dockerfile/,
    /^docker-compose.*\.ya?ml$/,
    /^compose.*\.ya?ml$/,
    /kubernetes\/.*\.ya?ml$/,
    /helm\//,
    /^Chart\.yaml$/,
    /^values.*\.ya?ml$/,

    // IaC
    /\.tf$/,
    /^terragrunt\.hcl$/,
    /\.bicep$/,
    /\.cloudformation\.ya?ml$/,

    // Package managers and build
    /^package\.json$/,
    /^pnpm-workspace\.yaml$/,
    /^yarn\.lock$/,
    /^pyproject\.toml$/,
    /^requirements.*\.txt$/,
    /^Pipfile$/,
    /^setup\.cfg$/,
    /^poetry\.lock$/,
    /^go\.mod$/,
    /^go\.sum$/,
    /^Cargo\.toml$/,
    /^Cargo\.lock$/,
    /^pom\.xml$/,
    /^build\.gradle(\.kts)?$/,
    /^settings\.gradle(\.kts)?$/,
    /^Makefile$/,
    /^CMakeLists\.txt$/,
    /^Gemfile$/,
    /^mix\.exs$/,
    /^composer\.json$/,

    // Runtime/env
    /^\.env$/,
    /^\.env\./,
    /^Procfile$/,
    /^supervisord\.conf$/,
    /systemd\/.*\.service$/,

    // Deploy/CI
    /^\.github\/workflows\/.*\.ya?ml$/,
    /^\.gitlab-ci\.yml$/,
    /^azure-pipelines\.yml$/,
    /^circle\.yml$/,
    /^\.circleci\/config\.yml$/,
    /^Jenkinsfile$/,
    /^skaffold\.yaml$/,
    /^Tiltfile$/,

    // DB/schema
    /^migrations\//,
    /\.sql$/,
    /^schema\.prisma$/,
    /^prisma\/schema\.prisma$/,
    /^openapi.*\.ya?ml$/,
    /\.proto$/,

    // Reverse-proxy
    /nginx\/.*\.conf$/,
    /haproxy\/.*\.cfg$/,
    /^Caddyfile$/,
  ];

  // Check if basename matches any config pattern
  const matchesConfig = configPatterns.some(
    pattern => pattern.test(basename) || pattern.test(relativePath)
  );

  if (matchesConfig) return true;

  // Allow general source files but with lower priority
  const generalPatterns = [
    /\.(js|jsx|ts|tsx|py|java|kt|scala|cs|cpp|cc|cxx|c|h|hpp|rs|go|rb|php|swift|dart)$/,
    /\.(yaml|yml|json|xml|toml|ini|cfg|conf)$/,
    /\.(md|txt|rst)$/,
  ];

  return generalPatterns.some(pattern => pattern.test(basename));
}

/**
 * Apply content guards to validate config files contain expected tokens
 */
async function passesContentGuard(filePath: string, extension: string): Promise<boolean> {
  try {
    // Only apply guards to config-like files
    const basename = path.basename(filePath);
    const shouldGuard =
      basename.includes('docker-compose') ||
      basename.includes('compose') ||
      basename.startsWith('Dockerfile') ||
      extension === '.tf' ||
      basename.includes('kubernetes') ||
      basename === 'Chart.yaml' ||
      basename.startsWith('values') ||
      basename.includes('openapi');

    if (!shouldGuard) return true;

    // Read first 1KB for content checking
    const buffer = await fs.readFile(filePath, { flag: 'r' });
    const sample = buffer.subarray(0, Math.min(1024, buffer.length)).toString('utf-8');

    // Apply specific guards based on file type
    if (basename.includes('docker-compose') || basename.includes('compose')) {
      return /services:\s*$/m.test(sample) || /version:\s*['"]?[0-9]/m.test(sample);
    }

    if (extension === '.yaml' || extension === '.yml') {
      // K8s guard
      if (/apiVersion:\s*/.test(sample) && /kind:\s*/.test(sample)) {
        return true;
      }
      // Generic YAML structure
      return /\w+:\s*/.test(sample);
    }

    if (extension === '.tf') {
      return (
        /provider\s*"/.test(sample) || /resource\s*"/.test(sample) || /variable\s*"/.test(sample)
      );
    }

    if (basename.includes('openapi')) {
      return /openapi:\s*['"]?[0-9]/.test(sample) || /swagger:\s*['"]?[0-9]/.test(sample);
    }

    return true;
  } catch (error) {
    // If we can't read the file, let it pass - will be caught later
    return true;
  }
}

/**
 * Attach git metadata to file information
 */
async function attachGitMetadata(
  filePath: string,
  projectRoot: string
): Promise<
  | {
      lastModified?: number;
      author?: string;
      commit?: string;
    }
  | undefined
> {
  try {
    const relativePath = path.relative(projectRoot, filePath);
    const { spawn } = await import('child_process');

    return new Promise(resolve => {
      const gitProcess = spawn('git', ['log', '-1', '--format=%ct,%an,%H', '--', relativePath], {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';

      gitProcess.stdout?.on('data', data => {
        stdout += data.toString();
      });

      gitProcess.on('close', code => {
        if (code !== 0 || !stdout.trim()) {
          resolve(undefined);
          return;
        }

        const [timestampStr, author, commit] = stdout.trim().split(',');
        const lastModified = parseInt(timestampStr) * 1000; // Convert to milliseconds

        resolve({
          lastModified: isNaN(lastModified) ? undefined : lastModified,
          author: author || undefined,
          commit: commit || undefined,
        });
      });

      gitProcess.on('error', () => {
        resolve(undefined);
      });
    });
  } catch (error) {
    return undefined;
  }
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
 * Create confidence score from evidence with git and content feature weighting
 */
function calculateConfidenceFromEvidence(evidence: Evidence[]): ConfidenceScore {
  if (evidence.length === 0) {
    return {
      overall: 0,
      breakdown: {},
      factors: [],
    };
  }

  // Calculate base confidence as weighted average
  const totalConfidence = evidence.reduce((sum, e) => sum + e.confidence, 0);
  let baseConfidence = totalConfidence / evidence.length;

  // Apply git-based weighting factors
  const gitBonus = calculateGitRecencyBonus(evidence);
  const contentStrengthBonus = calculateContentStrengthBonus(evidence);
  const topologyConsistencyBonus = calculateTopologyConsistencyBonus(evidence);

  // Combine factors using a capped logistic function
  const weightedFactors = [
    baseConfidence * 1.0, // Base evidence weight
    gitBonus * 0.15, // Git recency and activity
    contentStrengthBonus * 0.25, // Content quality and completeness
    topologyConsistencyBonus * 0.1, // Cross-file consistency
  ];

  const logisticInput = weightedFactors.reduce((sum, factor) => sum + factor, 0);
  const overall = Math.max(0.3, Math.min(0.95, logisticInput));

  // Calculate breakdown by evidence type with feature bonuses
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

  // Add feature breakdown
  breakdown.git_recency = gitBonus;
  breakdown.content_strength = contentStrengthBonus;
  breakdown.topology_consistency = topologyConsistencyBonus;

  // Generate enhanced confidence factors
  const factors = evidence.map(e => ({
    description: `Evidence from ${e.source} in ${path.basename(e.filePath)}`,
    weight: e.confidence,
    source: e.source,
  }));

  // Add feature factors
  factors.push(
    {
      description: 'Git recency and activity signals',
      weight: gitBonus,
      source: 'git-analysis',
    },
    {
      description: 'Content strength and completeness',
      weight: contentStrengthBonus,
      source: 'content-analysis',
    },
    {
      description: 'Cross-file topology consistency',
      weight: topologyConsistencyBonus,
      source: 'topology-analysis',
    }
  );

  return {
    overall,
    breakdown,
    factors,
  };
}

/**
 * Calculate git recency bonus based on recent activity
 */
function calculateGitRecencyBonus(evidence: Evidence[]): number {
  let totalRecencyScore = 0;
  let gitEvidenceCount = 0;

  for (const e of evidence) {
    if (e.metadata.git?.lastModified) {
      const daysSinceModified = (Date.now() - e.metadata.git.lastModified) / (1000 * 60 * 60 * 24);

      // Recent files get higher scores (exponential decay)
      let recencyScore = 0;
      if (daysSinceModified < 7) {
        recencyScore = 1.0; // Very recent
      } else if (daysSinceModified < 30) {
        recencyScore = 0.8; // Recent
      } else if (daysSinceModified < 90) {
        recencyScore = 0.6; // Moderately recent
      } else if (daysSinceModified < 365) {
        recencyScore = 0.3; // Older
      } else {
        recencyScore = 0.1; // Very old
      }

      totalRecencyScore += recencyScore;
      gitEvidenceCount++;
    }
  }

  return gitEvidenceCount > 0 ? totalRecencyScore / gitEvidenceCount : 0.5;
}

/**
 * Calculate content strength bonus based on evidence quality and completeness
 */
function calculateContentStrengthBonus(evidence: Evidence[]): number {
  let strengthScore = 0;
  const evidenceCount = evidence.length;

  for (const e of evidence) {
    let itemScore = 0;

    // Config files with key fields present get higher scores
    if (e.type === 'config') {
      const data = e.data as any;

      if (data.configType === 'dockerfile' && data.exposedPorts?.length > 0) {
        itemScore += 0.3;
      }
      if (
        data.configType === 'package-json' &&
        data.scripts &&
        Object.keys(data.scripts).length > 0
      ) {
        itemScore += 0.3;
      }
      if (data.configType === 'compose-service' && data.ports?.length > 0) {
        itemScore += 0.3;
      }
      if (data.configType === 'k8s-resource' && data.containers?.length > 0) {
        itemScore += 0.3;
      }

      // Bonus for environment variables and dependencies
      if (data.environment || data.dependencies || data.dependencyName) {
        itemScore += 0.2;
      }
    }

    // Source code with entry points and patterns
    if (e.type === 'function' && e.data.isEntryPoint) {
      itemScore += 0.4;
    }

    // Dependencies with known frameworks
    if (e.type === 'dependency' && e.data.framework) {
      itemScore += 0.2;
    }

    strengthScore += Math.min(1.0, itemScore);
  }

  return evidenceCount > 0 ? strengthScore / evidenceCount : 0.5;
}

/**
 * Calculate topology consistency bonus for matching cross-file patterns
 */
function calculateTopologyConsistencyBonus(evidence: Evidence[]): number {
  let consistencyScore = 0;
  let consistencyChecks = 0;

  // Group evidence by file path for cross-file analysis
  const evidenceByFile = new Map<string, Evidence[]>();
  for (const e of evidence) {
    if (!evidenceByFile.has(e.filePath)) {
      evidenceByFile.set(e.filePath, []);
    }
    evidenceByFile.get(e.filePath)!.push(e);
  }

  // Check for consistency patterns
  const dockerfileEvidence = evidence.find(e => e.data.configType === 'dockerfile');
  const composeEvidence = evidence.find(e => e.data.configType === 'compose-service');
  const k8sEvidence = evidence.find(e => e.data.configType === 'k8s-resource');

  // Docker compose + Dockerfile consistency
  if (dockerfileEvidence && composeEvidence) {
    consistencyChecks++;
    const dockerPorts = (dockerfileEvidence.data as any).exposedPorts || [];
    const composePorts = (composeEvidence.data as any).ports?.map((p: any) => p.container) || [];

    if (
      Array.isArray(dockerPorts) &&
      Array.isArray(composePorts) &&
      dockerPorts.some((port: number) => composePorts.includes(port))
    ) {
      consistencyScore += 1.0; // Port alignment
    }
  }

  // Kubernetes + Container image consistency
  if (k8sEvidence && (dockerfileEvidence || composeEvidence)) {
    consistencyChecks++;
    // Basic presence check (would need deeper analysis for image name matching)
    consistencyScore += 0.5;
  }

  // Package manager + source file consistency
  const packageEvidence = evidence.find(
    e => e.data.configType === 'package-json' || e.data.configType === 'cargo-toml'
  );
  const sourceEvidence = evidence.find(e => e.data.configType === 'source-file');

  if (packageEvidence && sourceEvidence) {
    consistencyChecks++;
    // Check if source patterns align with package type
    if ((packageEvidence.data as any).dependencies && (sourceEvidence.data as any).frameworkUsage) {
      const packageFrameworks = Object.keys((packageEvidence.data as any).dependencies);
      const sourceFrameworks = (sourceEvidence.data as any).frameworkUsage || [];

      if (
        Array.isArray(packageFrameworks) &&
        Array.isArray(sourceFrameworks) &&
        packageFrameworks.some((pf: string) => sourceFrameworks.includes(pf))
      ) {
        consistencyScore += 1.0;
      }
    }
  }

  return consistencyChecks > 0 ? consistencyScore / consistencyChecks : 0.5;
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
   * Apply multi-signal gating to filter artifacts with insufficient evidence
   * Requires at least 2 orthogonal evidence sources for promotion, or 1 very high confidence source
   */
  private applyMultiSignalGating(artifacts: InferredArtifact[]): InferredArtifact[] {
    const gatedArtifacts: InferredArtifact[] = [];
    const quarantinedCandidates: InferredArtifact[] = [];

    for (const artifact of artifacts) {
      const evidenceAnalysis = this.analyzeEvidenceSignals(artifact);

      // High confidence single source (e.g., explicit declarative config)
      if (evidenceAnalysis.hasHighConfidenceDeclarative) {
        gatedArtifacts.push(artifact);
        continue;
      }

      // Multi-signal requirement for services and deployments
      if (artifact.artifact.type === 'service' || artifact.artifact.type === 'deployment') {
        if (evidenceAnalysis.orthogonalSignalCount >= 2) {
          gatedArtifacts.push(artifact);
        } else {
          quarantinedCandidates.push(artifact);
        }
        continue;
      }

      // Libraries and binaries can pass with single strong signal
      if (artifact.artifact.type === 'library' || artifact.artifact.type === 'binary') {
        if (evidenceAnalysis.strongSignalCount >= 1) {
          gatedArtifacts.push(artifact);
        } else {
          quarantinedCandidates.push(artifact);
        }
        continue;
      }

      // Default: require at least one strong signal
      if (evidenceAnalysis.strongSignalCount >= 1) {
        gatedArtifacts.push(artifact);
      } else {
        quarantinedCandidates.push(artifact);
      }
    }

    // Store quarantined candidates for inspection (could be added to statistics)
    if (quarantinedCandidates.length > 0) {
      this.debug(`Quarantined ${quarantinedCandidates.length} low-confidence candidates`);
    }

    return gatedArtifacts;
  }

  /**
   * Analyze evidence signals for multi-signal gating
   */
  private analyzeEvidenceSignals(artifact: InferredArtifact): {
    orthogonalSignalCount: number;
    strongSignalCount: number;
    hasHighConfidenceDeclarative: boolean;
    signalTypes: Set<string>;
  } {
    const signalTypes = new Set<string>();
    let strongSignalCount = 0;
    let hasHighConfidenceDeclarative = false;

    // Analyze provenance evidence for signal diversity
    for (const evidenceId of artifact.provenance.evidence) {
      // Extract signal type from evidence ID pattern
      const signalType = this.extractSignalType(evidenceId);
      signalTypes.add(signalType);

      // Check for strong signals (high confidence config evidence)
      if (
        evidenceId.includes('dockerfile') ||
        evidenceId.includes('package-json') ||
        evidenceId.includes('cargo-toml') ||
        evidenceId.includes('k8s')
      ) {
        strongSignalCount++;
      }

      // Check for declarative evidence with very high confidence
      if (
        (evidenceId.includes('dockerfile') ||
          evidenceId.includes('compose-service') ||
          evidenceId.includes('k8s-deployment')) &&
        artifact.confidence.overall >= 0.9
      ) {
        hasHighConfidenceDeclarative = true;
      }
    }

    // Additional signal analysis based on artifact metadata
    if (artifact.artifact.metadata.language && artifact.artifact.metadata.framework) {
      signalTypes.add('language-framework');
    }

    if (
      artifact.artifact.metadata.port ||
      (artifact.artifact as any).metadata?.exposedPorts?.length > 0
    ) {
      signalTypes.add('network-binding');
    }

    return {
      orthogonalSignalCount: signalTypes.size,
      strongSignalCount,
      hasHighConfidenceDeclarative,
      signalTypes,
    };
  }

  /**
   * Extract signal type from evidence ID for orthogonal signal counting
   */
  private extractSignalType(evidenceId: string): string {
    // Config files
    if (evidenceId.includes('dockerfile')) return 'dockerfile';
    if (evidenceId.includes('compose')) return 'compose';
    if (evidenceId.includes('k8s') || evidenceId.includes('kubernetes')) return 'kubernetes';
    if (evidenceId.includes('package-json')) return 'package-manifest';
    if (evidenceId.includes('cargo-toml')) return 'cargo-manifest';

    // Source code signals
    if (evidenceId.includes('source') || evidenceId.includes('main')) return 'source-code';
    if (evidenceId.includes('script')) return 'build-script';

    // Dependency signals
    if (evidenceId.includes('dep')) return 'dependency';

    // Infrastructure signals
    if (evidenceId.includes('service') || evidenceId.includes('ingress')) return 'infrastructure';

    // Default category
    return 'generic';
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
