/**
 * @packageDocumentation
 * Smart Naming Strategy for Generated Files.
 *
 * This module provides intelligent file naming based on project context,
 * user preferences, and input files. It addresses the feedback that files
 * were being generated with generic names like "arbiter.assembly.cue"
 * instead of project-specific names.
 */

import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

/** Standard file extensions and their default naming patterns. */
export const FILE_PATTERNS = {
  assembly: { extension: ".assembly.cue", default: "arbiter.assembly.cue" },
  surface: { extension: ".json", default: "surface.json" },
  versionPlan: { extension: ".json", default: "version_plan.json" },
  apiSurface: { extension: ".json", default: "api-surface.json" },
  docs: { extension: ".md", default: "README.md" },
  html: { extension: ".html", default: "arbiter.html" },
} as const;

/** Supported file type identifiers. */
export type FileType = keyof typeof FILE_PATTERNS;

/** Options for customizing file naming behavior. */
export interface NamingOptions {
  /** Explicit output filename override */
  output?: string;
  /** Output directory for generated files */
  outputDir?: string;
  /** Base name to use for generating filenames */
  baseName?: string;
  /** Project name detected or specified */
  projectName?: string;
  /** Input file that triggered the generation */
  inputFile?: string;
  /** Whether to maintain backward compatibility with generic names */
  useGenericNames?: boolean;
}

/** Detected project context information. */
export interface ProjectContext {
  name?: string;
  directory: string;
  packageJsonPath?: string;
  assemblyFile?: string;
  configFiles: string[];
}

/** File patterns to check for project name extraction. */
const CONFIG_PATTERNS = [
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "composer.json",
  ".arbiter/config.json",
];

/**
 * Try to parse project name from package.json.
 * @param filePath - Path to package.json file
 * @returns Project name or undefined if not found
 */
function tryParsePackageJson(filePath: string): string | undefined {
  try {
    const packageJson = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return packageJson.name;
  } catch {
    return undefined;
  }
}

/**
 * Try to extract project name from an assembly CUE file.
 * @param filePath - Path to assembly.cue file
 * @returns Project name or undefined if not found
 */
function tryExtractAssemblyName(filePath: string): string | undefined {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const nameMatch = content.match(/name:\s*"([^"]+)"/);
    return nameMatch?.[1];
  } catch {
    return undefined;
  }
}

/**
 * Try to extract project name from a config file.
 * @param filePath - Path to the config file
 * @param filename - Name of the config file for format detection
 * @returns Project name or undefined if not found
 */
function tryExtractConfigName(filePath: string, filename: string): string | undefined {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return extractProjectNameFromConfig(content, filename);
  } catch {
    return undefined;
  }
}

/**
 * Detect project info from package.json.
 * @param workingDir - Working directory to check
 * @param context - Project context to update
 */
async function detectFromPackageJson(workingDir: string, context: ProjectContext): Promise<void> {
  const packageJsonPath = path.join(workingDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) return;
  context.packageJsonPath = packageJsonPath;
  context.name = tryParsePackageJson(packageJsonPath);
}

/**
 * Detect project info from assembly CUE files.
 * @param workingDir - Working directory to check
 * @param context - Project context to update
 */
async function detectFromAssemblyFile(workingDir: string, context: ProjectContext): Promise<void> {
  const assemblyFiles = await glob("*.assembly.cue", { cwd: workingDir });
  if (assemblyFiles.length === 0) return;
  context.assemblyFile = path.join(workingDir, assemblyFiles[0]);
  if (!context.name) {
    context.name = tryExtractAssemblyName(context.assemblyFile);
  }
}

/**
 * Detect project info from various config files.
 * @param workingDir - Working directory to check
 * @param context - Project context to update
 */
function detectFromConfigFiles(workingDir: string, context: ProjectContext): void {
  for (const pattern of CONFIG_PATTERNS) {
    const configPath = path.join(workingDir, pattern);
    if (!fs.existsSync(configPath)) continue;
    context.configFiles.push(configPath);
    if (!context.name) {
      context.name = tryExtractConfigName(configPath, pattern);
    }
  }
}

/**
 * Detects project context from the current directory and its metadata
 */
export async function detectProjectContext(
  workingDir: string = process.cwd(),
): Promise<ProjectContext> {
  const context: ProjectContext = { directory: workingDir, configFiles: [] };

  await detectFromPackageJson(workingDir, context);
  await detectFromAssemblyFile(workingDir, context);
  detectFromConfigFiles(workingDir, context);

  context.name = context.name || path.basename(workingDir);
  return context;
}

/**
 * Extract project name from various config file formats
 */
function extractProjectNameFromConfig(content: string, filename: string): string | undefined {
  switch (path.extname(filename)) {
    case ".toml": {
      // Cargo.toml or pyproject.toml
      const tomlNameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
      return tomlNameMatch?.[1];
    }

    case ".mod": {
      // go.mod
      const goModMatch = content.match(/module\s+([^\s]+)/);
      return goModMatch?.[1]?.split("/").pop(); // Get last part of module path
    }

    case ".json":
    case ".yaml":
    case ".yml":
      try {
        const parsed = JSON.parse(content);
        return parsed.name;
      } catch {
        // Try YAML parsing if JSON fails (simplified)
        const yamlNameMatch = content.match(/name:\s*["']?([^"'\n]+)["']?/);
        return yamlNameMatch?.[1];
      }

    default:
      return undefined;
  }
}

/**
 * Generate a smart filename based on project context and options
 */
export function generateSmartFilename(
  fileType: FileType,
  options: NamingOptions = {},
  context?: ProjectContext,
): string {
  // Handle explicit output or generic names early
  if (options.output) {
    return options.output;
  }

  if (options.useGenericNames) {
    return FILE_PATTERNS[fileType].default;
  }

  // Resolve and sanitize the base name
  const baseName = resolveBaseName(options, context);
  const sanitizedBaseName = sanitizeBaseName(baseName);

  // Generate filename based on file type
  return generateFilenameForType(fileType, sanitizedBaseName);
}

/**
 * Resolve base name from various sources
 */
function resolveBaseName(options: NamingOptions, context?: ProjectContext): string {
  // Try explicit options first
  let baseName = options.baseName || options.projectName || context?.name;

  // Generate from input file if available
  if (!baseName && options.inputFile) {
    baseName = deriveBaseNameFromFile(options.inputFile);
  }

  // Fallback to context or current directory
  if (!baseName) {
    baseName = context?.name || path.basename(context?.directory || process.cwd());
  }

  return baseName;
}

/**
 * Derive base name from input file
 */
function deriveBaseNameFromFile(inputFile: string): string | undefined {
  const inputBaseName = path.basename(inputFile, path.extname(inputFile));
  return inputBaseName === "requirements" ? undefined : inputBaseName;
}

/**
 * Sanitize base name for filename use
 */
function sanitizeBaseName(baseName: string): string {
  return baseName
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Generate filename for specific file type
 */
function generateFilenameForType(fileType: FileType, sanitizedBaseName: string): string {
  const fileTypeTemplates: Record<FileType, string> = {
    assembly: `${sanitizedBaseName}.assembly.cue`,
    surface: `${sanitizedBaseName}-surface.json`,
    versionPlan: `${sanitizedBaseName}-version-plan.json`,
    apiSurface: `${sanitizedBaseName}-api-surface.json`,
    docs: `${sanitizedBaseName}-docs.md`,
    html: `${sanitizedBaseName}.html`,
  };

  if (fileType in fileTypeTemplates) {
    return fileTypeTemplates[fileType];
  }

  // Fallback to pattern extension
  const pattern = FILE_PATTERNS[fileType];
  return `${sanitizedBaseName}${pattern.extension}`;
}

/**
 * Generate full output path including directory
 */
export function generateOutputPath(
  fileType: FileType,
  options: NamingOptions = {},
  context?: ProjectContext,
): string {
  const filename = generateSmartFilename(fileType, options, context);
  const outputDir = options.outputDir || context?.directory || process.cwd();
  return path.resolve(outputDir, filename);
}

/**
 * File pattern detection rule
 */
interface PatternDetectionRule {
  type: FileType;
  match: (lowerFile: string) => boolean;
  isGeneric: (lowerFile: string) => boolean;
}

/**
 * Detection rules for naming preferences
 */
const NAMING_DETECTION_RULES: PatternDetectionRule[] = [
  {
    type: "assembly",
    match: (f) => f.includes("assembly") && f.endsWith(".cue"),
    isGeneric: (f) => f.startsWith("arbiter."),
  },
  {
    type: "surface",
    match: (f) => f.includes("surface") && f.endsWith(".json"),
    isGeneric: (f) => f === "surface.json",
  },
  {
    type: "versionPlan",
    match: (f) => f.includes("version") && f.includes("plan"),
    isGeneric: (f) => f === "version_plan.json",
  },
];

/**
 * Detect pattern for a single file
 */
function detectFilePattern(
  file: string,
): { type: FileType; filename: string; usesProjectName: boolean } | null {
  const lowerFile = file.toLowerCase();

  for (const rule of NAMING_DETECTION_RULES) {
    if (rule.match(lowerFile)) {
      return {
        type: rule.type,
        filename: file,
        usesProjectName: !rule.isGeneric(lowerFile),
      };
    }
  }

  return null;
}

/**
 * Auto-detect naming preferences from existing files
 */
export async function detectNamingPreferences(workingDir: string = process.cwd()): Promise<{
  usesProjectNames: boolean;
  existingPatterns: Array<{ type: FileType; filename: string }>;
}> {
  const allFiles = await glob("*.{json,cue,html,md}", { cwd: workingDir });
  const patterns: Array<{ type: FileType; filename: string }> = [];
  let usesProjectNames = false;

  for (const file of allFiles) {
    const detection = detectFilePattern(file);
    if (detection) {
      patterns.push({ type: detection.type, filename: detection.filename });
      if (detection.usesProjectName) {
        usesProjectNames = true;
      }
    }
  }

  return { usesProjectNames, existingPatterns: patterns };
}

/**
 * Smart naming resolver that combines all strategies
 */
export async function resolveSmartNaming(
  fileType: FileType,
  options: NamingOptions = {},
): Promise<{
  filename: string;
  fullPath: string;
  context: ProjectContext;
  isGeneric: boolean;
}> {
  // Detect project context
  const context = await detectProjectContext(options.outputDir);

  // Check existing naming preferences if not explicitly specified
  if (options.useGenericNames === undefined) {
    const preferences = await detectNamingPreferences(context.directory);
    options.useGenericNames = !preferences.usesProjectNames;
  }

  // Generate the filename
  const filename = generateSmartFilename(fileType, options, context);
  const fullPath = generateOutputPath(fileType, options, context);
  const isGeneric = filename === FILE_PATTERNS[fileType].default;

  return {
    filename,
    fullPath,
    context,
    isGeneric,
  };
}

/**
 * Batch naming for multiple file types
 */
export async function resolveBatchNaming(
  fileTypes: FileType[],
  options: NamingOptions = {},
): Promise<Record<FileType, { filename: string; fullPath: string }>> {
  const context = await detectProjectContext(options.outputDir);
  const result = {} as Record<FileType, { filename: string; fullPath: string }>;

  for (const fileType of fileTypes) {
    const filename = generateSmartFilename(fileType, options, context);
    const fullPath = generateOutputPath(fileType, options, context);
    result[fileType] = { filename, fullPath };
  }

  return result;
}

/**
 * Validate filename conflicts and suggest alternatives
 */
export async function validateNaming(
  fileType: FileType,
  options: NamingOptions = {},
): Promise<{
  isValid: boolean;
  conflicts: string[];
  suggestions: string[];
}> {
  const { filename, fullPath, context } = await resolveSmartNaming(fileType, options);
  const conflicts: string[] = [];
  const suggestions: string[] = [];

  // Check if file already exists
  if (fs.existsSync(fullPath)) {
    conflicts.push(`File already exists: ${filename}`);

    // Generate alternative names
    const baseName = path.basename(filename, path.extname(filename));
    const extension = path.extname(filename);

    for (let i = 1; i <= 3; i++) {
      const alternative = `${baseName}-${i}${extension}`;
      const alternativePath = path.join(context.directory, alternative);
      if (!fs.existsSync(alternativePath)) {
        suggestions.push(alternative);
        break;
      }
    }

    // Suggest timestamped version
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    suggestions.push(`${baseName}-${timestamp}${extension}`);
  }

  return {
    isValid: conflicts.length === 0,
    conflicts,
    suggestions,
  };
}
