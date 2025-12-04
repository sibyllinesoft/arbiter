import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { APISurface, APISymbol, SurfaceOptions } from "@/surface-extraction/types.js";
import { calculateStatistics } from "@/surface-extraction/utils.js";
import chalk from "chalk";
import { glob } from "glob";

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

  async extractSurface(options: SurfaceOptions): Promise<APISurface | null> {
    const projectValid = await this.validateRustProject();
    if (!projectValid) {
      console.log(chalk.yellow("No Rust project found"));
      return null;
    }

    console.log(chalk.dim("Attempting Rust surface extraction..."));

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

  private async validateRustProject(): Promise<boolean> {
    const cargoTomlExists = await glob("Cargo.toml").then((files) => files.length > 0);
    const rustFilesExist = await glob("src/**/*.rs").then((files) => files.length > 0);
    return cargoTomlExists || rustFilesExist;
  }
}

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

        for (const item of apiData.items || []) {
          const symbol: APISymbol = {
            name: item.name || "unnamed",
            type: mapRustItemType(item.kind),
            visibility: "public",
            signature: item.signature || item.name,
            location: {
              file: item.file_path || "",
              line: item.line || 1,
              column: item.column || 1,
            },
            documentation: item.docs,
          };

          if (item.kind === "function") {
            symbol.parameters = item.inputs?.map((input: any) => ({
              name: input.name || "param",
              type: input.ty || "",
            }));
            symbol.returnType = item.output?.ty;
          }

          symbols.push(symbol);
        }

        resolve({
          language: "rust",
          version: await getRustVersion(),
          timestamp: Date.now(),
          symbols,
          statistics: calculateStatistics(symbols),
        });
      } catch (error) {
        throw new Error(`Failed to parse cargo public-api output: ${error}`);
      }
    });

    child.on("error", (error) => {
      throw new Error(`cargo public-api command failed: ${error.message}`);
    });
  });
}

async function extractRustWithRustdocJson(_options: SurfaceOptions): Promise<APISurface | null> {
  return new Promise((resolve) => {
    const child = spawn("cargo", ["doc", "--no-deps", "--output-format", "json"], {
      stdio: "pipe",
    });
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
        throw new Error(`cargo doc failed: ${errorOutput}`);
      }

      try {
        const docFiles = await glob("target/doc/*.json");
        const symbols: APISymbol[] = [];

        for (const docFile of docFiles) {
          try {
            const content = await readFile(docFile, "utf-8");
            const docJson = JSON.parse(content);

            if (docJson.index?.items) {
              for (const item of docJson.index.items) {
                const itemData = item as any;
                if (itemData.visibility === "public") {
                  const symbol: APISymbol = {
                    name: itemData.name || "unnamed",
                    type: mapRustItemType(itemData.kind),
                    visibility: "public",
                    signature: itemData.signature || itemData.name,
                    location: {
                      file: itemData.span?.filename || "",
                      line: itemData.span?.begin?.[0] || 1,
                      column: itemData.span?.begin?.[1] || 1,
                    },
                    documentation: itemData.docs,
                  };

                  symbols.push(symbol);
                }
              }
            }
          } catch (error) {
            console.log(chalk.dim(`Failed to parse rustdoc JSON file ${docFile}: ${error}`));
          }
        }

        resolve({
          language: "rust",
          version: await getRustVersion(),
          timestamp: Date.now(),
          symbols,
          statistics: calculateStatistics(symbols),
        });
      } catch (error) {
        throw new Error(`Failed to parse rustdoc JSON: ${error}`);
      }
    });

    child.on("error", (error) => {
      throw new Error(`cargo doc command failed: ${error.message}`);
    });
  });
}

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

    if (trimmedLine.startsWith("//") || trimmedLine.startsWith("/*") || !trimmedLine) {
      continue;
    }

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

async function getRustVersion(): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("rustc", ["--version"], { stdio: "pipe" });
    let output = "";

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.on("close", () => {
      const version = output.match(/rustc\s+([\d.]+)/)?.[1] || "";
      resolve(version);
    });

    child.on("error", () => {
      resolve("unknown");
    });
  });
}
