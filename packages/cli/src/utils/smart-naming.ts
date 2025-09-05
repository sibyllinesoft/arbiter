/**
 * Smart Naming Strategy for Generated Files
 *
 * This module provides intelligent file naming based on project context,
 * user preferences, and input files. It addresses the feedback that files
 * were being generated with generic names like "arbiter.assembly.cue"
 * instead of project-specific names.
 */

import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

// Standard file extensions and their default naming patterns
export const FILE_PATTERNS = {
  assembly: { extension: ".assembly.cue", default: "arbiter.assembly.cue" },
  surface: { extension: ".json", default: "surface.json" },
  versionPlan: { extension: ".json", default: "version_plan.json" },
  apiSurface: { extension: ".json", default: "api-surface.json" },
  docs: { extension: ".md", default: "README.md" },
  html: { extension: ".html", default: "arbiter.html" },
} as const;

export type FileType = keyof typeof FILE_PATTERNS;

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

export interface ProjectContext {
  name?: string;
  directory: string;
  packageJsonPath?: string;
  assemblyFile?: string;
  configFiles: string[];
}

/**
 * Detects project context from the current directory and its metadata
 */
export async function detectProjectContext(
  workingDir: string = process.cwd(),
): Promise<ProjectContext> {
  const context: ProjectContext = {
    directory: workingDir,
    configFiles: [],
  };

  // Check for package.json
  const packageJsonPath = path.join(workingDir, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    context.packageJsonPath = packageJsonPath;
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      context.name = packageJson.name;
    } catch (error) {
      console.warn(`Warning: Could not parse package.json: ${error}`);
    }
  }

  // Check for existing assembly files
  const assemblyFiles = await glob("*.assembly.cue", { cwd: workingDir });
  if (assemblyFiles.length > 0) {
    context.assemblyFile = path.join(workingDir, assemblyFiles[0]);

    // Try to extract project name from assembly file
    if (!context.name) {
      try {
        const assemblyContent = fs.readFileSync(context.assemblyFile, "utf-8");
        const nameMatch = assemblyContent.match(/name:\s*"([^"]+)"/);
        if (nameMatch) {
          context.name = nameMatch[1];
        }
      } catch (error) {
        console.warn(`Warning: Could not parse assembly file: ${error}`);
      }
    }
  }

  // Check for other config files that might contain project names
  const configPatterns = [
    "pyproject.toml",
    "Cargo.toml",
    "go.mod",
    "composer.json",
    ".arbiter.json",
    ".arbiter.yaml",
  ];

  for (const pattern of configPatterns) {
    const configPath = path.join(workingDir, pattern);
    if (fs.existsSync(configPath)) {
      context.configFiles.push(configPath);

      // Try to extract name if not already found
      if (!context.name) {
        try {
          const content = fs.readFileSync(configPath, "utf-8");
          context.name = extractProjectNameFromConfig(content, pattern);
        } catch (_error) {
          // Silently continue - not all config files are parseable
        }
      }
    }
  }

  // Fallback to directory name if no project name found
  if (!context.name) {
    context.name = path.basename(workingDir);
  }

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
  // If explicit output provided, use it
  if (options.output) {
    return options.output;
  }

  // If using generic names (backward compatibility), return default
  if (options.useGenericNames) {
    return FILE_PATTERNS[fileType].default;
  }

  const pattern = FILE_PATTERNS[fileType];
  let baseName = options.baseName || options.projectName || context?.name;

  // Generate base name from input file if available
  if (!baseName && options.inputFile) {
    const inputBaseName = path.basename(options.inputFile, path.extname(options.inputFile));
    baseName = inputBaseName === "requirements" ? undefined : inputBaseName;
  }

  // Fallback to directory name or generic name
  if (!baseName) {
    baseName = context?.name || path.basename(context?.directory || process.cwd());
  }

  // Sanitize base name (remove special characters, make lowercase)
  const sanitizedBaseName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  // Generate filename based on file type
  switch (fileType) {
    case "assembly":
      return `${sanitizedBaseName}.assembly.cue`;

    case "surface":
      return `${sanitizedBaseName}-surface.json`;

    case "versionPlan":
      return `${sanitizedBaseName}-version-plan.json`;

    case "apiSurface":
      return `${sanitizedBaseName}-api-surface.json`;

    case "docs":
      return `${sanitizedBaseName}-docs.md`;

    case "html":
      return `${sanitizedBaseName}.html`;

    default:
      return `${sanitizedBaseName}${pattern.extension}`;
  }
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
 * Auto-detect naming preferences from existing files
 */
export async function detectNamingPreferences(workingDir: string = process.cwd()): Promise<{
  usesProjectNames: boolean;
  existingPatterns: Array<{ type: FileType; filename: string }>;
}> {
  const patterns: Array<{ type: FileType; filename: string }> = [];
  let usesProjectNames = false;

  // Check for existing files that match our patterns
  const allFiles = await glob("*.{json,cue,html,md}", { cwd: workingDir });

  for (const file of allFiles) {
    const lowerFile = file.toLowerCase();

    if (lowerFile.includes("assembly") && lowerFile.endsWith(".cue")) {
      patterns.push({ type: "assembly", filename: file });
      if (!lowerFile.startsWith("arbiter.")) {
        usesProjectNames = true;
      }
    } else if (lowerFile.includes("surface") && lowerFile.endsWith(".json")) {
      patterns.push({ type: "surface", filename: file });
      if (lowerFile !== "surface.json") {
        usesProjectNames = true;
      }
    } else if (lowerFile.includes("version") && lowerFile.includes("plan")) {
      patterns.push({ type: "versionPlan", filename: file });
      if (lowerFile !== "version_plan.json") {
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

/**
 * Migration helper to rename existing generic files to project-specific names
 */
export async function migrateExistingFiles(
  workingDir: string = process.cwd(),
  dryRun: boolean = true,
): Promise<Array<{ from: string; to: string; migrated: boolean }>> {
  const context = await detectProjectContext(workingDir);
  const migrations: Array<{ from: string; to: string; migrated: boolean }> = [];

  for (const [fileType, pattern] of Object.entries(FILE_PATTERNS)) {
    const genericPath = path.join(workingDir, pattern.default);

    if (fs.existsSync(genericPath)) {
      const smartName = generateSmartFilename(
        fileType as FileType,
        { useGenericNames: false },
        context,
      );
      const targetPath = path.join(workingDir, smartName);

      if (genericPath !== targetPath) {
        let migrated = false;

        if (!dryRun && !fs.existsSync(targetPath)) {
          try {
            fs.renameSync(genericPath, targetPath);
            migrated = true;
          } catch (error) {
            console.warn(`Failed to migrate ${genericPath}: ${error}`);
          }
        }

        migrations.push({
          from: pattern.default,
          to: smartName,
          migrated,
        });
      }
    }
  }

  return migrations;
}
