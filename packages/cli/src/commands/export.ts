import path from "node:path";
import chalk from "chalk";
import fs from "fs-extra";
import { ApiClient } from "../api-client.js";
import type { CLIConfig, ExportFormat, ExportOptions } from "../types.js";
import { withProgress } from "../utils/progress.js";

/**
 * Export command implementation
 * Export CUE configurations to various formats
 */
export async function exportCommand(
  inputFiles: string[],
  options: ExportOptions,
  config: CLIConfig,
): Promise<number> {
  try {
    if (inputFiles.length === 0) {
      console.error(chalk.red("No input files specified"));
      return 1;
    }

    // Resolve input files
    const resolvedFiles = await resolveInputFiles(inputFiles, config.projectDir);

    if (resolvedFiles.length === 0) {
      console.error(chalk.red("No valid input files found"));
      return 1;
    }

    // Combine all input files
    const combinedContent = await combineInputFiles(resolvedFiles);

    // Load schema and config if specified
    let fullContent = combinedContent;

    if (options.schema) {
      try {
        const schemaContent = await fs.readFile(options.schema, "utf-8");
        fullContent = `${schemaContent}\n\n${fullContent}`;
      } catch (_error) {
        console.error(chalk.red(`Cannot read schema file: ${options.schema}`));
        return 1;
      }
    }

    if (options.config) {
      try {
        const configContent = await fs.readFile(options.config, "utf-8");
        fullContent = `${fullContent}\n\n${configContent}`;
      } catch (_error) {
        console.error(chalk.red(`Cannot read config file: ${options.config}`));
        return 1;
      }
    }

    // Export to requested formats
    for (const format of options.format) {
      await exportToFormat(fullContent, format, options, config);
    }

    return 0;
  } catch (error) {
    console.error(
      chalk.red("Export command failed:"),
      error instanceof Error ? error.message : String(error),
    );
    return 2;
  }
}

/**
 * Resolve and validate input file paths
 */
async function resolveInputFiles(files: string[], cwd: string): Promise<string[]> {
  const resolved: string[] = [];

  for (const file of files) {
    const fullPath = path.resolve(cwd, file);

    try {
      const stats = await fs.stat(fullPath);
      if (stats.isFile()) {
        if (path.extname(fullPath) === ".cue") {
          resolved.push(fullPath);
        }
      } else if (stats.isDirectory()) {
        // Find all .cue files in directory recursively
        const dirFiles = await findCueFilesRecursive(fullPath);
        resolved.push(...dirFiles);
      }
    } catch (_error) {
      console.warn(chalk.yellow(`Warning: Cannot access ${file}`));
    }
  }

  return resolved;
}

/**
 * Find CUE files recursively in a directory
 */
async function findCueFilesRecursive(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory() && !shouldSkipDirectory(entry.name)) {
      const subFiles = await findCueFilesRecursive(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile() && entry.name.endsWith(".cue")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check if directory should be skipped
 */
function shouldSkipDirectory(name: string): boolean {
  const skipDirs = ["node_modules", ".git", "dist", "build", ".vscode", ".idea"];
  return skipDirs.includes(name) || name.startsWith(".");
}

/**
 * Combine multiple input files into one
 */
async function combineInputFiles(files: string[]): Promise<string> {
  const contents: string[] = [];

  for (const file of files) {
    try {
      const content = await fs.readFile(file, "utf-8");
      contents.push(`// File: ${path.basename(file)}\n${content}`);
    } catch (_error) {
      console.warn(chalk.yellow(`Warning: Cannot read ${file}`));
    }
  }

  return contents.join("\n\n");
}

/**
 * Export content to a specific format using the new export API
 */
async function exportToFormat(
  content: string,
  format: ExportFormat,
  options: ExportOptions,
  config: CLIConfig,
): Promise<void> {
  const apiClient = new ApiClient(config);

  return withProgress({ text: `Exporting to ${format} format...`, color: "green" }, async () => {
    const exportResult = await apiClient.export(content, format, {
      strict: options.strict,
      includeExamples: true,
      outputMode: "single",
    });

    if (!exportResult.success || !exportResult.data) {
      throw new Error(`Export failed: ${exportResult.error}`);
    }

    const result = exportResult.data;

    // Handle export errors
    if (!result.success) {
      if (result.warnings && result.warnings.length > 0) {
        result.warnings.forEach((warning) => {
          console.warn(chalk.yellow(`Warning: ${warning}`));
        });
      }
      throw new Error(result.error || "Export failed");
    }

    // Handle warnings
    if (result.warnings && result.warnings.length > 0) {
      result.warnings.forEach((warning) => {
        console.warn(chalk.yellow(`Warning: ${warning}`));
      });
    }

    // Process export files
    if (result.files && result.files.length > 0) {
      for (const file of result.files) {
        await outputFile(file, options, format);
      }

      // Show export metadata
      if (result.metadata && options.verbose) {
        console.log(chalk.gray(`\nExport metadata:`));
        console.log(chalk.gray(`  Generated: ${result.metadata.generatedAt}`));
        console.log(chalk.gray(`  Detected tags: ${result.metadata.detectedTags.join(", ")}`));
        console.log(
          chalk.gray(`  Exported schemas: ${result.metadata.exportedSchemas.join(", ")}`),
        );
      }
    } else {
      // Fallback: single output
      const outputContent = JSON.stringify(result, null, 2);
      await outputContent_(outputContent, format, options);
    }
  });
}

/**
 * Output a single file from export result
 */
async function outputFile(
  file: { name: string; content: string; format: ExportFormat },
  options: ExportOptions,
  requestedFormat: ExportFormat,
): Promise<void> {
  const formattedContent = applyContentFormatting(file.content, requestedFormat, options);
  
  if (options.output) {
    await writeToFileSystem(file, formattedContent, options.output);
  } else {
    outputToConsole(file.name, formattedContent);
  }
}

/**
 * Apply content formatting based on format and options
 */
function applyContentFormatting(
  content: string,
  requestedFormat: ExportFormat,
  options: ExportOptions,
): string {
  if (requestedFormat === "json" && options.minify) {
    return minifyJsonContent(content);
  }
  return content;
}

/**
 * Minify JSON content safely
 */
function minifyJsonContent(content: string): string {
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed);
  } catch {
    // Keep original if not valid JSON
    return content;
  }
}

/**
 * Write content to filesystem with path resolution
 */
async function writeToFileSystem(
  file: { name: string; format: ExportFormat },
  content: string,
  outputPath: string,
): Promise<void> {
  const resolvedPath = await resolveOutputPath(outputPath, file.name);
  await fs.writeFile(resolvedPath, content, "utf-8");
  console.log(chalk.green(`✓ Exported ${file.format} to ${resolvedPath}`));
}

/**
 * Resolve output path (directory vs file)
 */
async function resolveOutputPath(outputPath: string, fileName: string): Promise<string> {
  try {
    const stats = await fs.stat(outputPath);
    if (stats.isDirectory()) {
      return path.join(outputPath, fileName);
    }
  } catch {
    // Path doesn't exist, treat as file
  }
  return outputPath;
}

/**
 * Output content to console
 */
function outputToConsole(fileName: string, content: string): void {
  console.log(chalk.blue(`--- ${fileName} ---`));
  console.log(content);
}

/**
 * Output content directly (fallback method)
 */
async function outputContent_(
  content: string,
  format: ExportFormat,
  options: ExportOptions,
): Promise<void> {
  if (options.output) {
    let outputPath = options.output;

    // If output is a directory, generate filename
    try {
      const stats = await fs.stat(outputPath);
      if (stats.isDirectory()) {
        const extension = getDefaultExtension(format);
        const filename = `export.${extension}`;
        outputPath = path.join(outputPath, filename);
      }
    } catch {
      // Path doesn't exist, treat as file
    }

    await fs.writeFile(outputPath, content, "utf-8");
    console.log(chalk.green(`✓ Exported ${format} to ${outputPath}`));
  } else {
    // Output to stdout
    console.log(content);
  }
}

/**
 * Get default file extension for format
 */
function getDefaultExtension(format: ExportFormat): string {
  switch (format) {
    case "openapi":
      return "openapi.yaml";
    case "types":
      return "d.ts";
    case "k8s":
      return "k8s.yaml";
    case "terraform":
      return "tf";
    case "json-schema":
      return "schema.json";
    default:
      return "txt";
  }
}

/**
 * List available export formats from the API
 */
export async function listFormats(config: CLIConfig): Promise<void> {
  try {
    const apiClient = new ApiClient(config);
    const result = await apiClient.getSupportedFormats();

    if (!result.success || !result.data) {
      console.error(chalk.red("Failed to get supported formats from API"));
      console.error(chalk.red(`Error: ${result.error}`));

      // Fallback to static list
      console.log(chalk.yellow("\nFallback - Static format list:"));
      const fallbackFormats = [
        {
          format: "openapi",
          description: "OpenAPI 3.1 specification",
          example: "// #OpenAPI api-v1",
        },
        {
          format: "types",
          description: "TypeScript type definitions",
          example: "// #TypeScript models",
        },
        { format: "k8s", description: "Kubernetes YAML manifests", example: "// #K8s deployment" },
        {
          format: "terraform",
          description: "Terraform HCL configuration",
          example: "// #Terraform infrastructure",
        },
        {
          format: "json-schema",
          description: "JSON Schema specification",
          example: "// #JsonSchema validation",
        },
      ];

      printFormats(fallbackFormats);
      return;
    }

    console.log(chalk.cyan("Available export formats:"));
    console.log();

    printFormats(result.data);

    console.log();
    console.log(chalk.gray("Note: Exports require explicit tagging in your CUE schema."));
    console.log(
      chalk.gray('Add comments like "// #OpenAPI api-v1" to enable export for that format.'),
    );
  } catch (error) {
    console.error(chalk.red("Failed to list formats:"), error);
  }
}

/**
 * Print formats in a consistent format
 */
function printFormats(
  formats: Array<{ format: string; description: string; example: string }>,
): void {
  formats.forEach((format) => {
    console.log(`${chalk.green(format.format.padEnd(12))} ${format.description}`);
    console.log(`${" ".repeat(14)}${chalk.gray(format.example)}`);
    console.log();
  });
}
