/**
 * @packageDocumentation
 * TypeScript API surface extractor.
 *
 * Extracts exported types, interfaces, functions, and classes from TypeScript
 * source files by parsing TypeScript AST patterns.
 */

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { APISurface, APISymbol, SurfaceOptions } from "@/surface-extraction/types.js";
import { calculateStatistics } from "@/surface-extraction/utils.js";
import chalk from "chalk";

/**
 * Extract the public API surface from TypeScript source files.
 * @param options - Surface extraction options
 * @param sourceFiles - Array of TypeScript file paths to process
 * @returns Promise resolving to API surface or null on failure
 */
export async function extractTypeScriptSurface(
  options: SurfaceOptions,
  sourceFiles: string[],
): Promise<APISurface | null> {
  try {
    if (sourceFiles.length === 0) {
      console.log(chalk.yellow("No TypeScript files found"));
      return null;
    }

    const symbols: APISymbol[] = [];

    for (const file of sourceFiles) {
      const content = await readFile(file, "utf-8");
      const fileSymbols = await parseTypeScriptFile(file, content, options);
      symbols.push(...fileSymbols);
    }

    return {
      language: "typescript",
      version: await getTypeScriptVersion(),
      timestamp: Date.now(),
      symbols,
      statistics: calculateStatistics(symbols),
    };
  } catch (error) {
    console.error(chalk.red("TypeScript surface extraction failed:"), error);
    return null;
  }
}

/**
 * Parse a TypeScript file for API symbols.
 * @param filePath - Path to the TypeScript file
 * @param content - File content string
 * @param options - Surface extraction options
 * @returns Promise resolving to array of API symbols
 */
async function parseTypeScriptFile(
  filePath: string,
  content: string,
  options: SurfaceOptions,
): Promise<APISymbol[]> {
  const symbols: APISymbol[] = [];
  const lines = content.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmedLine = line.trim();

    if (isCommentOrEmpty(trimmedLine)) {
      continue;
    }

    const exportSymbol = parseExportStatement(trimmedLine, line, filePath, lineIndex);
    if (exportSymbol) {
      symbols.push(exportSymbol);
    }

    const methodSymbol = parseMethodDeclaration(trimmedLine, line, filePath, lineIndex);
    if (methodSymbol) {
      symbols.push(methodSymbol);
    }
  }

  return options.includePrivate ? symbols : symbols.filter((s) => s.visibility === "public");
}

/**
 * Check if a line is a comment or empty.
 * @param line - Line to check
 * @returns True if line is a comment or empty
 */
function isCommentOrEmpty(line: string): boolean {
  return line.startsWith("//") || line.startsWith("/*") || !line;
}

/**
 * Parse an export statement from a line.
 * @param trimmedLine - Trimmed line content
 * @param originalLine - Original line with whitespace
 * @param filePath - Path to the source file
 * @param lineIndex - Zero-based line index
 * @returns API symbol if found, null otherwise
 */
function parseExportStatement(
  trimmedLine: string,
  originalLine: string,
  filePath: string,
  lineIndex: number,
): APISymbol | null {
  const exportMatch = trimmedLine.match(/^export\s+(async\s+)?(\w+)\s+(\w+)/);
  if (!exportMatch) return null;

  const [, , type, name] = exportMatch;
  const symbolType = getSymbolType(type);

  const symbol: APISymbol = {
    name,
    type: symbolType,
    visibility: "public",
    signature: trimmedLine,
    location: {
      file: filePath,
      line: lineIndex + 1,
      column: originalLine.indexOf(name) + 1,
    },
  };

  if (symbolType === "function") {
    const funcMatch = originalLine.match(/function\s+\w+\s*\([^)]*\)(?:\s*:\s*[^{]+)?/);
    if (funcMatch) {
      symbol.signature = funcMatch[0];
    }
  }

  return symbol;
}

/**
 * Map a TypeScript keyword to a symbol type.
 * @param type - TypeScript keyword (function, class, interface, etc.)
 * @returns Corresponding API symbol type
 */
function getSymbolType(type: string): APISymbol["type"] {
  if (["function", "class", "interface", "type"].includes(type)) {
    return type as APISymbol["type"];
  }
  return "variable";
}

/**
 * Parse a method declaration from a line.
 * @param trimmedLine - Trimmed line content
 * @param originalLine - Original line with whitespace
 * @param filePath - Path to the source file
 * @param lineIndex - Zero-based line index
 * @returns API symbol if found, null otherwise
 */
function parseMethodDeclaration(
  trimmedLine: string,
  originalLine: string,
  filePath: string,
  lineIndex: number,
): APISymbol | null {
  const methodMatch = trimmedLine.match(
    /^\s*(public|private|protected)?\s*(static\s+)?(async\s+)?(\w+)\s*\(/,
  );
  if (!methodMatch) return null;

  const [, visibility, , , name] = methodMatch;

  return {
    name,
    type: "function",
    visibility: (visibility as APISymbol["visibility"]) || "public",
    signature: trimmedLine,
    location: {
      file: filePath,
      line: lineIndex + 1,
      column: originalLine.indexOf(name) + 1,
    },
  };
}

/**
 * Get the installed TypeScript compiler version.
 * @returns Promise resolving to version string or "unknown"
 */
async function getTypeScriptVersion(): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("tsc", ["--version"], { stdio: "pipe" });
    let output = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", () => {
      const version = output.match(/Version\s+([\d.]+)/)?.[1] || "";
      resolve(version);
    });

    child.on("error", () => {
      resolve("unknown");
    });
  });
}
