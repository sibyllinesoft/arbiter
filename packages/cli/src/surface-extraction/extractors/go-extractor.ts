/**
 * @packageDocumentation
 * Go API surface extractor.
 *
 * Extracts exported types, functions, and interfaces from Go source files
 * using go doc and AST parsing strategies.
 */

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { APISurface, APISymbol, SurfaceOptions } from "@/surface-extraction/types.js";
import { calculateStatistics } from "@/surface-extraction/utils.js";
import chalk from "chalk";
import { glob } from "glob";

/**
 * Check if the current directory is a Go project.
 * @returns True if go.mod exists
 */
async function isGoProject(): Promise<boolean> {
  const files = await glob("go.mod");
  return files.length > 0;
}

/**
 * Log an error that occurred during extraction strategy.
 * @param strategy - Name of the strategy
 * @param error - Error that occurred
 */
function logStrategyError(strategy: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.log(chalk.dim(`${strategy} failed: ${message}`));
}

/**
 * Try an extraction strategy and handle errors gracefully.
 * @param name - Name of the strategy
 * @param extractor - Async function that performs the extraction
 * @returns API surface or null if extraction failed
 */
async function tryExtractionStrategy(
  name: string,
  extractor: () => Promise<APISurface | null>,
): Promise<APISurface | null> {
  try {
    console.log(chalk.dim(`${name}...`));
    const result = await extractor();
    if (result) {
      console.log(chalk.green(`✅ Successfully extracted using ${name.toLowerCase()}`));
      return result;
    }
  } catch (error) {
    logStrategyError(name, error);
  }
  return null;
}

/**
 * Extract API surface from Go source files.
 * @param options - Surface extraction options
 * @param _sourceFiles - Optional list of source files (unused)
 * @returns API surface or null if extraction failed
 */
export async function extractGoSurface(
  options: SurfaceOptions,
  _sourceFiles: string[] = [],
): Promise<APISurface | null> {
  try {
    if (!(await isGoProject())) {
      console.log(chalk.yellow("No go.mod found - not a Go project"));
      return null;
    }

    console.log(chalk.dim("Attempting Go surface extraction..."));

    const goToolsResult = await tryExtractionStrategy("Strategy 1: Using go list + go doc", () =>
      extractGoWithGoTools(options),
    );
    if (goToolsResult) return goToolsResult;

    const basicResult = await tryExtractionStrategy("Strategy 2: Basic Go parsing", () =>
      extractGoWithBasicParsing(options),
    );
    if (basicResult) return basicResult;

    console.log(chalk.red("❌ All Go extraction strategies failed"));
    return null;
  } catch (error) {
    console.error(chalk.red("Go surface extraction failed:"), error);
    return null;
  }
}

/**
 * Check if a line is a valid package line.
 * @param line - Line to check
 * @returns True if the line is valid
 */
function isValidPackageLine(line: string): boolean {
  return Boolean(line.trim());
}

/**
 * Check if a package is a test package.
 * @param packageInfo - Package info object
 * @returns True if the package is a test package
 */
function isTestPackage(packageInfo: { Name?: string }): boolean {
  return packageInfo.Name?.endsWith("_test") ?? false;
}

/**
 * Collect symbols from all packages.
 * @param lines - Lines of go list output
 * @returns Array of API symbols
 */
async function collectPackageSymbols(lines: string[]): Promise<APISymbol[]> {
  const symbols: APISymbol[] = [];
  for (const line of lines) {
    if (!isValidPackageLine(line)) continue;
    const packageInfo = JSON.parse(line);
    if (isTestPackage(packageInfo)) continue;
    const packageSymbols = await getGoPackageSymbols(packageInfo.ImportPath);
    symbols.push(...packageSymbols);
  }
  return symbols;
}

/**
 * Build an API surface from collected symbols.
 * @param symbols - Array of API symbols
 * @param includePrivate - Whether to include private symbols
 * @returns API surface or null if no symbols
 */
async function buildGoSurfaceFromSymbols(
  symbols: APISymbol[],
  includePrivate: boolean,
): Promise<APISurface | null> {
  if (symbols.length === 0) return null;
  return {
    language: "go",
    version: await getGoVersion(),
    timestamp: Date.now(),
    symbols: filterGoSymbolsByVisibility(symbols, includePrivate),
    statistics: calculateStatistics(symbols),
  };
}

/**
 * Extract Go surface using go list and go doc tools.
 * @param options - Surface extraction options
 * @returns API surface or null if extraction failed
 */
async function extractGoWithGoTools(options: SurfaceOptions): Promise<APISurface | null> {
  return new Promise((resolve, reject) => {
    const child = spawn("go", ["list", "-json", "@/surface-extraction/..."], { stdio: "pipe" });
    let output = "";
    let errorOutput = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });
    child.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    child.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`go list failed: ${errorOutput}`));
        return;
      }
      try {
        const symbols = await collectPackageSymbols(output.trim().split("\n"));
        resolve(await buildGoSurfaceFromSymbols(symbols, options.includePrivate ?? false));
      } catch (error) {
        reject(new Error(`Failed to parse go list output: ${error}`));
      }
    });

    child.on("error", (error) => {
      reject(
        new Error(`go list command failed: ${error instanceof Error ? error.message : error}`),
      );
    });
  });
}

/**
 * Get symbols from a Go package using go doc.
 * @param packagePath - Package import path
 * @returns Array of API symbols
 */
async function getGoPackageSymbols(packagePath: string): Promise<APISymbol[]> {
  return new Promise((resolve) => {
    const child = spawn("go", ["doc", "-all", packagePath], { stdio: "pipe" });
    let output = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", () => {
      resolve(parseGoDocOutput(output, packagePath));
    });

    child.on("error", () => {
      resolve([]);
    });
  });
}

/** Parser for go doc command output */
class GoDocParser {
  constructor(private readonly packagePath: string) {}

  parseDocOutput(docOutput: string): APISymbol[] {
    const symbols: APISymbol[] = [];
    const lines = docOutput.split("\n");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const functionSymbol = this.parseFunctionLine(trimmed);
      if (functionSymbol) {
        symbols.push(functionSymbol);
        continue;
      }

      const typeSymbol = this.parseTypeLine(trimmed);
      if (typeSymbol) {
        symbols.push(typeSymbol);
        continue;
      }

      const variableSymbol = this.parseVariableLine(trimmed);
      if (variableSymbol) {
        symbols.push(variableSymbol);
      }
    }

    return symbols;
  }

  private parseFunctionLine(line: string): APISymbol | null {
    const funcMatch = line.match(/^func\s+(\w+)\s*\((.*?)\)(?:\s*\((.*?)\))?(?:\s+(.+))?/);
    if (!funcMatch) return null;

    const [, name, params, returns, returnType] = funcMatch;
    if (!this.isExported(name)) return null;

    return {
      name,
      type: "function",
      visibility: "public",
      signature: line,
      location: this.createLocation(),
      parameters: this.parseParameters(params),
      returnType: returnType || returns || "void",
    };
  }

  private parseTypeLine(line: string): APISymbol | null {
    const typeMatch = line.match(/^type\s+(\w+)\s+(struct|interface|.+)/);
    if (!typeMatch) return null;

    const [, name, typeKind] = typeMatch;
    if (!this.isExported(name)) return null;

    return {
      name,
      type: this.mapGoTypeToSymbolType(typeKind),
      visibility: "public",
      signature: line,
      location: this.createLocation(),
    };
  }

  private parseVariableLine(line: string): APISymbol | null {
    const varMatch = line.match(/^(var|const)\s+(\w+)\s+(.+)/);
    if (!varMatch) return null;

    const [, kind, name, type] = varMatch;
    if (!this.isExported(name)) return null;

    return {
      name,
      type: kind === "const" ? "constant" : "variable",
      visibility: "public",
      signature: line,
      location: this.createLocation(),
      returnType: type,
    };
  }

  private parseParameters(params: string): APISymbol["parameters"] {
    if (!params) return [];

    return params
      .split(",")
      .map((param) => {
        const parts = param.trim().split(" ");
        return {
          name: parts[0] || "param",
          type: parts.slice(1).join(" ") || "interface{}",
        };
      })
      .filter((param) => param.name !== "param");
  }

  private isExported(name: string): boolean {
    return Boolean(name) && name[0] === name[0].toUpperCase();
  }

  private mapGoTypeToSymbolType(typeKind: string): APISymbol["type"] {
    if (typeKind.startsWith("struct")) return "class";
    if (typeKind.startsWith("interface")) return "interface";
    return "type";
  }

  private createLocation() {
    return {
      file: this.packagePath,
      line: 1,
      column: 1,
    };
  }
}

/**
 * Parse go doc output into API symbols.
 * @param docOutput - Output from go doc command
 * @param packagePath - Package import path
 * @returns Array of API symbols
 */
function parseGoDocOutput(docOutput: string, packagePath: string): APISymbol[] {
  const parser = new GoDocParser(packagePath);
  return parser.parseDocOutput(docOutput);
}

/**
 * Extract Go surface using basic file parsing.
 * @param options - Surface extraction options
 * @returns API surface or null if extraction failed
 */
async function extractGoWithBasicParsing(options: SurfaceOptions): Promise<APISurface | null> {
  const files = await glob("**/*.go", {
    ignore: ["vendor/**", "node_modules/**", "**/*_test.go"],
  });

  if (files.length === 0) {
    throw new Error("No Go files found");
  }

  const symbols: APISymbol[] = [];

  for (const file of files) {
    const content = await readFile(file, "utf-8");
    const fileSymbols = await parseGoFile(file, content, options);
    symbols.push(...fileSymbols);
  }

  const visibleSymbols = options.includePrivate
    ? symbols
    : symbols.filter((symbol) => symbol.visibility === "public");

  return {
    language: "go",
    version: await getGoVersion(),
    timestamp: Date.now(),
    symbols: visibleSymbols,
    statistics: calculateStatistics(symbols),
  };
}

/** Function type for parsing a Go symbol from a line */
type GoSymbolParser = (line: string, filePath: string, lineIndex: number) => APISymbol | null;

/** List of Go symbol parsers */
const GO_SYMBOL_PARSERS: GoSymbolParser[] = [
  parseGoFunction,
  parseGoStruct,
  parseGoInterface,
  parseGoConstant,
  parseGoVariable,
];

/**
 * Parse a line for a Go symbol.
 * @param line - Line to parse
 * @param filePath - Path to the file
 * @param lineIndex - Line index in the file
 * @returns API symbol or null
 */
function parseGoLineForSymbol(line: string, filePath: string, lineIndex: number): APISymbol | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("//")) return null;
  for (const parser of GO_SYMBOL_PARSERS) {
    const symbol = parser(trimmed, filePath, lineIndex);
    if (symbol) return symbol;
  }
  return null;
}

/**
 * Filter Go symbols by visibility.
 * @param symbols - Array of API symbols
 * @param includePrivate - Whether to include private symbols
 * @returns Filtered array of symbols
 */
function filterGoSymbolsByVisibility(symbols: APISymbol[], includePrivate: boolean): APISymbol[] {
  return includePrivate ? symbols : symbols.filter((s) => s.visibility === "public");
}

/**
 * Parse a Go file for API symbols.
 * @param filePath - Path to the file
 * @param content - File content
 * @param options - Surface extraction options
 * @returns Array of API symbols
 */
async function parseGoFile(
  filePath: string,
  content: string,
  options: SurfaceOptions,
): Promise<APISymbol[]> {
  const lines = content.split("\n");
  const symbols = lines
    .map((line, idx) => parseGoLineForSymbol(line, filePath, idx))
    .filter((s): s is APISymbol => s !== null);
  return filterGoSymbolsByVisibility(symbols, options.includePrivate ?? false);
}

/**
 * Parse a Go function declaration.
 * @param line - Line to parse
 * @param filePath - Path to the file
 * @param lineIndex - Line index
 * @returns API symbol or null
 */
function parseGoFunction(line: string, filePath: string, lineIndex: number): APISymbol | null {
  const funcMatch = line.match(/^func\s+(\(.*?\)\s*)?(\w+)\s*\((.*?)\)(?:\s*(.+))?/);
  if (!funcMatch) return null;

  const [, receiver, name, params, returnType] = funcMatch;
  if (!isExported(name)) return null;

  return {
    name,
    type: "function",
    visibility: "public",
    signature: line,
    location: {
      file: filePath,
      line: lineIndex + 1,
      column: line.indexOf(name) + 1,
    },
    parameters: params
      .split(",")
      .map((param) => {
        const parts = param.trim().split(" ");
        return {
          name: parts[0] || "param",
          type: parts.slice(1).join(" ") || "interface{}",
        };
      })
      .filter((param) => param.name !== "param"),
    returnType: returnType?.trim() || "void",
  };
}

/**
 * Create a location object for a symbol.
 * @param filePath - Path to the file
 * @param line - Line content
 * @param name - Symbol name
 * @param lineIndex - Line index
 * @returns Location object
 */
function createLocation(filePath: string, line: string, name: string, lineIndex: number) {
  return { file: filePath, line: lineIndex + 1, column: line.indexOf(name) + 1 };
}

/**
 * Parse a Go type definition.
 * @param line - Line to parse
 * @param filePath - Path to the file
 * @param lineIndex - Line index
 * @param pattern - Regex pattern to match
 * @param symbolType - Type of symbol
 * @returns API symbol or null
 */
function parseGoTypeDefinition(
  line: string,
  filePath: string,
  lineIndex: number,
  pattern: RegExp,
  symbolType: APISymbol["type"],
): APISymbol | null {
  const match = line.match(pattern);
  if (!match) return null;
  const [, name] = match;
  if (!isExported(name)) return null;
  return {
    name,
    type: symbolType,
    visibility: "public",
    signature: line,
    location: createLocation(filePath, line, name, lineIndex),
  };
}

/**
 * Parse a Go value declaration (const or var).
 * @param line - Line to parse
 * @param filePath - Path to the file
 * @param lineIndex - Line index
 * @param pattern - Regex pattern to match
 * @param symbolType - Type of symbol
 * @returns API symbol or null
 */
function parseGoValueDeclaration(
  line: string,
  filePath: string,
  lineIndex: number,
  pattern: RegExp,
  symbolType: APISymbol["type"],
): APISymbol | null {
  const match = line.match(pattern);
  if (!match) return null;
  const [, name, type] = match;
  if (!isExported(name)) return null;
  return {
    name,
    type: symbolType,
    visibility: "public",
    signature: line,
    location: createLocation(filePath, line, name, lineIndex),
    returnType: type,
  };
}

/**
 * Parse a Go struct definition.
 * @param line - Line to parse
 * @param filePath - Path to the file
 * @param lineIndex - Line index
 * @returns API symbol or null
 */
function parseGoStruct(line: string, filePath: string, lineIndex: number): APISymbol | null {
  return parseGoTypeDefinition(line, filePath, lineIndex, /^type\s+(\w+)\s+struct/, "class");
}

/**
 * Parse a Go interface definition.
 * @param line - Line to parse
 * @param filePath - Path to the file
 * @param lineIndex - Line index
 * @returns API symbol or null
 */
function parseGoInterface(line: string, filePath: string, lineIndex: number): APISymbol | null {
  return parseGoTypeDefinition(line, filePath, lineIndex, /^type\s+(\w+)\s+interface/, "interface");
}

/**
 * Parse a Go constant declaration.
 * @param line - Line to parse
 * @param filePath - Path to the file
 * @param lineIndex - Line index
 * @returns API symbol or null
 */
function parseGoConstant(line: string, filePath: string, lineIndex: number): APISymbol | null {
  return parseGoValueDeclaration(line, filePath, lineIndex, /^const\s+(\w+)\s+(.+)/, "constant");
}

/**
 * Parse a Go variable declaration.
 * @param line - Line to parse
 * @param filePath - Path to the file
 * @param lineIndex - Line index
 * @returns API symbol or null
 */
function parseGoVariable(line: string, filePath: string, lineIndex: number): APISymbol | null {
  return parseGoValueDeclaration(line, filePath, lineIndex, /^var\s+(\w+)\s+(.+)/, "variable");
}

/**
 * Check if a Go symbol is exported.
 * @param name - Symbol name
 * @returns True if the symbol is exported
 */
function isExported(name: string | undefined): boolean {
  return Boolean(name) && name![0] === name![0].toUpperCase();
}

/**
 * Get the Go version installed on the system.
 * @returns Go version string or "unknown"
 */
async function getGoVersion(): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("go", ["version"], { stdio: "pipe" });
    let output = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", () => {
      const version = output.match(/go\s+version\s+go([\d.]+)/)?.[1] || "unknown";
      resolve(version);
    });

    child.on("error", () => {
      resolve("unknown");
    });
  });
}
