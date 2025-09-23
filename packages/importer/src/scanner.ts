/**
 * Simplified Scanner for Config File Detection
 *
 * Discovers config files using git ls-files (if available) or glob, dispatches to
 * matching plugins via supports(), collects evidence, aggregates inferences from
 * plugins, and generates a basic manifest.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs-extra';
import { glob } from 'glob';
import {
  AnalysisConfiguration,
  AnalysisStatistics,
  ArtifactManifest,
  ArtifactType,
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

export interface ScannerConfig {
  /** Root directory to analyze */
  projectRoot: string;
  /** Optional project name override */
  projectName?: string;
  /** Parse options */
  parseOptions: ParseOptions;
  /** Inference options */
  inferenceOptions: InferenceOptions;
  /** Registered plugins */
  plugins: ImporterPlugin[];
  /** Ignore patterns */
  ignorePatterns: string[];
  /** Max concurrency */
  maxConcurrency: number;
  /** Debug mode */
  debug: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_SCANNER_CONFIG: Partial<ScannerConfig> = {
  parseOptions: {
    deepAnalysis: false,
    targetLanguages: [],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    includeBinaries: false,
    patterns: {
      include: [],
      exclude: [],
    },
  },
  inferenceOptions: {
    minConfidence: 0.3,
    inferRelationships: false,
    maxDependencyDepth: 3,
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

// Plugin Registry
export class PluginRegistry {
  private plugins = new Map<string, ImporterPlugin>();
  private enabledPlugins = new Set<string>();

  register(plugin: ImporterPlugin): void {
    const name = plugin.name();
    if (this.plugins.has(name)) {
      throw new ConfigurationError(`Plugin ${name} is already registered`);
    }
    this.plugins.set(name, plugin);
    this.enabledPlugins.add(name);
  }

  getEnabled(): ImporterPlugin[] {
    return Array.from(this.enabledPlugins)
      .map(name => this.plugins.get(name))
      .filter((plugin): plugin is ImporterPlugin => plugin !== undefined);
  }

  getSupportingPlugins(filePath: string, fileContent?: string): ImporterPlugin[] {
    return this.getEnabled().filter(plugin => {
      try {
        return plugin.supports(filePath, fileContent);
      } catch {
        return false;
      }
    });
  }
}

// File System Utilities
async function buildFileIndex(
  projectRoot: string,
  ignorePatterns: string[],
  parseOptions: ParseOptions
): Promise<FileIndex> {
  const files = new Map<string, FileInfo>();
  const directories = new Map<string, DirectoryInfo>();

  let allFiles: string[];
  try {
    allFiles = await tryGitFileEnumeration(projectRoot);
  } catch {
    allFiles = await fallbackGlobEnumeration(projectRoot, ignorePatterns, parseOptions);
  }

  for (const filePath of allFiles) {
    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) continue;

      if (stats.size > parseOptions.maxFileSize) continue;

      const relativePath = path.relative(projectRoot, filePath);
      const basename = path.basename(filePath);
      const extension = path.extname(filePath).toLowerCase();

      if (!passesConfigAllowlist(relativePath, basename)) continue;

      const isBinary = await isFileBinary(filePath, parseOptions.includeBinaries);
      if (isBinary && !parseOptions.includeBinaries) continue;

      if (!(await passesContentGuard(filePath, extension))) continue;

      const fileInfo: FileInfo = {
        path: filePath,
        relativePath,
        size: stats.size,
        lastModified: stats.mtime.getTime(),
        extension,
        isBinary,
        metadata: {},
      };

      files.set(filePath, fileInfo);

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

      const dirInfo = directories.get(dirPath)!;
      dirInfo.fileCount++;
      dirInfo.totalSize += stats.size;
      dirInfo.lastModified = Math.max(dirInfo.lastModified, stats.mtime.getTime());
    } catch {
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

async function tryGitFileEnumeration(projectRoot: string): Promise<string[]> {
  const gitDir = path.join(projectRoot, '.git');
  if (!(await fs.pathExists(gitDir))) {
    throw new Error('No git repo');
  }

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

      const relativeFiles = stdout.split('\0').filter(f => f.length > 0);
      const absoluteFiles = relativeFiles.map(f => path.resolve(projectRoot, f));
      resolve(absoluteFiles);
    });

    gitProcess.on('error', reject);
  });
}

async function fallbackGlobEnumeration(
  projectRoot: string,
  ignorePatterns: string[],
  parseOptions: ParseOptions
): Promise<string[]> {
  const configPatterns = [
    '**/Dockerfile',
    '**/docker-compose*.{yaml,yml}',
    '**/compose*.{yaml,yml}',
    '**/kubernetes/*.{yaml,yml}',
    '**/helm/**/Chart.yaml',
    '**/helm/**/values*.{yaml,yml}',
    '**/*.tf',
    '**/terragrunt.hcl',
    '**/*.bicep',
    '**/*.cloudformation.{yaml,yml}',
    '**/package.json',
    '**/pnpm-workspace.yaml',
    '**/yarn.lock',
    '**/pyproject.toml',
    '**/requirements*.txt',
    '**/Pipfile',
    '**/setup.cfg',
    '**/poetry.lock',
    '**/go.mod',
    '**/go.sum',
    '**/Cargo.toml',
    '**/Cargo.lock',
    '**/pom.xml',
    '**/build.gradle*',
    '**/settings.gradle*',
    '**/Makefile',
    '**/CMakeLists.txt',
    '**/Gemfile',
    '**/mix.exs',
    '**/composer.json',
    '**/.env',
    '**/.env.*',
    '**/Procfile',
    '**/supervisord.conf',
    '**/systemd/*.service',
    '**/github/workflows/*.yaml',
    '**/gitlab-ci.yml',
    '**/azure-pipelines.yml',
    '**/circle.yml',
    '**/circleci/config.yml',
    '**/Jenkinsfile',
    '**/skaffold.yaml',
    '**/Tiltfile',
    '**/migrations/*',
    '**/*.sql',
    '**/schema.prisma',
    '**/prisma/schema.prisma',
    '**/openapi*.{yaml,yml}',
    '**/*.proto',
    '**/nginx/*.conf',
    '**/haproxy/*.cfg',
    '**/Caddyfile',
  ];

  const excludePatterns = [...ignorePatterns, ...parseOptions.patterns.exclude];

  return await glob(configPatterns, {
    cwd: projectRoot,
    ignore: excludePatterns,
    absolute: true,
    nodir: true,
    dot: true,
  });
}

function passesConfigAllowlist(relativePath: string, basename: string): boolean {
  const configPatterns = [
    /^Dockerfile$/,
    /^docker-compose.*\.ya?ml$/,
    /^compose.*\.ya?ml$/,
    /kubernetes\/.*\.ya?ml$/,
    /helm\//,
    /^Chart\.yaml$/,
    /^values.*\.ya?ml$/,
    /\.tf$/,
    /^terragrunt\.hcl$/,
    /\.bicep$/,
    /\.cloudformation\.ya?ml$/,
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
    /^\.env$/,
    /^\.env\./,
    /^Procfile$/,
    /^supervisord\.conf$/,
    /systemd\/.*\.service$/,
    /^\.github\/workflows\/.*\.ya?ml$/,
    /^\.gitlab-ci\.yml$/,
    /^azure-pipelines\.yml$/,
    /^circle\.yml$/,
    /^\.circleci\/config\.yml$/,
    /^Jenkinsfile$/,
    /^skaffold\.yaml$/,
    /^Tiltfile$/,
    /^migrations\//,
    /\.sql$/,
    /^schema\.prisma$/,
    /^prisma\/schema\.prisma$/,
    /^openapi.*\.ya?ml$/,
    /\.proto$/,
    /nginx\/.*\.conf$/,
    /haproxy\/.*\.cfg$/,
    /^Caddyfile$/,
  ];

  return configPatterns.some(pattern => pattern.test(basename) || pattern.test(relativePath));
}

async function passesContentGuard(filePath: string, extension: string): Promise<boolean> {
  try {
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

    const buffer = await fs.readFile(filePath, { flag: 'r' });
    const sample = buffer.subarray(0, Math.min(1024, buffer.length)).toString('utf-8');

    if (basename.includes('docker-compose') || basename.includes('compose')) {
      return /services:\s*$/m.test(sample) || /version:\s*['"]?[0-9]/m.test(sample);
    }

    if (extension === '.yaml' || extension === '.yml') {
      return (/apiVersion:\s*/.test(sample) && /kind:\s*/.test(sample)) || /\w+:\s*/.test(sample);
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
  } catch {
    return true;
  }
}

async function isFileBinary(filePath: string, includeBinaries: boolean): Promise<boolean> {
  if (includeBinaries) return false;

  try {
    const buffer = await fs.readFile(filePath, { flag: 'r' });
    const sample = buffer.subarray(0, Math.min(1024, buffer.length));

    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0) return true;
    }

    return false;
  } catch {
    return true;
  }
}

// Main Scanner Class
export class ScannerRunner {
  private config: ScannerConfig;
  private pluginRegistry: PluginRegistry;
  private cache = new Map<string, unknown>();

  constructor(config: Partial<ScannerConfig> = {}) {
    this.config = { ...DEFAULT_SCANNER_CONFIG, ...config } as ScannerConfig;
    this.pluginRegistry = new PluginRegistry();

    if (config.plugins) {
      for (const plugin of config.plugins) {
        this.pluginRegistry.register(plugin);
      }
    }
  }

  async scan(): Promise<ArtifactManifest> {
    const startTime = Date.now();

    try {
      this.debug('Starting simplified scanner pipeline');

      // Stage 1: Discovery
      const fileIndex = await this.discoverFiles();

      // Stage 2: Parse
      const evidence = await this.parseFiles(fileIndex);

      // Stage 3: Infer
      const artifacts = await this.inferArtifacts(evidence, fileIndex);

      // Generate manifest
      const manifest = await this.generateManifest(artifacts, evidence, fileIndex, startTime);

      this.debug(`Pipeline completed in ${Date.now() - startTime}ms`);
      return manifest;
    } catch (error) {
      if (error instanceof ImporterError) {
        throw error;
      }
      throw new InferenceError(`Pipeline failed: ${error}`);
    }
  }

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

  private async parseFiles(fileIndex: FileIndex): Promise<Evidence[]> {
    const allEvidence: Evidence[] = [];
    const failedFiles: string[] = [];

    const parseContext: ParseContext = {
      projectRoot: this.config.projectRoot,
      fileIndex,
      options: this.config.parseOptions,
      cache: this.cache,
    };

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
      `Collected ${allEvidence.length} evidence from ${files.length - failedFiles.length}/${files.length} files`
    );

    if (failedFiles.length > 0) {
      this.debug(`Failed to parse ${failedFiles.length} files`);
    }

    return allEvidence;
  }

  private async parseFile(fileInfo: FileInfo, parseContext: ParseContext): Promise<Evidence[]> {
    if (fileInfo.isBinary && !this.config.parseOptions.includeBinaries) {
      return [];
    }

    let fileContent: string | undefined;
    if (!fileInfo.isBinary) {
      try {
        fileContent = await fs.readFile(fileInfo.path, 'utf-8');
      } catch (error) {
        throw new ParseError(fileInfo.path, `Failed to read file: ${error}`);
      }
    }

    const supportingPlugins = this.pluginRegistry.getSupportingPlugins(fileInfo.path, fileContent);

    if (supportingPlugins.length === 0) {
      return [];
    }

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

  private async inferArtifacts(
    evidence: Evidence[],
    fileIndex: FileIndex
  ): Promise<InferredArtifact[]> {
    const projectMetadata = await this.generateProjectMetadata(fileIndex);
    this.debug(`Generated project metadata for ${projectMetadata.name}`);

    const allArtifacts: InferredArtifact[] = [];
    const enabledPlugins = this.pluginRegistry.getEnabled();

    const inferenceContext: InferenceContext = {
      projectRoot: this.config.projectRoot,
      fileIndex,
      allEvidence: evidence,
      options: this.config.inferenceOptions,
      cache: this.cache,
      projectMetadata,
    };

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

  private async generateManifest(
    artifacts: InferredArtifact[],
    evidence: Evidence[],
    fileIndex: FileIndex,
    startTime: number
  ): Promise<ArtifactManifest> {
    const projectMetadata = await this.generateProjectMetadata(fileIndex);
    const statistics = this.generateStatistics(artifacts, evidence, startTime);
    const configuration = this.generateConfiguration();

    // Simple provenance
    const provenance: Record<string, string[]> = {
      aggregated: artifacts.map(a => a.artifact.id),
    };

    return {
      version: '1.0.0',
      project: projectMetadata,
      perConfig: {},
      artifacts,
      provenance,
      statistics,
      configuration,
      timestamp: Date.now(),
    };
  }

  private async generateProjectMetadata(fileIndex: FileIndex): Promise<ProjectMetadata> {
    const files = Array.from(fileIndex.files.values());
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    const projectName = this.config.projectName || path.basename(this.config.projectRoot);

    return {
      name: projectName,
      root: this.config.projectRoot,
      languages: [],
      frameworks: [],
      fileCount: files.length,
      totalSize,
    };
  }

  private generateStatistics(
    artifacts: InferredArtifact[],
    evidence: Evidence[],
    startTime: number
  ): AnalysisStatistics {
    const artifactCounts: Record<ArtifactType, number> = {} as Record<ArtifactType, number>;
    for (const artifact of artifacts) {
      const type = artifact.artifact.type;
      artifactCounts[type] = (artifactCounts[type] || 0) + 1;
    }

    const evidenceCounts: Record<EvidenceType, number> = {} as Record<EvidenceType, number>;
    for (const item of evidence) {
      const type = item.type;
      evidenceCounts[type] = (evidenceCounts[type] || 0) + 1;
    }

    return {
      artifactCounts,
      evidenceCounts,
      processingTimeMs: Date.now() - startTime,
      pluginsExecuted: this.pluginRegistry.getEnabled().map(p => p.name()),
      failedFiles: [],
    };
  }

  private generateConfiguration(): AnalysisConfiguration {
    return {
      parseOptions: this.config.parseOptions,
      inferenceOptions: this.config.inferenceOptions,
      enabledPlugins: this.pluginRegistry.getEnabled().map(p => p.name()),
      pluginConfiguration: {},
    };
  }

  registerPlugin(plugin: ImporterPlugin): void {
    this.pluginRegistry.register(plugin);
  }

  getPluginRegistry(): PluginRegistry {
    return this.pluginRegistry;
  }

  private debug(message: string): void {
    if (this.config.debug) {
      console.debug(`[Scanner] ${message}`);
    }
  }
}

export { DEFAULT_SCANNER_CONFIG };
