/**
 * @packageDocumentation
 * Python API surface extractor.
 *
 * Extracts classes, functions, and type hints from Python source files
 * using pyright stubs or AST parsing as fallback strategies.
 */

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { APISurface, APISymbol, SurfaceOptions } from "@/surface-extraction/types.js";
import { calculateStatistics } from "@/surface-extraction/utils.js";
import chalk from "chalk";
import { glob } from "glob";

/**
 * Interface for Python extraction command implementations.
 */
type PythonExtractionCommand = {
  readonly name: string;
  readonly description: string;
  execute(options: SurfaceOptions): Promise<APISurface | null>;
  canExecute(): Promise<boolean>;
};

/**
 * Extraction command using pyright for stub generation.
 */
class PyrightExtractionCommand implements PythonExtractionCommand {
  readonly name = "pyright";
  readonly description = "pyright stub generation";

  /**
   * Check if this command can execute on the current project.
   * @returns Promise resolving to true if Python project files exist
   */
  async canExecute(): Promise<boolean> {
    return await this.checkPythonProject();
  }

  /**
   * Execute pyright-based extraction.
   * @param options - Surface extraction options
   * @returns Promise resolving to API surface or null
   */
  async execute(options: SurfaceOptions): Promise<APISurface | null> {
    return await extractPythonWithPyright(options);
  }

  /**
   * Check for Python project indicators.
   * @returns Promise resolving to true if project files found
   */
  private async checkPythonProject(): Promise<boolean> {
    const results = await Promise.all([
      glob("pyproject.toml"),
      glob("setup.py"),
      glob("**/*.py", { ignore: ["__pycache__/**", "node_modules/**"] }),
    ]);
    return results.some((files) => files.length > 0);
  }
}

/**
 * Extraction command using mypy's stubgen for stub generation.
 */
class StubgenExtractionCommand implements PythonExtractionCommand {
  readonly name = "stubgen";
  readonly description = "stubgen";

  /**
   * Check if this command can execute on the current project.
   * @returns Promise resolving to true if Python project files exist
   */
  async canExecute(): Promise<boolean> {
    return await this.checkPythonProject();
  }

  /**
   * Execute stubgen-based extraction.
   * @param options - Surface extraction options
   * @returns Promise resolving to API surface or null
   */
  async execute(options: SurfaceOptions): Promise<APISurface | null> {
    return await extractPythonWithStubgen(options);
  }

  /**
   * Check for Python project indicators.
   * @returns Promise resolving to true if project files found
   */
  private async checkPythonProject(): Promise<boolean> {
    const results = await Promise.all([
      glob("pyproject.toml"),
      glob("setup.py"),
      glob("**/*.py", { ignore: ["__pycache__/**", "node_modules/**"] }),
    ]);
    return results.some((files) => files.length > 0);
  }
}

/**
 * Extraction command using basic regex-based AST parsing.
 */
class AstParsingExtractionCommand implements PythonExtractionCommand {
  readonly name = "ast-parsing";
  readonly description = "basic AST parsing";

  /**
   * Check if this command can execute by looking for Python files.
   * @returns Promise resolving to true if Python files exist
   */
  async canExecute(): Promise<boolean> {
    const pythonFiles = await glob("**/*.py", {
      ignore: ["__pycache__/**", "node_modules/**"],
    });
    return pythonFiles.length > 0;
  }

  /**
   * Execute AST-based parsing extraction.
   * @param options - Surface extraction options
   * @returns Promise resolving to API surface or null
   */
  async execute(options: SurfaceOptions): Promise<APISurface | null> {
    return await extractPythonWithAstParsing(options);
  }
}

/**
 * Invoker that orchestrates Python extraction commands.
 * Tries multiple strategies in order until one succeeds.
 */
class PythonExtractionInvoker {
  private commands: PythonExtractionCommand[] = [
    new PyrightExtractionCommand(),
    new StubgenExtractionCommand(),
    new AstParsingExtractionCommand(),
  ];

  /**
   * Try a single extraction command
   */
  private async tryCommand(
    command: PythonExtractionCommand,
    index: number,
    options: SurfaceOptions,
  ): Promise<APISurface | null> {
    console.log(chalk.dim(`Strategy ${index + 1}: Attempting ${command.description}...`));

    const canExecute = await command.canExecute();
    if (!canExecute) {
      console.log(chalk.dim(`${command.name} cannot execute for this project`));
      return null;
    }

    const result = await command.execute(options);
    if (result) {
      console.log(chalk.green(`✅ Successfully extracted using ${command.name}`));
    }
    return result;
  }

  /**
   * Attempt extraction with all commands
   */
  private async tryAllCommands(options: SurfaceOptions): Promise<APISurface | null> {
    for (let i = 0; i < this.commands.length; i++) {
      try {
        const result = await this.tryCommand(this.commands[i], i, options);
        if (result) return result;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(chalk.dim(`${this.commands[i].name} failed: ${errorMsg}`));
      }
    }
    return null;
  }

  /**
   * Execute extraction using available commands.
   * @param options - Surface extraction options
   * @returns Promise resolving to API surface or null if all strategies fail
   */
  async executeExtraction(options: SurfaceOptions): Promise<APISurface | null> {
    const hasValidCommands = await this.validateCommands();
    if (!hasValidCommands) {
      console.log(chalk.yellow("No Python project files found"));
      return null;
    }

    console.log(chalk.dim("Attempting Python surface extraction..."));
    const result = await this.tryAllCommands(options);

    if (!result) {
      console.log(chalk.red("❌ All Python extraction strategies failed"));
    }
    return result;
  }

  /**
   * Validate that at least one command can execute.
   * @returns Promise resolving to true if any command is executable
   */
  private async validateCommands(): Promise<boolean> {
    for (const command of this.commands) {
      if (await command.canExecute()) {
        return true;
      }
    }
    return false;
  }
}

/**
 * Extract the public API surface from a Python project.
 * @param options - Surface extraction options
 * @param _sourceFiles - Optional source file paths (unused)
 * @returns Promise resolving to API surface or null on failure
 */
export async function extractPythonSurface(
  options: SurfaceOptions,
  _sourceFiles: string[] = [],
): Promise<APISurface | null> {
  try {
    const invoker = new PythonExtractionInvoker();
    return await invoker.executeExtraction(options);
  } catch (error) {
    console.error(chalk.red("Python surface extraction failed:"), error);
    return null;
  }
}

/**
 * Extract Python API surface using pyright stub generation.
 * @param options - Surface extraction options
 * @returns Promise resolving to API surface or null
 */
async function extractPythonWithPyright(options: SurfaceOptions): Promise<APISurface | null> {
  return new Promise((resolve) => {
    const child = spawn("pyright", ["--createstub", "."], { stdio: "pipe" });
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
        throw new Error(`pyright failed: ${errorOutput}`);
      }

      try {
        const stubFiles = await glob("**/*.pyi", {
          ignore: ["node_modules/**", "__pycache__/**"],
        });

        const symbols: APISymbol[] = [];

        for (const stubFile of stubFiles) {
          const content = await readFile(stubFile, "utf-8");
          const fileSymbols = await parsePythonStubFile(stubFile, content, options);
          symbols.push(...fileSymbols);
        }

        resolve(await createSurface(symbols));
      } catch (error) {
        throw new Error(`Failed to parse pyright stubs: ${error}`);
      }
    });

    child.on("error", (error) => {
      throw new Error(`pyright command failed: ${error.message}`);
    });
  });
}

/**
 * Extract Python API surface using mypy's stubgen tool.
 * @param options - Surface extraction options
 * @returns Promise resolving to API surface or null
 */
async function extractPythonWithStubgen(options: SurfaceOptions): Promise<APISurface | null> {
  return new Promise((resolve) => {
    const child = spawn("stubgen", ["-o", "stubs", "."], { stdio: "pipe" });
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
        throw new Error(`stubgen failed: ${errorOutput}`);
      }

      try {
        const stubFiles = await glob("stubs/**/*.pyi");
        const symbols: APISymbol[] = [];

        for (const stubFile of stubFiles) {
          const content = await readFile(stubFile, "utf-8");
          const fileSymbols = await parsePythonStubFile(stubFile, content, options);
          symbols.push(...fileSymbols);
        }

        resolve(await createSurface(symbols));
      } catch (error) {
        throw new Error(`Failed to parse stubgen output: ${error}`);
      }
    });

    child.on("error", (error) => {
      throw new Error(`stubgen command failed: ${error.message}`);
    });
  });
}

/**
 * Extract Python API surface using regex-based parsing.
 * @param options - Surface extraction options
 * @returns Promise resolving to API surface or null
 */
async function extractPythonWithAstParsing(options: SurfaceOptions): Promise<APISurface | null> {
  const pythonFiles = await glob("**/*.py", {
    ignore: ["__pycache__/**", "node_modules/**"],
  });

  if (pythonFiles.length === 0) {
    return null;
  }

  const symbols: APISymbol[] = [];

  for (const file of pythonFiles) {
    const content = await readFile(file, "utf-8");
    const fileSymbols = await parsePythonFile(file, content, options);
    symbols.push(...fileSymbols);
  }

  if (symbols.length === 0) {
    return null;
  }

  console.log(chalk.green("✅ Successfully extracted using AST parsing"));
  return await createSurface(symbols);
}

/**
 * Parse a Python stub file (.pyi) for API symbols.
 * @param filePath - Path to the stub file
 * @param content - File content string
 * @param options - Surface extraction options
 * @returns Promise resolving to array of API symbols
 */
async function parsePythonStubFile(
  filePath: string,
  content: string,
  options: SurfaceOptions,
): Promise<APISymbol[]> {
  return parsePythonFileCommon(filePath, content, options);
}

/**
 * Parse a Python source file (.py) for API symbols.
 * @param filePath - Path to the source file
 * @param content - File content string
 * @param options - Surface extraction options
 * @returns Promise resolving to array of API symbols
 */
async function parsePythonFile(
  filePath: string,
  content: string,
  options: SurfaceOptions,
): Promise<APISymbol[]> {
  return parsePythonFileCommon(filePath, content, options);
}

/**
 * Common parsing logic for Python source and stub files.
 * @param filePath - Path to the file
 * @param content - File content string
 * @param options - Surface extraction options
 * @returns Array of extracted API symbols
 */
function parsePythonFileCommon(
  filePath: string,
  content: string,
  options: SurfaceOptions,
): APISymbol[] {
  const symbols: APISymbol[] = [];
  const lines = content.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmedLine = line.trim();

    if (isPythonCommentOrEmpty(trimmedLine)) continue;

    const funcSymbol = parsePythonFunction(trimmedLine, filePath, lineIndex);
    if (funcSymbol) symbols.push(funcSymbol);

    const classSymbol = parsePythonClass(trimmedLine, filePath, lineIndex);
    if (classSymbol) symbols.push(classSymbol);
  }

  return options.includePrivate ? symbols : symbols.filter((s) => s.visibility === "public");
}

/**
 * Check if a line is a Python comment or empty.
 * @param line - Line to check
 * @returns True if line is a comment or empty
 */
function isPythonCommentOrEmpty(line: string): boolean {
  return !line || line.startsWith("#");
}

/**
 * Parse a Python function definition from a line.
 * @param line - Source line to parse
 * @param filePath - Path to the source file
 * @param lineIndex - Zero-based line index
 * @returns API symbol for the function, or null if not a function
 */
function parsePythonFunction(line: string, filePath: string, lineIndex: number): APISymbol | null {
  const funcMatch = line.match(/^def\s+(\w+)\s*\((.*?)\)(?:\s*->\s*(.+?))?:/);
  if (!funcMatch) return null;

  const [, name, params, returnType] = funcMatch;
  return {
    name,
    type: "function",
    visibility: name.startsWith("_") ? "private" : "public",
    signature: line,
    location: { file: filePath, line: lineIndex + 1, column: 1 },
    parameters: parsePythonParameters(params),
    returnType: returnType?.trim(),
  };
}

/**
 * Parse Python function parameters from a parameter string.
 * @param params - Comma-separated parameter string
 * @returns Array of parameter objects with name and type
 */
function parsePythonParameters(params: string): Array<{ name: string; type: string }> {
  return params
    .split(",")
    .map((p) => {
      const paramParts = p.trim().split(":");
      return {
        name: paramParts[0]?.trim() || "param",
        type: paramParts[1]?.trim() || "Any",
      };
    })
    .filter((p) => p.name && p.name !== "param");
}

/**
 * Parse a Python class definition from a line.
 * @param line - Source line to parse
 * @param filePath - Path to the source file
 * @param lineIndex - Zero-based line index
 * @returns API symbol for the class, or null if not a class
 */
function parsePythonClass(line: string, filePath: string, lineIndex: number): APISymbol | null {
  const classMatch = line.match(/^class\s+(\w+)(?:\([^)]*\))?:/);
  if (!classMatch) return null;

  const [, name] = classMatch;
  return {
    name,
    type: "class",
    visibility: name.startsWith("_") ? "private" : "public",
    signature: line,
    location: { file: filePath, line: lineIndex + 1, column: 1 },
  };
}

/**
 * Get the installed Python version.
 * @returns Promise resolving to version string or "unknown"
 */
async function getPythonVersion(): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("python3", ["--version"], { stdio: "pipe" });
    let output = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", () => {
      const version = output.match(/Python\s+([\d.]+)/)?.[1] || "unknown";
      resolve(version);
    });

    child.on("error", () => {
      const child2 = spawn("python", ["--version"], { stdio: "pipe" });
      let output2 = "";

      child2.stdout.on("data", (data) => {
        output2 += data.toString();
      });

      child2.on("close", () => {
        const version = output2.match(/Python\s+([\d.]+)/)?.[1] || "unknown";
        resolve(version);
      });

      child2.on("error", () => {
        resolve("unknown");
      });
    });
  });
}

/**
 * Create an API surface object from extracted symbols.
 * @param symbols - Array of extracted API symbols
 * @returns Promise resolving to complete API surface object
 */
async function createSurface(symbols: APISymbol[]): Promise<APISurface> {
  return {
    language: "python",
    version: await getPythonVersion(),
    timestamp: Date.now(),
    symbols,
    statistics: calculateStatistics(symbols),
  };
}
