/**
 * @packageDocumentation
 * Rust API surface extractor.
 *
 * Extracts public structs, functions, traits, and impl blocks from Rust
 * source files using cargo doc or regex-based parsing.
 */

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { APISurface, APISymbol, SurfaceOptions } from "@/surface-extraction/types.js";
import { calculateStatistics } from "@/surface-extraction/utils.js";
import chalk from "chalk";
import { glob } from "glob";

interface SpawnResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

/**
 * Run a shell command and capture its output.
 * @param command - Command to execute
 * @param args - Command arguments
 * @returns Promise resolving to stdout, stderr, and exit code
 */
async function runCommand(command: string, args: string[]): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "pipe" });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("close", (code) => resolve({ stdout, stderr, code }));
    child.on("error", reject);
  });
}

/**
 * Create a base API symbol with common properties.
 * @param name - Symbol name
 * @param type - Symbol type (function, class, interface, etc.)
 * @param signature - Full signature string
 * @param file - Source file path
 * @param line - Line number
 * @param column - Column number
 * @param docs - Optional documentation string
 * @returns APISymbol object
 */
function createSymbolBase(
  name: string,
  type: APISymbol["type"],
  signature: string,
  file: string,
  line: number,
  column: number,
  docs?: string,
): APISymbol {
  return {
    name: name || "unnamed",
    type,
    visibility: "public",
    signature: signature || name,
    location: { file, line, column },
    documentation: docs,
  };
}

/**
 * Create an API surface object from extracted symbols.
 * @param version - Rust version string
 * @param symbols - Array of extracted API symbols
 * @returns Complete API surface object
 */
function createAPISurface(version: string, symbols: APISymbol[]): APISurface {
  return {
    language: "rust",
    version,
    timestamp: Date.now(),
    symbols,
    statistics: calculateStatistics(symbols),
  };
}

interface RustExtractionStrategy {
  readonly name: string;
  readonly description: string;
  canHandle(options: SurfaceOptions): Promise<boolean>;
  extract(options: SurfaceOptions): Promise<APISurface | null>;
}

class CargoPublicApiStrategy implements RustExtractionStrategy {
  readonly name = "cargo-public-api";
  readonly description = "Using cargo public-api";

  async canHandle(_options: SurfaceOptions): Promise<boolean> {
    const cargoTomlExists = await glob("Cargo.toml").then((files) => files.length > 0);
    return cargoTomlExists;
  }

  async extract(options: SurfaceOptions): Promise<APISurface | null> {
    return await extractRustWithPublicApi(options);
  }
}

class RustdocJsonStrategy implements RustExtractionStrategy {
  readonly name = "rustdoc-json";
  readonly description = "Using rustdoc JSON";

  async canHandle(_options: SurfaceOptions): Promise<boolean> {
    const cargoTomlExists = await glob("Cargo.toml").then((files) => files.length > 0);
    return cargoTomlExists;
  }

  async extract(options: SurfaceOptions): Promise<APISurface | null> {
    return await extractRustWithRustdocJson(options);
  }
}

class SynParseStrategy implements RustExtractionStrategy {
  readonly name = "syn-parse";
  readonly description = "Using syn-based parsing";

  async canHandle(_options: SurfaceOptions): Promise<boolean> {
    const rustFiles = await glob("src/**/*.rs").then((files) => files.length > 0);
    return rustFiles;
  }

  async extract(options: SurfaceOptions): Promise<APISurface | null> {
    return await extractRustWithSynParse(options);
  }
}

class RustSurfaceExtractor {
  private readonly strategies: RustExtractionStrategy[] = [
    new CargoPublicApiStrategy(),
    new RustdocJsonStrategy(),
    new SynParseStrategy(),
  ];

  /**
   * Try a single extraction strategy
   */
  private async tryStrategy(
    strategy: RustExtractionStrategy,
    index: number,
    options: SurfaceOptions,
  ): Promise<APISurface | null> {
    console.log(chalk.dim(`Strategy ${index + 1}: ${strategy.description}...`));

    const canHandle = await strategy.canHandle(options);
    if (!canHandle) {
      console.log(chalk.dim(`Strategy ${strategy.name} cannot handle this project`));
      return null;
    }

    const result = await strategy.extract(options);
    if (result) {
      console.log(chalk.green(`✅ Successfully extracted using ${strategy.name}`));
    }
    return result;
  }

  /**
   * Attempt extraction with all strategies
   */
  private async tryAllStrategies(options: SurfaceOptions): Promise<APISurface | null> {
    for (let i = 0; i < this.strategies.length; i++) {
      try {
        const result = await this.tryStrategy(this.strategies[i], i, options);
        if (result) return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(chalk.dim(`${this.strategies[i].name} failed: ${errorMsg}`));
      }
    }
    return null;
  }

  async extractSurface(options: SurfaceOptions): Promise<APISurface | null> {
    const projectValid = await this.validateRustProject();
    if (!projectValid) {
      console.log(chalk.yellow("No Rust project found"));
      return null;
    }

    console.log(chalk.dim("Attempting Rust surface extraction..."));
    const result = await this.tryAllStrategies(options);

    if (!result) {
      console.log(chalk.red("❌ All Rust extraction strategies failed"));
    }
    return result;
  }

  private async validateRustProject(): Promise<boolean> {
    const cargoTomlExists = await glob("Cargo.toml").then((files) => files.length > 0);
    const rustFilesExist = await glob("src/**/*.rs").then((files) => files.length > 0);
    return cargoTomlExists || rustFilesExist;
  }
}

/**
 * Extract the public API surface from a Rust project.
 * @param options - Surface extraction options
 * @param _sourceFiles - Optional source file paths (unused)
 * @returns Promise resolving to API surface or null on failure
 */
export async function extractRustSurface(
  options: SurfaceOptions,
  _sourceFiles: string[] = [],
): Promise<APISurface | null> {
  try {
    const extractor = new RustSurfaceExtractor();
    return await extractor.extractSurface(options);
  } catch (error) {
    console.error(chalk.red("Rust surface extraction failed:"), error);
    return null;
  }
}

/**
 * Parse a single item from cargo public-api output.
 * @param item - Raw item from public-api JSON
 * @returns Parsed API symbol
 */
function parsePublicApiItem(item: Record<string, unknown>): APISymbol {
  const symbol = createSymbolBase(
    item.name as string,
    mapRustItemType(item.kind as string),
    item.signature as string,
    (item.file_path as string) || "",
    (item.line as number) || 1,
    (item.column as number) || 1,
    item.docs as string | undefined,
  );

  if (item.kind === "function") {
    symbol.parameters = (item.inputs as Array<{ name?: string; ty?: string }> | undefined)?.map(
      (input) => ({
        name: input.name || "param",
        type: input.ty || "",
      }),
    );
    symbol.returnType = (item.output as { ty?: string } | undefined)?.ty;
  }

  return symbol;
}

/**
 * Extract Rust API surface using cargo public-api.
 * @param _options - Surface extraction options (unused)
 * @returns Promise resolving to API surface or null
 */
async function extractRustWithPublicApi(_options: SurfaceOptions): Promise<APISurface | null> {
  const result = await runCommand("cargo", ["public-api", "--format", "json"]);

  if (result.code !== 0) {
    throw new Error(`cargo public-api failed: ${result.stderr}`);
  }

  const apiData = JSON.parse(result.stdout) as { items?: Array<Record<string, unknown>> };
  const symbols = (apiData.items ?? []).map(parsePublicApiItem);

  return createAPISurface(await getRustVersion(), symbols);
}

interface RustdocItem {
  name?: string;
  kind?: string;
  visibility?: string;
  signature?: string;
  docs?: string;
  span?: { filename?: string; begin?: [number, number] };
}

/**
 * Parse a single item from rustdoc JSON output.
 * @param item - Raw rustdoc item
 * @returns Parsed API symbol or null if not public
 */
function parseRustdocItem(item: RustdocItem): APISymbol | null {
  if (item.visibility !== "public") return null;

  return createSymbolBase(
    item.name || "unnamed",
    mapRustItemType(item.kind || ""),
    item.signature || item.name || "",
    item.span?.filename || "",
    item.span?.begin?.[0] || 1,
    item.span?.begin?.[1] || 1,
    item.docs,
  );
}

/**
 * Parse a rustdoc JSON file and extract symbols.
 * @param docFile - Path to rustdoc JSON file
 * @returns Array of parsed API symbols
 */
async function parseDocFile(docFile: string): Promise<APISymbol[]> {
  try {
    const content = await readFile(docFile, "utf-8");
    const docJson = JSON.parse(content) as { index?: { items?: RustdocItem[] } };
    const items = docJson.index?.items ?? [];
    return items.map(parseRustdocItem).filter((s): s is APISymbol => s !== null);
  } catch (error) {
    console.log(chalk.dim(`Failed to parse rustdoc JSON file ${docFile}: ${error}`));
    return [];
  }
}

/**
 * Extract Rust API surface using rustdoc JSON output.
 * @param _options - Surface extraction options (unused)
 * @returns Promise resolving to API surface or null
 */
async function extractRustWithRustdocJson(_options: SurfaceOptions): Promise<APISurface | null> {
  const result = await runCommand("cargo", ["doc", "--no-deps", "--output-format", "json"]);

  if (result.code !== 0) {
    throw new Error(`cargo doc failed: ${result.stderr}`);
  }

  const docFiles = await glob("target/doc/*.json");
  const symbolArrays = await Promise.all(docFiles.map(parseDocFile));
  const symbols = symbolArrays.flat();

  return createAPISurface(await getRustVersion(), symbols);
}

/**
 * Extract Rust API surface using regex-based parsing.
 * @param options - Surface extraction options
 * @returns Promise resolving to API surface or null
 */
async function extractRustWithSynParse(options: SurfaceOptions): Promise<APISurface | null> {
  const files = await glob("src/**/*.rs", {
    ignore: ["target/**", "node_modules/**"],
  });

  if (files.length === 0) {
    throw new Error("No Rust source files found");
  }

  const symbols: APISymbol[] = [];

  for (const file of files) {
    const content = await readFile(file, "utf-8");
    const fileSymbols = await parseRustFile(file, content, options);
    symbols.push(...fileSymbols);
  }

  return {
    language: "rust",
    version: await getRustVersion(),
    timestamp: Date.now(),
    symbols,
    statistics: calculateStatistics(symbols),
  };
}

/**
 * Check if a line should be skipped during parsing.
 */
function shouldSkipLine(trimmedLine: string): boolean {
  return trimmedLine.startsWith("//") || trimmedLine.startsWith("/*") || !trimmedLine;
}

/**
 * Extract function signature from a line if it's a function declaration.
 */
function extractFunctionSignature(line: string, defaultSignature: string): string {
  const funcMatch = line.match(/fn\s+\w+\s*\([^)]*\)(?:\s*->\s*[^{]+)?/);
  return funcMatch ? funcMatch[0] : defaultSignature;
}

/**
 * Create an API symbol from a public declaration match.
 */
function createSymbolFromMatch(
  match: RegExpMatchArray,
  filePath: string,
  line: string,
  trimmedLine: string,
  lineIndex: number,
): APISymbol {
  const [, itemType, name] = match;
  const signature = itemType === "fn" ? extractFunctionSignature(line, trimmedLine) : trimmedLine;

  return {
    name,
    type: mapRustItemType(itemType),
    visibility: "public",
    signature,
    location: {
      file: filePath,
      line: lineIndex + 1,
      column: line.indexOf(name) + 1,
    },
  };
}

/**
 * Try to parse a public declaration from a line.
 */
function tryParsePublicDeclaration(
  line: string,
  trimmedLine: string,
  filePath: string,
  lineIndex: number,
): APISymbol | null {
  const pubMatch = trimmedLine.match(/^pub\s+(fn|struct|enum|trait|mod|const|static|type)\s+(\w+)/);
  if (!pubMatch) return null;
  return createSymbolFromMatch(pubMatch, filePath, line, trimmedLine, lineIndex);
}

/**
 * Parse a single Rust source file for public symbols.
 * @param filePath - Path to the source file
 * @param content - File content string
 * @param options - Surface extraction options
 * @returns Array of extracted API symbols
 */
async function parseRustFile(
  filePath: string,
  content: string,
  options: SurfaceOptions,
): Promise<APISymbol[]> {
  const symbols: APISymbol[] = [];
  const lines = content.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmedLine = line.trim();

    if (shouldSkipLine(trimmedLine)) continue;

    const symbol = tryParsePublicDeclaration(line, trimmedLine, filePath, lineIndex);
    if (symbol) {
      symbols.push(symbol);
    }
  }

  return options.includePrivate ? symbols : symbols.filter((s) => s.visibility === "public");
}

/**
 * Map Rust item types to standard API symbol types.
 * @param rustType - Rust item type string
 * @returns Corresponding APISymbol type
 */
function mapRustItemType(rustType: string): APISymbol["type"] {
  switch (rustType) {
    case "fn":
      return "function";
    case "struct":
      return "class";
    case "enum":
      return "type";
    case "trait":
      return "interface";
    case "const":
      return "constant";
    case "static":
      return "variable";
    case "type":
      return "type";
    case "mod":
      return "variable";
    default:
      return "variable";
  }
}

/**
 * Get the installed Rust compiler version.
 * @returns Promise resolving to version string or "unknown"
 */
async function getRustVersion(): Promise<string> {
  try {
    const result = await runCommand("rustc", ["--version"]);
    return result.stdout.match(/rustc\s+([\d.]+)/)?.[1] || "unknown";
  } catch {
    return "unknown";
  }
}
