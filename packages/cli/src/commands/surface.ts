import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import chalk from "chalk";
import { glob } from "glob";
import type { CLIConfig } from "../types.js";
import { withStepProgress } from "../utils/progress.js";
import { resolveSmartNaming } from "../utils/smart-naming.js";
import {
  createOutputManager,
  type SurfaceOutput,
  shouldUseAgentMode,
} from "../utils/standardized-output.js";

export interface SurfaceOptions {
  /** Programming language to analyze */
  language: "typescript" | "python" | "rust" | "go" | "bash";
  /** Output file path */
  output?: string;
  /** Output directory for generated file */
  outputDir?: string;
  /** Project name for file naming */
  projectName?: string;
  /** Use generic names for backward compatibility */
  genericNames?: boolean;
  /** Compare against existing spec */
  diff?: boolean;
  /** Include private/internal APIs */
  includePrivate?: boolean;
  /** Verbose output */
  verbose?: boolean;
  /** Agent mode for NDJSON output */
  agentMode?: boolean;
  /** NDJSON output file */
  ndjsonOutput?: string;
}

export interface APISymbol {
  name: string;
  type: "function" | "class" | "interface" | "type" | "variable" | "constant";
  visibility: "public" | "private" | "internal";
  signature?: string;
  documentation?: string;
  location: {
    file: string;
    line: number;
    column: number;
  };
  parameters?: Array<{
    name: string;
    type: string;
    optional?: boolean;
    default?: string;
  }>;
  returnType?: string;
  genericParameters?: string[];
}

export interface APISurface {
  language: string;
  version: string;
  timestamp: number;
  symbols: APISymbol[];
  statistics: {
    totalSymbols: number;
    publicSymbols: number;
    privateSymbols: number;
    byType: Record<string, number>;
  };
}

/**
 * Surface command implementation
 * Extracts API surface from source code and generates surface.json for diff analysis
 */
export async function surfaceCommand(options: SurfaceOptions, _config: CLIConfig): Promise<number> {
  const agentMode = shouldUseAgentMode(options);
  const outputManager = createOutputManager("surface", agentMode, options.ndjsonOutput);

  // Define the steps for surface extraction
  const steps = [
    "Resolving project configuration",
    "Scanning source files",
    "Analyzing code structure",
    "Extracting API symbols",
    "Generating surface definition",
    "Writing output file",
  ];

  return withStepProgress(
    {
      title: `Extracting ${options.language} API surface`,
      steps,
      color: "blue",
    },
    async (progress) => {
      try {
        // Step 1: Resolve smart naming for output file
        progress.nextStep("Resolving project configuration");
        const namingResult = await resolveSmartNaming("surface", {
          output: options.output,
          outputDir: options.outputDir,
          projectName: options.projectName,
          useGenericNames: options.genericNames ?? false,
        });

        // Emit start event for agent mode
        outputManager.emitEvent({
          phase: "surface",
          status: "start",
          data: {
            language: options.language,
            outputFile: namingResult.filename,
            projectName: namingResult.context.name,
          },
        });

        if (!agentMode && namingResult.context.name) {
          console.log(chalk.dim(`   Project: ${namingResult.context.name}`));
          console.log(chalk.dim(`   Output: ${namingResult.filename}`));
        }

        // Step 2: Scan source files
        progress.nextStep("Scanning source files");
        const sourceFiles = await findSourceFiles(options.language);

        if (sourceFiles.length === 0) {
          progress.failCurrentStep(`No ${options.language} files found`);
          return 1;
        }

        // Step 3: Analyze code structure
        progress.nextStep(`Analyzing code structure (${sourceFiles.length} files)`);

        // Step 4: Extract API symbols
        progress.nextStep("Extracting API symbols");
        const surface = await extractAPISurface(options, sourceFiles);

        if (!surface) {
          progress.failCurrentStep("Failed to extract API surface");
          outputManager.emitEvent({
            phase: "surface",
            status: "error",
            error: "Failed to extract API surface",
          });
          return 1;
        }

        // Step 5: Generate surface definition and calculate delta if requested
        progress.nextStep("Generating surface definition");
        let delta;
        if (options.diff) {
          delta = await calculateSurfaceDelta(surface, namingResult.fullPath);
        }

        // Create standardized surface output
        const surfaceOutput: SurfaceOutput = {
          apiVersion: "arbiter.dev/v2",
          timestamp: Date.now(),
          command: "surface",
          kind: "Surface",
          language: options.language,
          surface: {
            symbols: surface.symbols.map((s) => ({
              name: s.name,
              type: s.type,
              visibility: s.visibility,
              signature: s.signature,
              location: s.location,
            })),
            statistics: surface.statistics,
          },
          delta,
        };

        // Step 6: Write output file
        progress.nextStep("Writing output file");
        await outputManager.writeSurfaceFile(surfaceOutput, namingResult.fullPath);

        if (!agentMode) {
          console.log(chalk.cyan("\nStatistics:"));
          console.log(`  Total symbols: ${surface.statistics.totalSymbols}`);
          console.log(`  Public symbols: ${surface.statistics.publicSymbols}`);
          console.log(`  Private symbols: ${surface.statistics.privateSymbols}`);

          // Show breakdown by type
          for (const [type, count] of Object.entries(surface.statistics.byType)) {
            console.log(`  ${type}: ${count}`);
          }

          if (delta) {
            console.log(chalk.yellow(`\n⚠️  API changes detected:`));
            if (delta.added > 0) {
              console.log(chalk.green(`  + ${delta.added} added symbols`));
            }
            if (delta.removed > 0) {
              console.log(chalk.red(`  - ${delta.removed} removed symbols`));
            }
            if (delta.breaking) {
              console.log(
                chalk.red(
                  `  🚨 Breaking changes detected - ${delta.requiredBump} bump recommended`,
                ),
              );
            }
          }
        }

        // Emit completion event
        outputManager.emitEvent({
          phase: "surface",
          status: "complete",
          data: {
            symbols: surface.statistics.totalSymbols,
            delta,
          },
        });

        outputManager.close();
        return 0;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        if (!agentMode) {
          console.error(chalk.red("❌ Surface command failed:"), errorMessage);
        }

        outputManager.emitEvent({
          phase: "surface",
          status: "error",
          error: errorMessage,
        });

        outputManager.close();
        return 1;
      }
    },
  );
}

/**
 * Find source files for the specified language
 */
async function findSourceFiles(language: string): Promise<string[]> {
  const patterns: Record<string, string[]> = {
    typescript: ["**/*.ts", "**/*.tsx"],
    python: ["**/*.py"],
    rust: ["**/*.rs"],
    go: ["**/*.go"],
    bash: ["**/*.sh", "**/*.bash"],
  };

  const ignorePatterns = [
    "node_modules/**",
    "dist/**",
    "build/**",
    "target/**",
    "**/*.test.*",
    "**/*.spec.*",
    "**/*_test.*",
    "**/__tests__/**",
    "**/.git/**",
  ];

  const files = await glob(patterns[language] || [], {
    ignore: ignorePatterns,
  });

  return files;
}

/**
 * Extract API surface based on language
 */
async function extractAPISurface(
  options: SurfaceOptions,
  sourceFiles: string[],
): Promise<APISurface | null> {
  switch (options.language) {
    case "typescript":
      return extractTypeScriptSurface(options, sourceFiles);
    case "python":
      return extractPythonSurface(options, sourceFiles);
    case "rust":
      return extractRustSurface(options, sourceFiles);
    case "go":
      return extractGoSurface(options, sourceFiles);
    case "bash":
      return extractBashSurface(options, sourceFiles);
    default:
      throw new Error(`Unsupported language: ${options.language}`);
  }
}

/**
 * Extract TypeScript API surface using tsc
 */
async function extractTypeScriptSurface(
  options: SurfaceOptions,
  sourceFiles: string[],
): Promise<APISurface | null> {
  try {
    if (sourceFiles.length === 0) {
      console.log(chalk.yellow("No TypeScript files found"));
      return null;
    }

    const symbols: APISymbol[] = [];

    // Use TypeScript compiler API to extract declarations
    // For now, implement a simple parser for demonstration
    for (const file of sourceFiles) {
      const content = await readFile(file, "utf-8");
      const fileSymbols = await parseTypeScriptFile(file, content, options);
      symbols.push(...fileSymbols);
    }

    const surface: APISurface = {
      language: "typescript",
      version: await getTypeScriptVersion(),
      timestamp: Date.now(),
      symbols,
      statistics: calculateStatistics(symbols),
    };

    return surface;
  } catch (error) {
    console.error(chalk.red("TypeScript surface extraction failed:"), error);
    return null;
  }
}

/**
 * Simple TypeScript parser for basic API extraction
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

    // Skip comments and empty lines
    if (trimmedLine.startsWith("//") || trimmedLine.startsWith("/*") || !trimmedLine) {
      continue;
    }

    // Extract exports (functions, classes, interfaces, types)
    const exportMatch = trimmedLine.match(/^export\s+(async\s+)?(\w+)\s+(\w+)/);
    if (exportMatch) {
      const [, asyncKeyword, type, name] = exportMatch;
      const _isAsync = !!asyncKeyword;

      let symbolType: APISymbol["type"] = "variable";
      if (["function", "class", "interface", "type"].includes(type)) {
        symbolType = type as APISymbol["type"];
      }

      const symbol: APISymbol = {
        name,
        type: symbolType,
        visibility: "public",
        signature: trimmedLine,
        location: {
          file: filePath,
          line: lineIndex + 1,
          column: line.indexOf(name) + 1,
        },
      };

      // Extract function signature
      if (symbolType === "function") {
        const funcMatch = line.match(/function\s+\w+\s*\([^)]*\)(?:\s*:\s*[^{]+)?/);
        if (funcMatch) {
          symbol.signature = funcMatch[0];
        }
      }

      symbols.push(symbol);
    }

    // Extract class methods and properties
    const methodMatch = trimmedLine.match(
      /^\s*(public|private|protected)?\s*(static\s+)?(async\s+)?(\w+)\s*\(/,
    );
    if (methodMatch) {
      const [, visibility, _staticKeyword, _asyncKeyword, name] = methodMatch;

      const symbol: APISymbol = {
        name,
        type: "function",
        visibility: (visibility as APISymbol["visibility"]) || "public",
        signature: trimmedLine,
        location: {
          file: filePath,
          line: lineIndex + 1,
          column: line.indexOf(name) + 1,
        },
      };

      symbols.push(symbol);
    }
  }

  // Filter private symbols if not requested
  if (!options.includePrivate) {
    return symbols.filter((s) => s.visibility === "public");
  }

  return symbols;
}

/**
 * Get TypeScript version
 */
async function getTypeScriptVersion(): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("tsc", ["--version"], { stdio: "pipe" });
    let output = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", () => {
      const version = output.match(/Version\s+([\d.]+)/)?.[1] || "unknown";
      resolve(version);
    });

    child.on("error", () => {
      resolve("unknown");
    });
  });
}

/**
 * Command interface for Python extraction strategies
 */
interface PythonExtractionCommand {
  readonly name: string;
  readonly description: string;
  execute(options: SurfaceOptions): Promise<APISurface | null>;
  canExecute(): Promise<boolean>;
}

/**
 * Pyright stub generation command
 */
class PyrightExtractionCommand implements PythonExtractionCommand {
  readonly name = "pyright";
  readonly description = "pyright stub generation";

  async canExecute(): Promise<boolean> {
    return await this.checkPythonProject();
  }

  async execute(options: SurfaceOptions): Promise<APISurface | null> {
    return await extractPythonWithPyright(options);
  }

  private async checkPythonProject(): Promise<boolean> {
    const results = await Promise.all([
      glob("pyproject.toml"),
      glob("setup.py"),
      glob("**/*.py", { ignore: ["__pycache__/**", "node_modules/**"] })
    ]);
    return results.some((files) => files.length > 0);
  }
}

/**
 * Stubgen extraction command
 */
class StubgenExtractionCommand implements PythonExtractionCommand {
  readonly name = "stubgen";
  readonly description = "stubgen";

  async canExecute(): Promise<boolean> {
    return await this.checkPythonProject();
  }

  async execute(options: SurfaceOptions): Promise<APISurface | null> {
    return await extractPythonWithStubgen(options);
  }

  private async checkPythonProject(): Promise<boolean> {
    const results = await Promise.all([
      glob("pyproject.toml"),
      glob("setup.py"),
      glob("**/*.py", { ignore: ["__pycache__/**", "node_modules/**"] })
    ]);
    return results.some((files) => files.length > 0);
  }
}

/**
 * AST parsing extraction command
 */
class AstParsingExtractionCommand implements PythonExtractionCommand {
  readonly name = "ast-parsing";
  readonly description = "basic AST parsing";

  async canExecute(): Promise<boolean> {
    const pythonFiles = await glob("**/*.py", { ignore: ["__pycache__/**", "node_modules/**"] });
    return pythonFiles.length > 0;
  }

  async execute(options: SurfaceOptions): Promise<APISurface | null> {
    return await extractPythonWithAstParsing(options);
  }
}

/**
 * Python surface extraction invoker using Command pattern
 */
class PythonExtractionInvoker {
  private commands: PythonExtractionCommand[] = [
    new PyrightExtractionCommand(),
    new StubgenExtractionCommand(),
    new AstParsingExtractionCommand()
  ];

  /**
   * Execute Python extraction commands in sequence
   */
  async executeExtraction(options: SurfaceOptions): Promise<APISurface | null> {
    // Quick validation
    const hasValidCommands = await this.validateCommands();
    if (!hasValidCommands) {
      console.log(chalk.yellow("No Python project files found"));
      return null;
    }

    console.log(chalk.dim("Attempting Python surface extraction..."));

    // Execute commands in order until one succeeds
    for (let i = 0; i < this.commands.length; i++) {
      const command = this.commands[i];
      
      try {
        console.log(chalk.dim(`Strategy ${i + 1}: Attempting ${command.description}...`));
        
        const canExecute = await command.canExecute();
        if (!canExecute) {
          console.log(chalk.dim(`${command.name} cannot execute for this project`));
          continue;
        }

        const result = await command.execute(options);
        if (result) {
          console.log(chalk.green(`✅ Successfully extracted using ${command.name}`));
          return result;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(chalk.dim(`${command.name} failed: ${errorMsg}`));
      }
    }

    console.log(chalk.red("❌ All Python extraction strategies failed"));
    return null;
  }

  /**
   * Validate if any commands can execute
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
 * Extract Python API surface using pyright/stubgen strategies
 * Implements TODO.md section 5 strategy: pyright --createstub or stubgen → stubs → JSON
 */
async function _extractPythonSurface(options: SurfaceOptions): Promise<APISurface | null> {
  try {
    const invoker = new PythonExtractionInvoker();
    return await invoker.executeExtraction(options);
  } catch (error) {
    console.error(chalk.red("Python surface extraction failed:"), error);
    return null;
  }
}

/**
 * Rust surface extraction strategy interface
 */
interface RustExtractionStrategy {
  readonly name: string;
  readonly description: string;
  canHandle(options: SurfaceOptions): Promise<boolean>;
  extract(options: SurfaceOptions): Promise<APISurface | null>;
}

/**
 * Cargo public-api extraction strategy
 */
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

/**
 * Rustdoc JSON extraction strategy
 */
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

/**
 * Syn parsing extraction strategy
 */
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

/**
 * Rust surface extraction orchestrator with strategy pattern
 */
class RustSurfaceExtractor {
  private strategies: RustExtractionStrategy[] = [
    new CargoPublicApiStrategy(),
    new RustdocJsonStrategy(), 
    new SynParseStrategy()
  ];

  /**
   * Extract Rust API surface using fallback strategies
   */
  async extractSurface(options: SurfaceOptions): Promise<APISurface | null> {
    // Quick project validation
    const projectValid = await this.validateRustProject();
    if (!projectValid) {
      console.log(chalk.yellow("No Rust project found"));
      return null;
    }

    console.log(chalk.dim("Attempting Rust surface extraction..."));

    // Try each strategy in order
    for (let i = 0; i < this.strategies.length; i++) {
      const strategy = this.strategies[i];
      
      try {
        console.log(chalk.dim(`Strategy ${i + 1}: ${strategy.description}...`));
        
        const canHandle = await strategy.canHandle(options);
        if (!canHandle) {
          console.log(chalk.dim(`Strategy ${strategy.name} cannot handle this project`));
          continue;
        }

        const result = await strategy.extract(options);
        if (result) {
          console.log(chalk.green(`✅ Successfully extracted using ${strategy.name}`));
          return result;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.log(chalk.dim(`${strategy.name} failed: ${errorMsg}`));
      }
    }

    console.log(chalk.red("❌ All Rust extraction strategies failed"));
    return null;
  }

  /**
   * Validate if this is a Rust project
   */
  private async validateRustProject(): Promise<boolean> {
    const cargoTomlExists = await glob("Cargo.toml").then((files) => files.length > 0);
    const rustFilesExist = await glob("src/**/*.rs").then((files) => files.length > 0);
    return cargoTomlExists || rustFilesExist;
  }
}

/**
 * Extract Rust API surface using multiple strategies with graceful fallback
 * Implements TODO.md section 5 strategy: cargo public-api → rustdoc JSON → syn parse
 */
async function _extractRustSurface(options: SurfaceOptions): Promise<APISurface | null> {
  try {
    const extractor = new RustSurfaceExtractor();
    return await extractor.extractSurface(options);
  } catch (error) {
    console.error(chalk.red("Rust surface extraction failed:"), error);
    return null;
  }
}

/**
 * Extract Go API surface using go list and go doc
 * Implements TODO.md section 5 strategy: go list -json ./... + go doc -all → exported identifiers
 */
async function _extractGoSurface(options: SurfaceOptions): Promise<APISurface | null> {
  try {
    // Check if this is a Go project
    const goModExists = await glob("go.mod").then((files) => files.length > 0);
    if (!goModExists) {
      console.log(chalk.yellow("No go.mod found - not a Go project"));
      return null;
    }

    console.log(chalk.dim("Attempting Go surface extraction..."));

    // Strategy 1: Use go list + go doc combination
    try {
      console.log(chalk.dim("Strategy 1: Using go list + go doc..."));
      const goSurface = await extractGoWithGoTools(options);
      if (goSurface) {
        console.log(chalk.green("✅ Successfully extracted using go tools"));
        return goSurface;
      }
    } catch (error) {
      console.log(
        chalk.dim(`go tools failed: ${error instanceof Error ? error.message : String(error)}`),
      );
    }

    // Strategy 2: Fall back to basic parsing
    try {
      console.log(chalk.dim("Strategy 2: Attempting basic Go parsing..."));
      const basicSurface = await extractGoWithBasicParsing(options);
      if (basicSurface) {
        console.log(chalk.green("✅ Successfully extracted using basic parsing"));
        return basicSurface;
      }
    } catch (error) {
      console.log(
        chalk.dim(
          `basic parsing failed: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }

    console.log(chalk.red("❌ All Go extraction strategies failed"));
    return null;
  } catch (error) {
    console.error(chalk.red("Go surface extraction failed:"), error);
    return null;
  }
}

/**
 * Extract Bash API surface using --help trees and function parsing
 * Implements TODO.md section 5 strategy: parse --help trees, function names, expected exits
 */
async function _extractBashSurface(options: SurfaceOptions): Promise<APISurface | null> {
  try {
    // Find shell scripts
    const shellFiles = await glob("**/*.{sh,bash}", {
      ignore: ["node_modules/**", ".git/**", "**/test-fixtures*/**"],
    });

    // Also look for executable scripts without extension
    const executableFiles = await glob("**/bin/*", {
      ignore: ["node_modules/**", ".git/**"],
    });

    const allFiles = [...shellFiles, ...executableFiles];

    if (allFiles.length === 0) {
      console.log(chalk.yellow("No shell scripts found"));
      return null;
    }

    console.log(chalk.dim(`Found ${allFiles.length} shell script(s)`));

    const symbols: APISymbol[] = [];

    // Parse each shell script
    for (const file of allFiles) {
      try {
        const content = await readFile(file, "utf-8");
        const fileSymbols = await parseBashFile(file, content, options);
        symbols.push(...fileSymbols);
      } catch (error) {
        console.log(chalk.dim(`Failed to parse ${file}: ${error}`));
      }
    }

    const surface: APISurface = {
      language: "bash",
      version: await getBashVersion(),
      timestamp: Date.now(),
      symbols,
      statistics: calculateStatistics(symbols),
    };

    console.log(chalk.green(`✅ Extracted ${symbols.length} bash symbols`));
    return surface;
  } catch (error) {
    console.error(chalk.red("Bash surface extraction failed:"), error);
    return null;
  }
}

/**
 * Calculate statistics for API surface
 */
function calculateStatistics(symbols: APISymbol[]): APISurface["statistics"] {
  const byType: Record<string, number> = {};
  let publicCount = 0;
  let privateCount = 0;

  for (const symbol of symbols) {
    byType[symbol.type] = (byType[symbol.type] || 0) + 1;

    if (symbol.visibility === "public") {
      publicCount++;
    } else {
      privateCount++;
    }
  }

  return {
    totalSymbols: symbols.length,
    publicSymbols: publicCount,
    privateSymbols: privateCount,
    byType,
  };
}

/**
 * Calculate surface delta for standardized output
 */
async function _calculateSurfaceDelta(
  surface: APISurface,
  outputPath: string,
): Promise<SurfaceOutput["delta"] | undefined> {
  try {
    // Try to read existing surface
    const existingContent = await readFile(outputPath, "utf-8").catch(() => null);

    if (!existingContent) {
      return undefined; // No baseline to compare against
    }

    // Parse existing surface - handle both old format and new standardized format
    let existingSurface: APISurface;
    try {
      const parsed = JSON.parse(existingContent);
      if (parsed.kind === "Surface" && parsed.surface) {
        // New standardized format
        existingSurface = {
          language: parsed.language,
          version: parsed.surface.version || "unknown",
          timestamp: parsed.timestamp,
          symbols: parsed.surface.symbols,
          statistics: parsed.surface.statistics,
        };
      } else {
        // Old format
        existingSurface = parsed;
      }
    } catch (_error) {
      return undefined; // Invalid existing surface
    }

    // Calculate changes
    const added = surface.symbols.filter(
      (s) => !existingSurface.symbols.some((es) => es.name === s.name && es.type === s.type),
    );

    const removed = existingSurface.symbols.filter(
      (s) => !surface.symbols.some((ns) => ns.name === s.name && ns.type === s.type),
    );

    const modified = surface.symbols.filter((s) => {
      const existing = existingSurface.symbols.find(
        (es) => es.name === s.name && es.type === s.type,
      );
      return existing && existing.signature !== s.signature;
    });

    // Determine if changes are breaking
    const breaking =
      removed.length > 0 ||
      modified.some((s) => {
        // Consider visibility changes breaking
        const existing = existingSurface.symbols.find(
          (es) => es.name === s.name && es.type === s.type,
        );
        return (
          existing &&
          ((existing.visibility === "public" && s.visibility !== "public") ||
            existing.returnType !== s.returnType)
        );
      });

    // Determine required bump
    let requiredBump: "MAJOR" | "MINOR" | "PATCH" = "PATCH";
    if (breaking || removed.length > 0) {
      requiredBump = "MAJOR";
    } else if (added.length > 0) {
      requiredBump = "MINOR";
    }

    return {
      added: added.length,
      modified: modified.length,
      removed: removed.length,
      breaking,
      requiredBump,
    };
  } catch (_error) {
    return undefined; // Error calculating delta
  }
}

// ============================================================================
// RUST EXTRACTION STRATEGIES
// ============================================================================

/**
 * Extract Rust API surface using cargo public-api
 */
async function extractRustWithPublicApi(_options: SurfaceOptions): Promise<APISurface | null> {
  return new Promise((resolve) => {
    const child = spawn("cargo", ["public-api", "--format", "json"], { stdio: "pipe" });
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
        throw new Error(`cargo public-api failed: ${errorOutput}`);
      }

      try {
        const apiData = JSON.parse(output);
        const symbols: APISymbol[] = [];

        // Parse cargo public-api JSON format
        for (const item of apiData.items || []) {
          const symbol: APISymbol = {
            name: item.name || "unnamed",
            type: mapRustItemType(item.kind),
            visibility: "public", // cargo public-api only shows public items
            signature: item.signature || item.name,
            location: {
              file: item.file_path || "unknown",
              line: item.line || 1,
              column: item.column || 1,
            },
            documentation: item.docs,
          };

          if (item.kind === "function") {
            symbol.parameters = item.inputs?.map((input: any) => ({
              name: input.name || "param",
              type: input.ty || "unknown",
            }));
            symbol.returnType = item.output?.ty;
          }

          symbols.push(symbol);
        }

        const surface: APISurface = {
          language: "rust",
          version: await getRustVersion(),
          timestamp: Date.now(),
          symbols,
          statistics: calculateStatistics(symbols),
        };

        resolve(surface);
      } catch (error) {
        throw new Error(`Failed to parse cargo public-api output: ${error}`);
      }
    });

    child.on("error", (error) => {
      throw new Error(`cargo public-api command failed: ${error.message}`);
    });
  });
}

/**
 * Extract Rust API surface using rustdoc JSON
 */
async function extractRustWithRustdocJson(_options: SurfaceOptions): Promise<APISurface | null> {
  return new Promise((resolve) => {
    const child = spawn("cargo", ["doc", "--no-deps", "--output-format", "json"], {
      stdio: "pipe",
    });
    let _output = "";
    let errorOutput = "";

    child.stdout.on("data", (data) => {
      _output += data.toString();
    });

    child.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    child.on("close", async (code) => {
      if (code !== 0) {
        throw new Error(`cargo doc failed: ${errorOutput}`);
      }

      try {
        // Look for generated JSON files in target/doc/
        const docFiles = await glob("target/doc/*.json");
        if (docFiles.length === 0) {
          throw new Error("No rustdoc JSON files found");
        }

        const symbols: APISymbol[] = [];

        for (const docFile of docFiles) {
          const docContent = await readFile(docFile, "utf-8");
          const docData = JSON.parse(docContent);

          // Parse rustdoc JSON format
          if (docData.index) {
            for (const [_id, item] of Object.entries(docData.index)) {
              const itemData = item as any;
              if (itemData.visibility === "public") {
                const symbol: APISymbol = {
                  name: itemData.name || "unnamed",
                  type: mapRustItemType(itemData.kind),
                  visibility: "public",
                  signature: itemData.signature || itemData.name,
                  location: {
                    file: itemData.span?.filename || "unknown",
                    line: itemData.span?.begin?.[0] || 1,
                    column: itemData.span?.begin?.[1] || 1,
                  },
                  documentation: itemData.docs,
                };

                symbols.push(symbol);
              }
            }
          }
        }

        const surface: APISurface = {
          language: "rust",
          version: await getRustVersion(),
          timestamp: Date.now(),
          symbols,
          statistics: calculateStatistics(symbols),
        };

        resolve(surface);
      } catch (error) {
        throw new Error(`Failed to parse rustdoc JSON: ${error}`);
      }
    });

    child.on("error", (error) => {
      throw new Error(`cargo doc command failed: ${error.message}`);
    });
  });
}

/**
 * Extract Rust API surface using basic syn-like parsing
 */
async function extractRustWithSynParse(options: SurfaceOptions): Promise<APISurface | null> {
  // Find Rust source files
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
 * Parse Rust file for basic API extraction
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

    // Skip comments and empty lines
    if (trimmedLine.startsWith("//") || trimmedLine.startsWith("/*") || !trimmedLine) {
      continue;
    }

    // Extract public items
    const pubMatch = trimmedLine.match(
      /^pub\s+(fn|struct|enum|trait|mod|const|static|type)\s+(\w+)/,
    );
    if (pubMatch) {
      const [, itemType, name] = pubMatch;

      const symbol: APISymbol = {
        name,
        type: mapRustItemType(itemType),
        visibility: "public",
        signature: trimmedLine,
        location: {
          file: filePath,
          line: lineIndex + 1,
          column: line.indexOf(name) + 1,
        },
      };

      // Extract function signature details
      if (itemType === "fn") {
        const funcMatch = line.match(/fn\s+\w+\s*\([^)]*\)(?:\s*->\s*[^{]+)?/);
        if (funcMatch) {
          symbol.signature = funcMatch[0];
        }
      }

      symbols.push(symbol);
    }
  }

  return options.includePrivate ? symbols : symbols.filter((s) => s.visibility === "public");
}

/**
 * Map Rust item types to our standard types
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
      return "variable"; // modules as variables for now
    default:
      return "variable";
  }
}

/**
 * Get Rust version
 */
async function getRustVersion(): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("rustc", ["--version"], { stdio: "pipe" });
    let output = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", () => {
      const version = output.match(/rustc\s+([\d.]+)/)?.[1] || "unknown";
      resolve(version);
    });

    child.on("error", () => {
      resolve("unknown");
    });
  });
}

// ============================================================================
// PYTHON EXTRACTION STRATEGIES
// ============================================================================

/**
 * Extract Python API surface using pyright stub generation
 */
async function extractPythonWithPyright(options: SurfaceOptions): Promise<APISurface | null> {
  return new Promise((resolve) => {
    const child = spawn("pyright", ["--createstub", "."], { stdio: "pipe" });
    let _output = "";
    let errorOutput = "";

    child.stdout.on("data", (data) => {
      _output += data.toString();
    });

    child.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    child.on("close", async (code) => {
      if (code !== 0) {
        throw new Error(`pyright failed: ${errorOutput}`);
      }

      try {
        // Look for generated stub files
        const stubFiles = await glob("**/*.pyi", {
          ignore: ["node_modules/**", "__pycache__/**"],
        });

        const symbols: APISymbol[] = [];

        for (const stubFile of stubFiles) {
          const content = await readFile(stubFile, "utf-8");
          const fileSymbols = await parsePythonStubFile(stubFile, content, options);
          symbols.push(...fileSymbols);
        }

        const surface: APISurface = {
          language: "python",
          version: await getPythonVersion(),
          timestamp: Date.now(),
          symbols,
          statistics: calculateStatistics(symbols),
        };

        resolve(surface);
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
 * Extract Python API surface using stubgen
 */
async function extractPythonWithStubgen(options: SurfaceOptions): Promise<APISurface | null> {
  return new Promise((resolve) => {
    const child = spawn("stubgen", ["-o", "stubs", "."], { stdio: "pipe" });
    let _output = "";
    let errorOutput = "";

    child.stdout.on("data", (data) => {
      _output += data.toString();
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

        const surface: APISurface = {
          language: "python",
          version: await getPythonVersion(),
          timestamp: Date.now(),
          symbols,
          statistics: calculateStatistics(symbols),
        };

        resolve(surface);
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
 * Extract Python API surface using basic AST parsing
 */
async function extractPythonWithAstParsing(options: SurfaceOptions): Promise<APISurface | null> {
  const files = await glob("**/*.py", {
    ignore: ["node_modules/**", "__pycache__/**", "**/*.pyc", "**/test_*.py", "**/*_test.py"],
  });

  if (files.length === 0) {
    throw new Error("No Python files found");
  }

  const symbols: APISymbol[] = [];

  for (const file of files) {
    const content = await readFile(file, "utf-8");
    const fileSymbols = await parsePythonFile(file, content, options);
    symbols.push(...fileSymbols);
  }

  return {
    language: "python",
    version: await getPythonVersion(),
    timestamp: Date.now(),
    symbols,
    statistics: calculateStatistics(symbols),
  };
}

/**
 * Parse Python stub file (.pyi)
 */
async function parsePythonStubFile(
  filePath: string,
  content: string,
  options: SurfaceOptions,
): Promise<APISymbol[]> {
  const symbols: APISymbol[] = [];
  const lines = content.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    // Function definitions
    const funcMatch = trimmedLine.match(/^def\s+(\w+)\s*\((.*?)\)(?:\s*->\s*(.+?))?:/);
    if (funcMatch) {
      const [, name, params, returnType] = funcMatch;

      symbols.push({
        name,
        type: "function",
        visibility: name.startsWith("_") ? "private" : "public",
        signature: trimmedLine,
        location: { file: filePath, line: lineIndex + 1, column: 1 },
        parameters: params
          .split(",")
          .map((p) => ({
            name: p.trim().split(":")[0].trim(),
            type: p.trim().split(":")[1]?.trim() || "Any",
          }))
          .filter((p) => p.name),
        returnType: returnType?.trim(),
      });
      continue;
    }

    // Class definitions
    const classMatch = trimmedLine.match(/^class\s+(\w+)(?:\([^)]*\))?:/);
    if (classMatch) {
      const [, name] = classMatch;

      symbols.push({
        name,
        type: "class",
        visibility: name.startsWith("_") ? "private" : "public",
        signature: trimmedLine,
        location: { file: filePath, line: lineIndex + 1, column: 1 },
      });
      continue;
    }

    // Variable assignments
    const varMatch = trimmedLine.match(/^(\w+):\s*(.+?)(?:\s*=|$)/);
    if (varMatch) {
      const [, name, typeAnnotation] = varMatch;

      symbols.push({
        name,
        type: "variable",
        visibility: name.startsWith("_") ? "private" : "public",
        signature: trimmedLine,
        location: { file: filePath, line: lineIndex + 1, column: 1 },
        returnType: typeAnnotation?.trim(),
      });
    }
  }

  return options.includePrivate ? symbols : symbols.filter((s) => s.visibility === "public");
}

/**
 * Parse regular Python file
 */
async function parsePythonFile(
  filePath: string,
  content: string,
  options: SurfaceOptions,
): Promise<APISymbol[]> {
  const symbols: APISymbol[] = [];
  const lines = content.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    // Function definitions with type hints
    const funcMatch = trimmedLine.match(/^def\s+(\w+)\s*\((.*?)\)(?:\s*->\s*(.+?))?:/);
    if (funcMatch) {
      const [, name, params, returnType] = funcMatch;

      symbols.push({
        name,
        type: "function",
        visibility: name.startsWith("_") ? "private" : "public",
        signature: trimmedLine,
        location: { file: filePath, line: lineIndex + 1, column: 1 },
        parameters: params
          .split(",")
          .map((p) => {
            const paramParts = p.trim().split(":");
            return {
              name: paramParts[0]?.trim() || "param",
              type: paramParts[1]?.trim() || "Any",
            };
          })
          .filter((p) => p.name && p.name !== "param"),
        returnType: returnType?.trim(),
      });
    }

    // Class definitions
    const classMatch = trimmedLine.match(/^class\s+(\w+)(?:\([^)]*\))?:/);
    if (classMatch) {
      const [, name] = classMatch;

      symbols.push({
        name,
        type: "class",
        visibility: name.startsWith("_") ? "private" : "public",
        signature: trimmedLine,
        location: { file: filePath, line: lineIndex + 1, column: 1 },
      });
    }
  }

  return options.includePrivate ? symbols : symbols.filter((s) => s.visibility === "public");
}

/**
 * Get Python version
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
      // Try python instead of python3
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

// ============================================================================
// GO EXTRACTION STRATEGIES
// ============================================================================

/**
 * Extract Go API surface using go list and go doc
 */
async function extractGoWithGoTools(_options: SurfaceOptions): Promise<APISurface | null> {
  return new Promise((resolve) => {
    const child = spawn("go", ["list", "-json", "./..."], { stdio: "pipe" });
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
        throw new Error(`go list failed: ${errorOutput}`);
      }

      try {
        const symbols: APISymbol[] = [];

        // Parse go list JSON output
        const lines = output.trim().split("\n");

        for (const line of lines) {
          if (!line.trim()) continue;

          const packageInfo = JSON.parse(line);

          // Skip test packages
          if (packageInfo.Name?.endsWith("_test")) continue;

          // Get package documentation
          try {
            const docSymbols = await getGoPackageSymbols(packageInfo.ImportPath);
            symbols.push(...docSymbols);
          } catch (error) {
            console.log(chalk.dim(`Failed to get docs for ${packageInfo.ImportPath}: ${error}`));
          }
        }

        const surface: APISurface = {
          language: "go",
          version: await getGoVersion(),
          timestamp: Date.now(),
          symbols,
          statistics: calculateStatistics(symbols),
        };

        resolve(surface);
      } catch (error) {
        throw new Error(`Failed to parse go list output: ${error}`);
      }
    });

    child.on("error", (error) => {
      throw new Error(`go list command failed: ${error.message}`);
    });
  });
}

/**
 * Get symbols for a Go package using go doc
 */
async function getGoPackageSymbols(packagePath: string): Promise<APISymbol[]> {
  return new Promise((resolve) => {
    const child = spawn("go", ["doc", "-all", packagePath], { stdio: "pipe" });
    let output = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", () => {
      const symbols = parseGoDocOutput(output, packagePath);
      resolve(symbols);
    });

    child.on("error", () => {
      resolve([]); // Return empty array on error
    });
  });
}

/**
 * Go doc output parser with extracted methods for reduced complexity
 */
class GoDocParser {
  private packagePath: string;

  constructor(packagePath: string) {
    this.packagePath = packagePath;
  }

  /**
   * Parse go doc output to extract symbols
   */
  parseDocOutput(docOutput: string): APISymbol[] {
    const symbols: APISymbol[] = [];
    const lines = docOutput.split("\n");

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Use specialized parsers for each symbol type
      const functionSymbol = this.parseFunctionLine(trimmedLine);
      if (functionSymbol) {
        symbols.push(functionSymbol);
        continue;
      }

      const typeSymbol = this.parseTypeLine(trimmedLine);
      if (typeSymbol) {
        symbols.push(typeSymbol);
        continue;
      }

      const variableSymbol = this.parseVariableLine(trimmedLine);
      if (variableSymbol) {
        symbols.push(variableSymbol);
      }
    }

    return symbols;
  }

  /**
   * Parse function definition lines
   */
  private parseFunctionLine(line: string): APISymbol | null {
    const funcMatch = line.match(/^func\s+(\w+)\s*\((.*?)\)(?:\s*\((.*?)\))?(?:\s+(.+))?/);
    if (!funcMatch) return null;

    const [, name, params, returns, returnType] = funcMatch;

    // Only include exported (uppercase) functions
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

  /**
   * Parse type definition lines
   */
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

  /**
   * Parse variable and constant definition lines
   */
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

  /**
   * Parse function parameters
   */
  private parseParameters(params: string): APISymbol["parameters"] {
    if (!params) return [];

    return params
      .split(",")
      .map((p) => {
        const parts = p.trim().split(" ");
        return {
          name: parts[0] || "param",
          type: parts.slice(1).join(" ") || "interface{}",
        };
      })
      .filter((p) => p.name !== "param");
  }

  /**
   * Check if a symbol is exported (starts with uppercase)
   */
  private isExported(name: string): boolean {
    return name[0] === name[0].toUpperCase();
  }

  /**
   * Map Go type kinds to symbol types
   */
  private mapGoTypeToSymbolType(typeKind: string): APISymbol["type"] {
    if (typeKind.startsWith("struct")) return "class";
    if (typeKind.startsWith("interface")) return "interface";
    return "type";
  }

  /**
   * Create location object
   */
  private createLocation() {
    return { file: this.packagePath, line: 1, column: 1 };
  }
}

/**
 * Parse go doc output to extract symbols
 */
function parseGoDocOutput(docOutput: string, packagePath: string): APISymbol[] {
  const parser = new GoDocParser(packagePath);
  return parser.parseDocOutput(docOutput);
}

/**
 * Extract Go API surface using basic parsing
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

  return {
    language: "go",
    version: await getGoVersion(),
    timestamp: Date.now(),
    symbols,
    statistics: calculateStatistics(symbols),
  };
}

/**
 * Parse Go file for basic API extraction
 */
async function parseGoFile(
  filePath: string,
  content: string,
  options: SurfaceOptions,
): Promise<APISymbol[]> {
  const symbols: APISymbol[] = [];
  const lines = content.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("//")) continue;

    // Function definitions
    const funcMatch = trimmedLine.match(
      /^func\s+(\w+)\s*\((.*?)\)(?:\s*\((.*?)\))?(?:\s+(.+?))?(?:\s*{|$)/,
    );
    if (funcMatch) {
      const [, name, params, returns, returnType] = funcMatch;

      // Only exported functions (start with uppercase)
      if (name[0] === name[0].toUpperCase()) {
        symbols.push({
          name,
          type: "function",
          visibility: "public",
          signature: trimmedLine,
          location: { file: filePath, line: lineIndex + 1, column: 1 },
          parameters: params
            ? params
                .split(",")
                .map((p) => {
                  const parts = p.trim().split(" ");
                  return {
                    name: parts[0] || "param",
                    type: parts.slice(1).join(" ") || "interface{}",
                  };
                })
                .filter((p) => p.name && p.name !== "param")
            : [],
          returnType: returnType || returns,
        });
      }
    }

    // Type definitions
    const typeMatch = trimmedLine.match(/^type\s+(\w+)\s+(struct|interface|.+)/);
    if (typeMatch) {
      const [, name, typeKind] = typeMatch;

      if (name[0] === name[0].toUpperCase()) {
        symbols.push({
          name,
          type: typeKind.startsWith("struct")
            ? "class"
            : typeKind.startsWith("interface")
              ? "interface"
              : "type",
          visibility: "public",
          signature: trimmedLine,
          location: { file: filePath, line: lineIndex + 1, column: 1 },
        });
      }
    }
  }

  return options.includePrivate ? symbols : symbols.filter((s) => s.visibility === "public");
}

/**
 * Get Go version
 */
async function getGoVersion(): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("go", ["version"], { stdio: "pipe" });
    let output = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", () => {
      const version = output.match(/go version go([\d.]+)/)?.[1] || "unknown";
      resolve(version);
    });

    child.on("error", () => {
      resolve("unknown");
    });
  });
}

// ============================================================================
// BASH EXTRACTION STRATEGIES
// ============================================================================

/**
 * Parse Bash file for API extraction
 */
async function parseBashFile(
  filePath: string,
  content: string,
  options: SurfaceOptions,
): Promise<APISymbol[]> {
  const symbols: APISymbol[] = [];
  const lines = content.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) continue;

    // Function definitions
    const funcMatch =
      trimmedLine.match(/^(\w+)\s*\(\)\s*{/) ||
      trimmedLine.match(/^function\s+(\w+)\s*(?:\(\))?\s*{/);
    if (funcMatch) {
      const name = funcMatch[1];

      // Look for help/usage documentation in comments above
      let documentation = "";
      for (let i = lineIndex - 1; i >= 0 && i >= lineIndex - 5; i--) {
        const prevLine = lines[i].trim();
        if (prevLine.startsWith("#")) {
          documentation = `${prevLine.substring(1).trim()}\\n${documentation}`;
        } else if (prevLine) {
          break;
        }
      }

      symbols.push({
        name,
        type: "function",
        visibility: name.startsWith("_") ? "private" : "public",
        signature: trimmedLine,
        location: { file: filePath, line: lineIndex + 1, column: 1 },
        documentation: documentation || undefined,
      });
    }

    // Variable assignments (exported variables)
    const varMatch = trimmedLine.match(/^(export\s+)?(\w+)=(.*)/);
    if (varMatch) {
      const [, exportKeyword, name] = varMatch;

      if (exportKeyword || name === name.toUpperCase()) {
        // Exported or CONSTANT_CASE
        symbols.push({
          name,
          type: exportKeyword ? "variable" : "constant",
          visibility: "public",
          signature: trimmedLine,
          location: { file: filePath, line: lineIndex + 1, column: 1 },
        });
      }
    }
  }

  return options.includePrivate ? symbols : symbols.filter((s) => s.visibility === "public");
}

/**
 * Get Bash version
 */
async function getBashVersion(): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("bash", ["--version"], { stdio: "pipe" });
    let output = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", () => {
      const version = output.match(/bash.*version\s+([\d.]+)/i)?.[1] || "unknown";
      resolve(version);
    });

    child.on("error", () => {
      resolve("unknown");
    });
  });
}

/**
 * Add missing function stubs for other language extractors
 */
async function extractPythonSurface(
  _options: SurfaceOptions,
  sourceFiles: string[],
): Promise<APISurface | null> {
  // Implementation would go here - stub for now
  console.log(
    chalk.yellow(
      `Python surface extraction not fully implemented yet (${sourceFiles.length} files)`,
    ),
  );
  return null;
}

async function extractRustSurface(
  _options: SurfaceOptions,
  sourceFiles: string[],
): Promise<APISurface | null> {
  // Implementation would go here - stub for now
  console.log(
    chalk.yellow(`Rust surface extraction not fully implemented yet (${sourceFiles.length} files)`),
  );
  return null;
}

async function extractGoSurface(
  _options: SurfaceOptions,
  sourceFiles: string[],
): Promise<APISurface | null> {
  // Implementation would go here - stub for now
  console.log(
    chalk.yellow(`Go surface extraction not fully implemented yet (${sourceFiles.length} files)`),
  );
  return null;
}

async function extractBashSurface(
  _options: SurfaceOptions,
  sourceFiles: string[],
): Promise<APISurface | null> {
  // Implementation would go here - stub for now
  console.log(
    chalk.yellow(`Bash surface extraction not fully implemented yet (${sourceFiles.length} files)`),
  );
  return null;
}

/**
 * Calculate surface delta between current and previous versions
 */
async function calculateSurfaceDelta(_surface: APISurface, outputPath: string): Promise<any> {
  // Stub implementation - would compare with existing file
  console.log(chalk.dim(`Calculating delta for ${outputPath}...`));
  return null;
}
