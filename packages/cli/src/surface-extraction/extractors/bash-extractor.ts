/**
 * @packageDocumentation
 * Bash/Shell API surface extractor.
 *
 * Extracts function definitions and exported variables from shell scripts
 * by parsing script content and detecting function patterns.
 */

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { APISurface, APISymbol, SurfaceOptions } from "@/surface-extraction/types.js";
import { calculateStatistics } from "@/surface-extraction/utils.js";
import chalk from "chalk";
import { glob } from "glob";

/** Default glob patterns to ignore when searching for shell files. */
const DEFAULT_IGNORE_PATTERNS = ["node_modules/**", ".git/**"];

/**
 * Discover shell script files in the current directory.
 * @returns Promise resolving to array of shell file paths
 */
async function discoverShellFiles(): Promise<string[]> {
  const shellFiles = await glob("**/*.{sh,bash}", {
    ignore: [...DEFAULT_IGNORE_PATTERNS, "**/test-fixtures*/**"],
  });
  const executableFiles = await glob("**/bin/*", { ignore: DEFAULT_IGNORE_PATTERNS });
  return [...shellFiles, ...executableFiles];
}

/**
 * Extract API symbols from a single shell file.
 * @param file - Path to the shell file
 * @param options - Surface extraction options
 * @returns Promise resolving to array of API symbols
 */
async function extractSymbolsFromFile(file: string, options: SurfaceOptions): Promise<APISymbol[]> {
  const content = await readFile(file, "utf-8");
  return parseBashFile(file, content, options);
}

/**
 * Collect API symbols from multiple shell files.
 * @param files - Array of file paths to process
 * @param options - Surface extraction options
 * @returns Promise resolving to array of all extracted symbols
 */
async function collectSymbolsFromFiles(
  files: string[],
  options: SurfaceOptions,
): Promise<APISymbol[]> {
  const symbols: APISymbol[] = [];
  for (const file of files) {
    try {
      const fileSymbols = await extractSymbolsFromFile(file, options);
      symbols.push(...fileSymbols);
    } catch (error) {
      console.log(
        chalk.dim(`Failed to parse ${file}: ${error instanceof Error ? error.message : error}`),
      );
    }
  }
  return symbols;
}

/**
 * Filter symbols by visibility setting.
 * @param symbols - Array of API symbols
 * @param includePrivate - Whether to include private symbols
 * @returns Filtered array of symbols
 */
function filterVisibleSymbols(symbols: APISymbol[], includePrivate: boolean): APISymbol[] {
  return includePrivate ? symbols : symbols.filter((s) => s.visibility === "public");
}

/**
 * Build an API surface object from extracted symbols.
 * @param symbols - All extracted symbols (for statistics)
 * @param visibleSymbols - Symbols to include in output
 * @returns Promise resolving to API surface object
 */
async function buildSurface(
  symbols: APISymbol[],
  visibleSymbols: APISymbol[],
): Promise<APISurface> {
  return {
    language: "bash",
    version: await getBashVersion(),
    timestamp: Date.now(),
    symbols: visibleSymbols,
    statistics: calculateStatistics(symbols),
  };
}

/**
 * Extract the public API surface from shell scripts.
 * @param options - Surface extraction options
 * @param _sourceFiles - Optional source file paths (unused)
 * @returns Promise resolving to API surface or null on failure
 */
export async function extractBashSurface(
  options: SurfaceOptions,
  _sourceFiles: string[] = [],
): Promise<APISurface | null> {
  try {
    const allFiles = await discoverShellFiles();
    if (allFiles.length === 0) {
      console.log(chalk.yellow("No shell scripts found"));
      return null;
    }

    console.log(chalk.dim(`Found ${allFiles.length} shell script(s)`));

    const symbols = await collectSymbolsFromFiles(allFiles, options);
    const visibleSymbols = filterVisibleSymbols(symbols, options.includePrivate ?? false);
    const surface = await buildSurface(symbols, visibleSymbols);

    console.log(chalk.green(`✅ Extracted ${surface.symbols.length} bash symbols`));
    return surface;
  } catch (error) {
    console.error(chalk.red("Bash surface extraction failed:"), error);
    return null;
  }
}

/** Regex pattern for matching bash function definitions. */
const FUNCTION_PATTERN = /^([a-zA-Z0-9_]+)\s*\(\)\s*\{/;
/** Regex pattern for matching CLI command invocations. */
const CLI_COMMAND_PATTERN = /^([a-zA-Z0-9_-]+)\s+--[a-zA-Z0-9-]+/;

/**
 * Check if a line should be skipped during parsing.
 * @param trimmed - Trimmed line content
 * @returns True if line is empty or a comment
 */
function isSkippableLine(trimmed: string): boolean {
  return !trimmed || trimmed.startsWith("#");
}

/**
 * Create an API symbol for a bash function.
 * @param name - Function name
 * @param filePath - Path to the source file
 * @param line - Original line content
 * @param lineIndex - Zero-based line index
 * @returns API symbol for the function
 */
function createFunctionSymbol(
  name: string,
  filePath: string,
  line: string,
  lineIndex: number,
): APISymbol {
  return {
    name,
    type: "function",
    visibility: name.startsWith("_") ? "private" : "public",
    signature: `${name}()`,
    location: { file: filePath, line: lineIndex + 1, column: line.indexOf(name) + 1 },
  };
}

/**
 * Create an API symbol for a CLI command invocation.
 * @param command - Command name
 * @param trimmed - Trimmed line content
 * @param filePath - Path to the source file
 * @param line - Original line content
 * @param lineIndex - Zero-based line index
 * @returns API symbol for the CLI command
 */
function createCliSymbol(
  command: string,
  trimmed: string,
  filePath: string,
  line: string,
  lineIndex: number,
): APISymbol {
  return {
    name: command,
    type: "variable",
    visibility: "public",
    signature: trimmed,
    location: { file: filePath, line: lineIndex + 1, column: line.indexOf(command) + 1 },
  };
}

/**
 * Parse a line for a shell symbol (function or CLI command).
 * @param line - Source line to parse
 * @param filePath - Path to the source file
 * @param lineIndex - Zero-based line index
 * @returns API symbol if found, null otherwise
 */
function parseLineForSymbol(line: string, filePath: string, lineIndex: number): APISymbol | null {
  const trimmed = line.trim();
  if (isSkippableLine(trimmed)) return null;

  const functionMatch = trimmed.match(FUNCTION_PATTERN);
  if (functionMatch) return createFunctionSymbol(functionMatch[1], filePath, line, lineIndex);

  const cliMatch = trimmed.match(CLI_COMMAND_PATTERN);
  if (cliMatch) return createCliSymbol(cliMatch[1], trimmed, filePath, line, lineIndex);

  return null;
}

/**
 * Parse a bash file for API symbols.
 * @param filePath - Path to the bash file
 * @param content - File content string
 * @param options - Surface extraction options
 * @returns Promise resolving to array of API symbols
 */
async function parseBashFile(
  filePath: string,
  content: string,
  options: SurfaceOptions,
): Promise<APISymbol[]> {
  const lines = content.split("\n");
  const symbols = lines
    .map((line, idx) => parseLineForSymbol(line, filePath, idx))
    .filter((s): s is APISymbol => s !== null);
  return filterVisibleSymbols(symbols, options.includePrivate ?? false);
}

/**
 * Get the installed bash version.
 * @returns Promise resolving to version string or "unknown"
 */
async function getBashVersion(): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("bash", ["--version"], { stdio: "pipe" });
    let output = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", () => {
      const version = output.match(/bash(?:.+version)?\s+([\d.]+)/i)?.[1] || "unknown";
      resolve(version);
    });

    child.on("error", () => {
      resolve("unknown");
    });
  });
}
