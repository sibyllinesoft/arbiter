/**
 * @packageDocumentation
 * Implements the importer scanning pipeline that discovers files, dispatches
 * plugin analysis, and aggregates inferred artifacts.
 */

import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs-extra";
import { glob } from "glob";
import { ArtifactClassifier } from "./detection/classifier";
import { buildDirectoryContexts } from "./detection/context-aggregator";
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
} from "./types";

/**
 * Configuration used to control the scanner pipeline.
 *
 * @public
 */
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
 * Default configuration applied when callers do not specify overrides.
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
    "node_modules/**",
    ".git/**",
    "**/.DS_Store",
    "**/Thumbs.db",
    "**/*.log",
    "dist/**",
    "build/**",
    "target/**",
    "**/__pycache__/**",
    "**/*.pyc",
    ".next/**",
    ".nuxt/**",
    "coverage/**",
  ],
  maxConcurrency: 10,
  debug: false,
};

/**
 * Information about a compose service extracted from docker evidence.
 */
interface ComposeServiceInfo {
  composeFilePath: string;
  composeFileRelative: string;
  composeServiceName: string;
  serviceConfig: Record<string, unknown>;
  serviceYaml?: string;
  buildContextAbsolute?: string;
  buildContextRelative?: string;
  dockerfilePathAbsolute?: string;
  dockerfilePathRelative?: string;
  dockerfileContent?: string;
}

/**
 * Normalizes a relative path for consistent comparison.
 */
function normalizeRelativePath(value: string | undefined): string {
  if (!value) return "";
  const normalized = value.replace(/\\/g, "/");
  if (normalized === "." || normalized === "./") return "";
  return normalized.replace(/^\.\//, "").replace(/\/$/, "");
}

/**
 * Deep clones an object using JSON serialization.
 */
function deepClone<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return value;
  }
}

/**
 * Maintains the set of importer plugins available to the scanner.
 *
 * @public
 */
export class PluginRegistry {
  private plugins = new Map<string, ImporterPlugin>();
  private enabledPlugins = new Set<string>();

  /**
   * Registers a plugin so it can participate in future scans.
   *
   * @param plugin - Plugin instance to register.
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
   * Returns all plugins that are currently enabled.
   */
  getEnabled(): ImporterPlugin[] {
    return Array.from(this.enabledPlugins)
      .map((name) => this.plugins.get(name))
      .filter((plugin): plugin is ImporterPlugin => plugin !== undefined);
  }

  /**
   * Filters registered plugins to those that support the provided file.
   *
   * @param filePath - Absolute file path to check.
   * @param fileContent - Optional file content available for heuristics.
   */
  getSupportingPlugins(filePath: string, fileContent?: string): ImporterPlugin[] {
    return this.getEnabled().filter((plugin) => {
      try {
        return plugin.supports(filePath, fileContent);
      } catch {
        return false;
      }
    });
  }
}

/**
 * Parameters needed to process a single file for indexing.
 */
interface FileProcessingParams {
  filePath: string;
  projectRoot: string;
  parseOptions: ParseOptions;
  files: Map<string, FileInfo>;
  directories: Map<string, DirectoryInfo>;
}

/**
 * Attempts to enumerate files using git or falls back to glob.
 */
async function enumerateFiles(
  projectRoot: string,
  ignorePatterns: string[],
  parseOptions: ParseOptions,
): Promise<string[]> {
  try {
    return await tryGitFileEnumeration(projectRoot);
  } catch {
    return await fallbackGlobEnumeration(projectRoot, ignorePatterns, parseOptions);
  }
}

/**
 * Creates a FileInfo object from file stats and path information.
 */
function createFileInfo(
  filePath: string,
  relativePath: string,
  stats: fs.Stats,
  extension: string,
  isBinary: boolean,
): FileInfo {
  return {
    path: filePath,
    relativePath,
    size: stats.size,
    lastModified: stats.mtime.getTime(),
    extension,
    isBinary,
    metadata: {},
  };
}

/**
 * Updates directory statistics when a file is added.
 */
async function updateDirectoryStats(
  dirPath: string,
  projectRoot: string,
  fileStats: fs.Stats,
  directories: Map<string, DirectoryInfo>,
): Promise<void> {
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
  dirInfo.totalSize += fileStats.size;
  dirInfo.lastModified = Math.max(dirInfo.lastModified, fileStats.mtime.getTime());
}

/**
 * Checks if a file should be included in the index based on various criteria.
 */
async function shouldIncludeFile(
  filePath: string,
  stats: fs.Stats,
  parseOptions: ParseOptions,
  projectRoot: string,
): Promise<{ include: boolean; isBinary: boolean }> {
  if (!stats.isFile() || stats.size > parseOptions.maxFileSize) {
    return { include: false, isBinary: false };
  }

  const relativePath = path.relative(projectRoot, filePath);
  const basename = path.basename(filePath);
  const extension = path.extname(filePath).toLowerCase();

  if (!passesConfigAllowlist(relativePath, basename)) {
    return { include: false, isBinary: false };
  }

  const isBinary = await isFileBinary(filePath, parseOptions.includeBinaries);
  if (isBinary && !parseOptions.includeBinaries) {
    return { include: false, isBinary };
  }

  if (!(await passesContentGuard(filePath, extension))) {
    return { include: false, isBinary };
  }

  return { include: true, isBinary };
}

/**
 * Processes a single file and adds it to the index if valid.
 */
async function processFileForIndex(params: FileProcessingParams): Promise<void> {
  const { filePath, projectRoot, parseOptions, files, directories } = params;

  const stats = await fs.stat(filePath);
  const { include, isBinary } = await shouldIncludeFile(filePath, stats, parseOptions, projectRoot);

  if (!include) return;

  const relativePath = path.relative(projectRoot, filePath);
  const extension = path.extname(filePath).toLowerCase();

  const fileInfo = createFileInfo(filePath, relativePath, stats, extension, isBinary);
  files.set(filePath, fileInfo);

  const dirPath = path.dirname(filePath);
  await updateDirectoryStats(dirPath, projectRoot, stats, directories);
}

/**
 * Builds an index of files and directories that will participate in parsing.
 *
 * @param projectRoot - Root directory of the project under analysis.
 * @param ignorePatterns - Glob patterns to exclude from scanning.
 * @param parseOptions - Current parse options controlling file guards.
 */
async function buildFileIndex(
  projectRoot: string,
  ignorePatterns: string[],
  parseOptions: ParseOptions,
): Promise<FileIndex> {
  const files = new Map<string, FileInfo>();
  const directories = new Map<string, DirectoryInfo>();

  const allFiles = await enumerateFiles(projectRoot, ignorePatterns, parseOptions);

  for (const filePath of allFiles) {
    try {
      await processFileForIndex({ filePath, projectRoot, parseOptions, files, directories });
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

/**
 * Enumerates files by delegating to `git ls-files` when the project is a Git repository.
 */
async function tryGitFileEnumeration(projectRoot: string): Promise<string[]> {
  const gitDir = path.join(projectRoot, ".git");
  if (!(await fs.pathExists(gitDir))) {
    throw new Error("No git repo");
  }

  return new Promise((resolve, reject) => {
    const gitProcess = spawn("git", ["ls-files", "-z"], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    gitProcess.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    gitProcess.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    gitProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`git ls-files failed: ${stderr}`));
        return;
      }

      const relativeFiles = stdout.split("\0").filter((f) => f.length > 0);
      const absoluteFiles = relativeFiles.map((f) => path.resolve(projectRoot, f));
      resolve(absoluteFiles);
    });

    gitProcess.on("error", reject);
  });
}

/**
 * Glob-based fallback for projects that are not tracked by Git.
 */
async function fallbackGlobEnumeration(
  projectRoot: string,
  ignorePatterns: string[],
  parseOptions: ParseOptions,
): Promise<string[]> {
  const configPatterns = [
    "**/Dockerfile",
    "**/docker-compose*.{yaml,yml}",
    "**/compose*.{yaml,yml}",
    "**/kubernetes/*.{yaml,yml}",
    "**/helm/**/Chart.yaml",
    "**/helm/**/values*.{yaml,yml}",
    "**/*.tf",
    "**/terragrunt.hcl",
    "**/*.bicep",
    "**/*.cloudformation.{yaml,yml}",
    "**/package.json",
    "**/pnpm-workspace.yaml",
    "**/yarn.lock",
    "**/pyproject.toml",
    "**/requirements*.txt",
    "**/Pipfile",
    "**/setup.cfg",
    "**/poetry.lock",
    "**/go.mod",
    "**/go.sum",
    "**/Cargo.toml",
    "**/Cargo.lock",
    "**/pom.xml",
    "**/build.gradle*",
    "**/settings.gradle*",
    "**/Makefile",
    "**/CMakeLists.txt",
    "**/Gemfile",
    "**/mix.exs",
    "**/composer.json",
    "**/.env",
    "**/.env.*",
    "**/Procfile",
    "**/supervisord.conf",
    "**/systemd/*.service",
    "**/github/workflows/*.yaml",
    "**/gitlab-ci.yml",
    "**/azure-pipelines.yml",
    "**/circle.yml",
    "**/circleci/config.yml",
    "**/Jenkinsfile",
    "**/skaffold.yaml",
    "**/Tiltfile",
    "**/migrations/*",
    "**/*.sql",
    "**/schema.prisma",
    "**/prisma/schema.prisma",
    "**/openapi*.{yaml,yml}",
    "**/*.proto",
    "**/nginx/*.conf",
    "**/haproxy/*.cfg",
    "**/Caddyfile",
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

/**
 * Filters out files that are unlikely to contain configuration or infrastructure hints.
 */
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

  return configPatterns.some((pattern) => pattern.test(basename) || pattern.test(relativePath));
}

/**
 * Rule for content validation.
 */
interface ContentGuardRule {
  /** Check if this rule applies to the file */
  matches: (basename: string, extension: string) => boolean;
  /** Validate the file content sample, return true if valid */
  validate: (sample: string) => boolean;
}

/**
 * Content guard rules for different file types.
 */
const CONTENT_GUARD_RULES: ContentGuardRule[] = [
  {
    matches: (basename) => basename.includes("docker-compose") || basename.includes("compose"),
    validate: (sample) => /services:\s*$/m.test(sample) || /version:\s*['"]?[0-9]/m.test(sample),
  },
  {
    matches: (_, ext) => ext === ".yaml" || ext === ".yml",
    validate: (sample) =>
      (/apiVersion:\s*/.test(sample) && /kind:\s*/.test(sample)) || /\w+:\s*/.test(sample),
  },
  {
    matches: (_, ext) => ext === ".tf",
    validate: (sample) =>
      /provider\s*"/.test(sample) || /resource\s*"/.test(sample) || /variable\s*"/.test(sample),
  },
  {
    matches: (basename) => basename.includes("openapi"),
    validate: (sample) =>
      /openapi:\s*['"]?[0-9]/.test(sample) || /swagger:\s*['"]?[0-9]/.test(sample),
  },
];

/**
 * Check if a file requires content guarding based on its name/extension.
 */
function requiresContentGuard(basename: string, extension: string): boolean {
  return (
    basename.includes("docker-compose") ||
    basename.includes("compose") ||
    basename.startsWith("Dockerfile") ||
    extension === ".tf" ||
    basename.includes("kubernetes") ||
    basename === "Chart.yaml" ||
    basename.startsWith("values") ||
    basename.includes("openapi")
  );
}

/**
 * Read a sample of file content for validation.
 */
async function readFileSample(filePath: string): Promise<string | null> {
  try {
    const buffer = await fs.readFile(filePath, { flag: "r" });
    return buffer.subarray(0, Math.min(1024, buffer.length)).toString("utf-8");
  } catch {
    return null;
  }
}

/**
 * Guards against scanning files that are known to be generated or extremely large.
 */
async function passesContentGuard(filePath: string, extension: string): Promise<boolean> {
  try {
    const basename = path.basename(filePath);

    if (!requiresContentGuard(basename, extension)) {
      return true;
    }

    const sample = await readFileSample(filePath);
    if (sample === null) {
      return true;
    }

    const applicableRule = CONTENT_GUARD_RULES.find((rule) => rule.matches(basename, extension));
    if (applicableRule) {
      return applicableRule.validate(sample);
    }

    return true;
  } catch {
    return true;
  }
}

/**
 * Performs a lightweight heuristic to determine whether a file should be treated as binary.
 */
async function isFileBinary(filePath: string, includeBinaries: boolean): Promise<boolean> {
  if (includeBinaries) return false;

  try {
    const buffer = await fs.readFile(filePath, { flag: "r" });
    const sample = buffer.subarray(0, Math.min(1024, buffer.length));

    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0) return true;
    }

    return false;
  } catch {
    return true;
  }
}

/**
 * Orchestrates the multi-stage importer pipeline.
 *
 * @public
 */
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

  /**
   * Executes discovery, parsing, inference, and manifest generation.
   *
   * @returns Manifest containing all inferred artifacts.
   */
  async scan(): Promise<ArtifactManifest> {
    const startTime = Date.now();

    try {
      this.debug("Starting simplified scanner pipeline");

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

  /**
   * Discovers files to analyse by building a file index.
   */
  private async discoverFiles(): Promise<FileIndex> {
    try {
      return await buildFileIndex(
        this.config.projectRoot,
        this.config.ignorePatterns,
        this.config.parseOptions,
      );
    } catch (error) {
      throw new FileSystemError(this.config.projectRoot, `Failed to build file index: ${error}`);
    }
  }

  /**
   * Runs the parsing stage by dispatching matching plugins across files.
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

    const files = Array.from(fileIndex.files.values());
    const batchSize = this.config.maxConcurrency;

    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      const batchPromises = batch.map(async (fileInfo) => {
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
      `Collected ${allEvidence.length} evidence from ${files.length - failedFiles.length}/${files.length} files`,
    );

    if (failedFiles.length > 0) {
      this.debug(`Failed to parse ${failedFiles.length} files`);
    }

    return allEvidence;
  }

  /**
   * Reads file content if the file is not binary.
   */
  private async readFileContent(fileInfo: FileInfo): Promise<string | undefined> {
    if (fileInfo.isBinary) {
      return undefined;
    }

    try {
      return await fs.readFile(fileInfo.path, "utf-8");
    } catch (error) {
      throw new ParseError(fileInfo.path, `Failed to read file: ${error}`);
    }
  }

  /**
   * Collects evidence from a single plugin for a file.
   */
  private async collectPluginEvidence(
    plugin: ImporterPlugin,
    filePath: string,
    fileContent: string | undefined,
    parseContext: ParseContext,
  ): Promise<Evidence[]> {
    try {
      return await plugin.parse(filePath, fileContent, parseContext);
    } catch (error) {
      throw new PluginError(plugin.name(), `Failed to parse ${filePath}: ${error}`, error as Error);
    }
  }

  /**
   * Parses a single file and collects evidence from all supporting plugins.
   */
  private async parseFile(fileInfo: FileInfo, parseContext: ParseContext): Promise<Evidence[]> {
    if (fileInfo.isBinary && !this.config.parseOptions.includeBinaries) {
      return [];
    }

    const fileContent = await this.readFileContent(fileInfo);
    const supportingPlugins = this.pluginRegistry.getSupportingPlugins(fileInfo.path, fileContent);

    if (supportingPlugins.length === 0) {
      return [];
    }

    const evidence: Evidence[] = [];
    for (const plugin of supportingPlugins) {
      const pluginEvidence = await this.collectPluginEvidence(
        plugin,
        fileInfo.path,
        fileContent,
        parseContext,
      );
      evidence.push(...pluginEvidence);
    }

    return evidence;
  }

  /**
   * Executes the inference stage for all registered plugins.
   */
  private async inferArtifacts(
    evidence: Evidence[],
    fileIndex: FileIndex,
  ): Promise<InferredArtifact[]> {
    const projectMetadata = await this.generateProjectMetadata(fileIndex);
    const directoryContexts = buildDirectoryContexts(
      evidence,
      fileIndex,
      this.config.projectRoot ?? fileIndex.root,
    );
    const classifier = new ArtifactClassifier();
    this.debug(`Generated project metadata for ${projectMetadata.name}`);

    const allArtifacts: InferredArtifact[] = [];
    const enabledPlugins = this.pluginRegistry.getEnabled();

    const inferenceContext: InferenceContext = {
      projectRoot: this.config.projectRoot,
      fileIndex,
      allEvidence: evidence,
      directoryContexts,
      classifier,
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

    this.augmentArtifactsWithDockerMetadata(allArtifacts, evidence, inferenceContext.projectRoot);

    // Consolidate duplicate services (e.g., Dockerfile + package.json representing same service)
    const consolidated = this.consolidateDuplicateServices(allArtifacts);

    this.debug(
      `Inferred ${consolidated.length} artifacts from ${evidence.length} evidence items (${allArtifacts.length - consolidated.length} duplicates merged)`,
    );
    return consolidated;
  }

  /**
   * Enriches inferred artifacts with metadata extracted from Docker evidence.
   */
  private augmentArtifactsWithDockerMetadata(
    artifacts: InferredArtifact[],
    evidence: Evidence[],
    projectRoot?: string,
  ): void {
    const dockerEvidence = evidence.filter((ev) => ev.source === "docker" && ev.type === "config");
    if (dockerEvidence.length === 0) return;

    const baseProjectRoot = projectRoot ?? "";
    const { composeServices, dockerfiles } = this.extractDockerEvidenceData(
      dockerEvidence,
      baseProjectRoot,
    );

    if (composeServices.length === 0) return;

    this.attachDockerfileContents(composeServices, dockerfiles);
    this.applyDockerMetadataToArtifacts(artifacts, composeServices);
  }

  /**
   * Extracts compose service info and dockerfile contents from docker evidence.
   */
  private extractDockerEvidenceData(
    dockerEvidence: Evidence[],
    baseProjectRoot: string,
  ): { composeServices: ComposeServiceInfo[]; dockerfiles: Map<string, string> } {
    const composeServices: ComposeServiceInfo[] = [];
    const dockerfiles = new Map<string, string>();

    for (const ev of dockerEvidence) {
      const data = ev.data as Record<string, unknown> | undefined;
      if (!data || typeof data !== "object") continue;

      const dataTypeRaw = data.type;
      const dataType = typeof dataTypeRaw === "string" ? dataTypeRaw.toLowerCase() : "";

      if (dataType === "dockerfile") {
        this.collectDockerfile(data, dockerfiles);
        continue;
      }

      if (dataType === "service") {
        const serviceInfo = this.parseComposeService(data, baseProjectRoot);
        if (serviceInfo) {
          composeServices.push(serviceInfo);
        }
      }
    }

    return { composeServices, dockerfiles };
  }

  /**
   * Collects dockerfile content from evidence data.
   */
  private collectDockerfile(data: Record<string, unknown>, dockerfiles: Map<string, string>): void {
    const filePath = data.filePath;
    const content = data.dockerfileContent;
    if (typeof filePath === "string" && typeof content === "string") {
      dockerfiles.set(path.resolve(filePath), content);
    }
  }

  /**
   * Parses a compose service entry from evidence data.
   */
  private parseComposeService(
    data: Record<string, unknown>,
    baseProjectRoot: string,
  ): ComposeServiceInfo | null {
    const composeFilePath = data.filePath;
    const composeServiceConfig = data.composeServiceConfig;
    if (typeof composeFilePath !== "string") return null;
    if (!composeServiceConfig || typeof composeServiceConfig !== "object") return null;

    const composeServiceNameRaw = data.name;
    const composeServiceName =
      typeof composeServiceNameRaw === "string" ? composeServiceNameRaw : "";
    const composeServiceYaml =
      typeof data.composeServiceYaml === "string" ? data.composeServiceYaml : undefined;

    const composeDir = path.dirname(composeFilePath);
    const composeFileRelative = normalizeRelativePath(
      path.relative(baseProjectRoot, composeFilePath),
    );

    const { buildContextAbsolute, dockerfilePathAbsolute } = this.resolveBuildPaths(
      composeServiceConfig as Record<string, unknown>,
      composeDir,
    );

    const buildContextRelative = buildContextAbsolute
      ? normalizeRelativePath(path.relative(baseProjectRoot, buildContextAbsolute))
      : undefined;
    const dockerfilePathRelative = dockerfilePathAbsolute
      ? normalizeRelativePath(path.relative(baseProjectRoot, dockerfilePathAbsolute))
      : undefined;

    return {
      composeFilePath,
      composeFileRelative,
      composeServiceName,
      serviceConfig: composeServiceConfig as Record<string, unknown>,
      serviceYaml: composeServiceYaml,
      buildContextAbsolute,
      buildContextRelative,
      dockerfilePathAbsolute,
      dockerfilePathRelative,
    };
  }

  /**
   * Resolve paths from string-based build config (shorthand syntax)
   */
  private resolveStringBuildPaths(
    buildPath: string,
    composeDir: string,
  ): { buildContextAbsolute: string; dockerfilePathAbsolute: string } {
    const buildContextAbsolute = path.resolve(composeDir, buildPath);
    return {
      buildContextAbsolute,
      dockerfilePathAbsolute: path.resolve(buildContextAbsolute, "Dockerfile"),
    };
  }

  /**
   * Resolve paths from object-based build config
   */
  private resolveObjectBuildPaths(
    build: Record<string, unknown>,
    composeDir: string,
  ): { buildContextAbsolute: string; dockerfilePathAbsolute: string } {
    const contextValue = build.context;
    const dockerfileValue = build.dockerfile;

    const buildContextAbsolute =
      typeof contextValue === "string" ? path.resolve(composeDir, contextValue) : composeDir;

    const dockerfilePathAbsolute =
      typeof dockerfileValue === "string"
        ? path.resolve(buildContextAbsolute, dockerfileValue)
        : path.resolve(buildContextAbsolute, "Dockerfile");

    return { buildContextAbsolute, dockerfilePathAbsolute };
  }

  /**
   * Resolves build context and dockerfile paths from compose service config.
   */
  private resolveBuildPaths(
    serviceConfig: Record<string, unknown>,
    composeDir: string,
  ): { buildContextAbsolute?: string; dockerfilePathAbsolute?: string } {
    const buildConfig = serviceConfig.build;

    if (typeof buildConfig === "string") {
      return this.resolveStringBuildPaths(buildConfig, composeDir);
    }

    if (buildConfig && typeof buildConfig === "object") {
      return this.resolveObjectBuildPaths(buildConfig as Record<string, unknown>, composeDir);
    }

    return {};
  }

  /**
   * Attaches dockerfile contents to their corresponding compose services.
   */
  private attachDockerfileContents(
    composeServices: ComposeServiceInfo[],
    dockerfiles: Map<string, string>,
  ): void {
    for (const service of composeServices) {
      if (!service.dockerfilePathAbsolute) continue;
      const content = dockerfiles.get(path.resolve(service.dockerfilePathAbsolute));
      if (content) {
        service.dockerfileContent = content;
      }
    }
  }

  /**
   * Applies docker metadata from compose services to matching artifacts.
   */
  private applyDockerMetadataToArtifacts(
    artifacts: InferredArtifact[],
    composeServices: ComposeServiceInfo[],
  ): void {
    for (const artifact of artifacts) {
      const match = this.findBestComposeServiceMatch(artifact, composeServices);
      if (!match) continue;
      this.enrichArtifactWithDockerInfo(artifact, match);
    }
  }

  /**
   * Finds the best matching compose service for an artifact using scoring.
   */
  private findBestComposeServiceMatch(
    artifact: InferredArtifact,
    composeServices: ComposeServiceInfo[],
  ): ComposeServiceInfo | undefined {
    if (artifact.artifact.type !== "service") return undefined;

    const metadata = artifact.artifact.metadata as Record<string, unknown>;
    const artifactRootRaw = typeof metadata.root === "string" ? metadata.root : undefined;
    const artifactRoot = normalizeRelativePath(artifactRootRaw);
    const artifactName = artifact.artifact.name;
    const containerImage =
      typeof metadata.containerImage === "string" ? metadata.containerImage : undefined;

    const candidates = composeServices
      .map((service) => ({
        service,
        score: this.scoreServiceMatch(
          service,
          artifactRoot,
          artifactName,
          containerImage,
          composeServices.length,
        ),
      }))
      .filter((candidate) => candidate.score > 0)
      .sort((a, b) => b.score - a.score);

    return candidates.length > 0 ? candidates[0].service : undefined;
  }

  /**
   * Calculates match score between an artifact and a compose service.
   */
  private scoreServiceMatch(
    service: ComposeServiceInfo,
    artifactRoot: string,
    artifactName: string,
    containerImage: string | undefined,
    totalServices: number,
  ): number {
    let score = 0;

    score += this.scoreRootMatch(service.buildContextRelative, artifactRoot);
    score += this.scoreNameMatch(service.composeServiceName, artifactName);
    score += this.scoreImageMatch(service.serviceConfig, containerImage);

    // Default score for single service when no other matches
    if (!score && totalServices === 1) {
      score = 10;
    }

    return score;
  }

  /**
   * Score based on root directory matching
   */
  private scoreRootMatch(buildContextRelative: string | undefined, artifactRoot: string): number {
    // Both empty means root level match
    if (!artifactRoot && !buildContextRelative) {
      return 80;
    }

    // Both need values to compare
    if (!artifactRoot || !buildContextRelative) {
      return 0;
    }

    // Exact match
    if (buildContextRelative === artifactRoot) {
      return 100;
    }

    // Service is nested within artifact
    if (buildContextRelative.startsWith(`${artifactRoot}/`)) {
      return 60;
    }

    // Artifact is nested within service
    if (artifactRoot.startsWith(`${buildContextRelative}/`)) {
      return 40;
    }

    return 0;
  }

  /**
   * Score based on service name matching
   */
  private scoreNameMatch(serviceName: string, artifactName: string): number {
    if (artifactName && serviceName === artifactName) {
      return 50;
    }
    return 0;
  }

  /**
   * Score based on container image matching
   */
  private scoreImageMatch(
    serviceConfig: Record<string, unknown>,
    containerImage: string | undefined,
  ): number {
    const serviceImage = (serviceConfig as { image?: unknown }).image;
    if (containerImage && typeof serviceImage === "string" && serviceImage === containerImage) {
      return 40;
    }
    return 0;
  }

  /**
   * Ensure docker metadata object exists on artifact
   */
  private ensureDockerMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
    if (metadata.docker && typeof metadata.docker === "object") {
      return metadata.docker as Record<string, unknown>;
    }
    const dockerMetadata: Record<string, unknown> = {};
    metadata.docker = dockerMetadata;
    return dockerMetadata;
  }

  /**
   * Apply compose service metadata to docker metadata object
   */
  private applyComposeMetadata(
    dockerMetadata: Record<string, unknown>,
    match: ComposeServiceInfo,
  ): void {
    dockerMetadata.composeFile = match.composeFileRelative || match.composeFilePath;
    dockerMetadata.composeServiceName = match.composeServiceName;
    dockerMetadata.composeService = deepClone(match.serviceConfig);

    if (match.serviceYaml) {
      dockerMetadata.composeServiceYaml = match.serviceYaml;
    }
    if (match.buildContextRelative !== undefined) {
      dockerMetadata.buildContext = match.buildContextRelative;
    }
    if (match.dockerfilePathRelative) {
      dockerMetadata.dockerfilePath = match.dockerfilePathRelative;
    }
  }

  /**
   * Apply dockerfile content if available
   */
  private applyDockerfileContent(
    metadata: Record<string, unknown>,
    dockerMetadata: Record<string, unknown>,
    match: ComposeServiceInfo,
  ): void {
    if (match.dockerfileContent) {
      dockerMetadata.dockerfile = match.dockerfileContent;
      metadata.dockerfileContent = match.dockerfileContent;
    }
  }

  /**
   * Fill in missing top-level metadata from match
   */
  private fillMissingTopLevelMetadata(
    metadata: Record<string, unknown>,
    match: ComposeServiceInfo,
  ): void {
    if (!metadata.containerImage) {
      const candidateImage = (match.serviceConfig as { image?: unknown }).image;
      if (typeof candidateImage === "string") {
        metadata.containerImage = candidateImage;
      }
    }
    if (!metadata.buildContext && match.buildContextRelative !== undefined) {
      metadata.buildContext = match.buildContextRelative;
    }
    if (!metadata.dockerfilePath && match.dockerfilePathRelative) {
      metadata.dockerfilePath = match.dockerfilePathRelative;
    }
  }

  /**
   * Enriches an artifact with docker metadata from a matched compose service.
   */
  private enrichArtifactWithDockerInfo(
    artifact: InferredArtifact,
    match: ComposeServiceInfo,
  ): void {
    const metadata = artifact.artifact.metadata as Record<string, unknown>;
    const dockerMetadata = this.ensureDockerMetadata(metadata);

    this.applyComposeMetadata(dockerMetadata, match);
    this.applyDockerfileContent(metadata, dockerMetadata, match);
    this.fillMissingTopLevelMetadata(metadata, match);
  }

  /**
   * Consolidates duplicate services that represent the same application.
   * This happens when both a Dockerfile and a package file (package.json, go.mod, etc.)
   * exist in the same directory and create separate service artifacts.
   */
  /**
   * Check if an artifact is a Docker-based service.
   */
  private isDockerService(artifact: InferredArtifact): boolean {
    const evidence = artifact.provenance?.evidence || [];
    return evidence.some((e) => e.toLowerCase().includes("dockerfile"));
  }

  /**
   * Check if an artifact is a package-based service (nodejs, python, go, rust).
   */
  private isPackageService(artifact: InferredArtifact): boolean {
    const plugins = artifact.provenance?.plugins || [];
    const packagePlugins = ["nodejs", "python", "go", "rust"];
    return packagePlugins.some((p) => plugins.includes(p));
  }

  /**
   * Group services by their root directory.
   */
  private groupServicesByRoot(services: InferredArtifact[]): Map<string, InferredArtifact[]> {
    const servicesByRoot = new Map<string, InferredArtifact[]>();

    for (const artifact of services) {
      const metadata = artifact.artifact.metadata as Record<string, unknown>;
      const root = this.normalizeServiceRoot(metadata.root);

      if (!servicesByRoot.has(root)) {
        servicesByRoot.set(root, []);
      }
      servicesByRoot.get(root)!.push(artifact);
    }

    return servicesByRoot;
  }

  /**
   * Consolidate services in a single root directory.
   */
  private consolidateServicesInRoot(
    root: string,
    services: InferredArtifact[],
  ): InferredArtifact[] {
    if (services.length === 1) {
      return services;
    }

    const dockerService = services.find((s) => this.isDockerService(s));
    const packageService = services.find((s) => this.isPackageService(s));

    if (dockerService && packageService) {
      const merged = this.mergeServices(packageService, dockerService);
      this.debug(
        `Consolidated services at root "${root}": ${packageService.artifact.name} + docker metadata`,
      );
      return [merged];
    }

    return services;
  }

  private consolidateDuplicateServices(artifacts: InferredArtifact[]): InferredArtifact[] {
    const serviceArtifacts = artifacts.filter((a) => a.artifact.type === "service");
    const nonServiceArtifacts = artifacts.filter((a) => a.artifact.type !== "service");

    if (serviceArtifacts.length <= 1) {
      return artifacts;
    }

    const servicesByRoot = this.groupServicesByRoot(serviceArtifacts);
    const consolidated: InferredArtifact[] = [];

    for (const [root, services] of servicesByRoot.entries()) {
      consolidated.push(...this.consolidateServicesInRoot(root, services));
    }

    return [...consolidated, ...nonServiceArtifacts];
  }

  /**
   * Merges two service artifacts, combining their metadata and provenance.
   */
  private mergeServices(primary: InferredArtifact, secondary: InferredArtifact): InferredArtifact {
    const mergedMetadata = this.mergeServiceMetadata(
      primary.artifact.metadata as Record<string, unknown>,
      secondary.artifact.metadata as Record<string, unknown>,
    );
    const mergedTags = this.mergeServiceTags(primary.artifact.tags, secondary.artifact.tags);
    const mergedProvenance = this.mergeServiceProvenance(primary.provenance, secondary.provenance);

    return {
      artifact: {
        ...primary.artifact,
        tags: mergedTags,
        metadata: mergedMetadata,
      },
      provenance: mergedProvenance,
      relationships: [...(primary.relationships || []), ...(secondary.relationships || [])],
    };
  }

  /**
   * Merges metadata from two service artifacts.
   */
  private mergeServiceMetadata(
    primaryMeta: Record<string, unknown>,
    secondaryMeta: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...primaryMeta };

    this.copyMissingStringField(merged, secondaryMeta, "dockerfileContent");
    this.copyMissingStringField(merged, secondaryMeta, "dockerfile");
    this.copyMissingStringField(merged, secondaryMeta, "buildContext");
    this.copyMissingStringField(merged, secondaryMeta, "dockerfilePath");
    this.mergeDockerMetadata(merged, secondaryMeta);

    return merged;
  }

  /**
   * Copy a field from secondary to merged if not already present.
   */
  private copyMissingStringField(
    merged: Record<string, unknown>,
    secondary: Record<string, unknown>,
    field: string,
  ): void {
    if (secondary[field] && !merged[field]) {
      merged[field] = secondary[field];
    }
  }

  /**
   * Merge the docker metadata object from secondary into merged.
   */
  private mergeDockerMetadata(
    merged: Record<string, unknown>,
    secondary: Record<string, unknown>,
  ): void {
    if (!secondary.docker || typeof secondary.docker !== "object") {
      return;
    }

    if (!merged.docker || typeof merged.docker !== "object") {
      merged.docker = {};
    }

    Object.assign(merged.docker as Record<string, unknown>, secondary.docker);
  }

  /**
   * Merges tags from two service artifacts.
   */
  private mergeServiceTags(
    primaryTags: string[] | undefined,
    secondaryTags: string[] | undefined,
  ): string[] {
    const tagSet = new Set(primaryTags || []);
    for (const tag of secondaryTags || []) {
      tagSet.add(tag);
    }
    return Array.from(tagSet);
  }

  /**
   * Merges provenance from two service artifacts.
   */
  private mergeServiceProvenance(
    primary: InferredArtifact["provenance"],
    secondary: InferredArtifact["provenance"],
  ): InferredArtifact["provenance"] {
    return {
      evidence: [...(primary?.evidence || []), ...(secondary?.evidence || [])],
      plugins: Array.from(new Set([...(primary?.plugins || []), ...(secondary?.plugins || [])])),
      rules: Array.from(
        new Set([...(primary?.rules || []), ...(secondary?.rules || []), "service-consolidation"]),
      ),
      timestamp: Date.now(),
      pipelineVersion: primary?.pipelineVersion || "1.0.0",
    };
  }

  /**
   * Normalizes a service root path for comparison.
   */
  private normalizeServiceRoot(root: unknown): string {
    if (typeof root !== "string") {
      return "";
    }
    const normalized = root.replace(/\\/g, "/");
    if (normalized === "." || normalized === "./") {
      return "";
    }
    return normalized.replace(/^\.\//, "").replace(/\/$/, "");
  }

  /**
   * Combines artifacts, evidence, and statistics into a manifest structure.
   */
  private async generateManifest(
    artifacts: InferredArtifact[],
    evidence: Evidence[],
    fileIndex: FileIndex,
    startTime: number,
  ): Promise<ArtifactManifest> {
    const projectMetadata = await this.generateProjectMetadata(fileIndex);
    const statistics = this.generateStatistics(artifacts, evidence, startTime);
    const configuration = this.generateConfiguration();
    const perConfig = this.groupArtifactsByConfig(artifacts);
    const provenance = this.buildProvenanceMap(artifacts);

    return {
      version: "1.0.0",
      project: projectMetadata,
      perConfig,
      artifacts,
      provenance,
      statistics,
      configuration,
      timestamp: Date.now(),
    };
  }

  /**
   * Derives high-level metadata about the analysed project.
   */
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

  /**
   * Computes aggregate statistics for the scan run.
   */
  private generateStatistics(
    artifacts: InferredArtifact[],
    evidence: Evidence[],
    startTime: number,
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
      pluginsExecuted: this.pluginRegistry.getEnabled().map((p) => p.name()),
      failedFiles: [],
    };
  }

  /**
   * Captures configuration details that influenced the scan.
   */
  private generateConfiguration(): AnalysisConfiguration {
    return {
      parseOptions: this.config.parseOptions,
      inferenceOptions: this.config.inferenceOptions,
      enabledPlugins: this.pluginRegistry.getEnabled().map((p) => p.name()),
      pluginConfiguration: {},
    };
  }

  /**
   * Groups artifacts by the configuration evidence that identified them.
   */
  private groupArtifactsByConfig(
    artifacts: InferredArtifact[],
  ): Record<string, InferredArtifact[]> {
    const grouped: Record<string, InferredArtifact[]> = {};

    for (const artifact of artifacts) {
      const evidenceKey = this.getPrimaryEvidenceKey(artifact.provenance?.evidence ?? []);
      if (!evidenceKey) continue;
      if (!grouped[evidenceKey]) {
        grouped[evidenceKey] = [];
      }
      grouped[evidenceKey].push(artifact);
    }

    return grouped;
  }

  /**
   * Produces a lookup of artifact IDs to their supporting evidence IDs.
   */
  private buildProvenanceMap(artifacts: InferredArtifact[]): Record<string, string[]> {
    const provenance = new Map<string, Set<string>>();

    for (const artifact of artifacts) {
      const artifactId = artifact.artifact.id;
      const evidenceIds = artifact.provenance?.evidence ?? [];

      for (const rawId of evidenceIds) {
        const evidenceKey = this.normalizeEvidenceId(rawId);
        if (!evidenceKey) continue;

        if (!provenance.has(evidenceKey)) {
          provenance.set(evidenceKey, new Set());
        }
        provenance.get(evidenceKey)!.add(artifactId);
      }
    }

    const entries: [string, string[]][] = Array.from(provenance.entries()).map(([key, value]) => [
      key,
      Array.from(value),
    ]);

    return Object.fromEntries(entries);
  }

  private getPrimaryEvidenceKey(evidence: string[]): string | null {
    if (!evidence.length) return null;
    for (const id of evidence) {
      const normalized = this.normalizeEvidenceId(id);
      if (normalized) {
        return normalized;
      }
    }
    return null;
  }

  private normalizeEvidenceId(id: string | undefined): string | null {
    if (!id) return null;
    const trimmed = id.trim();
    if (!trimmed) return null;

    // Remove leading ./ or / for consistency
    const withoutLeading = trimmed.replace(/^\.?\/+/, "");
    return withoutLeading || null;
  }

  registerPlugin(plugin: ImporterPlugin): void {
    this.pluginRegistry.register(plugin);
  }

  getPluginRegistry(): PluginRegistry {
    return this.pluginRegistry;
  }

  /**
   * Emits debug logging when the scanner is running in debug mode.
   */
  private debug(message: string): void {
    if (this.config.debug) {
      console.debug(`[Scanner] ${message}`);
    }
  }
}

export { DEFAULT_SCANNER_CONFIG };
