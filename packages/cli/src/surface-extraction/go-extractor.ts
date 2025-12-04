import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { APISurface, APISymbol, SurfaceOptions } from "@/surface-extraction/types.js";
import { calculateStatistics } from "@/surface-extraction/utils.js";
import chalk from "chalk";
import { glob } from "glob";

export async function extractGoSurface(
  options: SurfaceOptions,
  _sourceFiles: string[] = [],
): Promise<APISurface | null> {
  try {
    const goModExists = await glob("go.mod").then((files) => files.length > 0);
    if (!goModExists) {
      console.log(chalk.yellow("No go.mod found - not a Go project"));
      return null;
    }

    console.log(chalk.dim("Attempting Go surface extraction..."));

    try {
      console.log(chalk.dim("Strategy 1: Using go list + go doc..."));
      const goSurface = await extractGoWithGoTools(options);
      if (goSurface) {
        console.log(chalk.green("✅ Successfully extracted using go tools"));
        return goSurface;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(chalk.dim(`go tools failed: ${message}`));
    }

    try {
      console.log(chalk.dim("Strategy 2: Attempting basic Go parsing..."));
      const basicSurface = await extractGoWithBasicParsing(options);
      if (basicSurface) {
        console.log(chalk.green("✅ Successfully extracted using basic parsing"));
        return basicSurface;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(chalk.dim(`basic parsing failed: ${message}`));
    }

    console.log(chalk.red("❌ All Go extraction strategies failed"));
    return null;
  } catch (error) {
    console.error(chalk.red("Go surface extraction failed:"), error);
    return null;
  }
}

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
        const symbols: APISymbol[] = [];
        const lines = output.trim().split("\n");

        for (const line of lines) {
          if (!line.trim()) continue;

          const packageInfo = JSON.parse(line);
          if (packageInfo.Name?.endsWith("_test")) continue;

          const packagePath: string = packageInfo.ImportPath;
          const packageSymbols = await getGoPackageSymbols(packagePath);
          symbols.push(...packageSymbols);
        }

        if (symbols.length === 0) {
          resolve(null);
          return;
        }

        resolve({
          language: "go",
          version: await getGoVersion(),
          timestamp: Date.now(),
          symbols: options.includePrivate
            ? symbols
            : symbols.filter((s) => s.visibility === "public"),
          statistics: calculateStatistics(symbols),
        });
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

function parseGoDocOutput(docOutput: string, packagePath: string): APISymbol[] {
  const parser = new GoDocParser(packagePath);
  return parser.parseDocOutput(docOutput);
}

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

    const funcSymbol = parseGoFunction(trimmedLine, filePath, lineIndex);
    if (funcSymbol) {
      symbols.push(funcSymbol);
      continue;
    }

    const structSymbol = parseGoStruct(trimmedLine, filePath, lineIndex);
    if (structSymbol) {
      symbols.push(structSymbol);
      continue;
    }

    const interfaceSymbol = parseGoInterface(trimmedLine, filePath, lineIndex);
    if (interfaceSymbol) {
      symbols.push(interfaceSymbol);
      continue;
    }

    const constantSymbol = parseGoConstant(trimmedLine, filePath, lineIndex);
    if (constantSymbol) {
      symbols.push(constantSymbol);
      continue;
    }

    const variableSymbol = parseGoVariable(trimmedLine, filePath, lineIndex);
    if (variableSymbol) {
      symbols.push(variableSymbol);
    }
  }

  return options.includePrivate
    ? symbols
    : symbols.filter((symbol) => symbol.visibility === "public");
}

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

function parseGoStruct(line: string, filePath: string, lineIndex: number): APISymbol | null {
  const structMatch = line.match(/^type\s+(\w+)\s+struct/);
  if (!structMatch) return null;

  const [, name] = structMatch;
  if (!isExported(name)) return null;

  return {
    name,
    type: "class",
    visibility: "public",
    signature: line,
    location: {
      file: filePath,
      line: lineIndex + 1,
      column: line.indexOf(name) + 1,
    },
  };
}

function parseGoInterface(line: string, filePath: string, lineIndex: number): APISymbol | null {
  const interfaceMatch = line.match(/^type\s+(\w+)\s+interface/);
  if (!interfaceMatch) return null;

  const [, name] = interfaceMatch;
  if (!isExported(name)) return null;

  return {
    name,
    type: "interface",
    visibility: "public",
    signature: line,
    location: {
      file: filePath,
      line: lineIndex + 1,
      column: line.indexOf(name) + 1,
    },
  };
}

function parseGoConstant(line: string, filePath: string, lineIndex: number): APISymbol | null {
  const constMatch = line.match(/^const\s+(\w+)\s+(.+)/);
  if (!constMatch) return null;

  const [, name, type] = constMatch;
  if (!isExported(name)) return null;

  return {
    name,
    type: "constant",
    visibility: "public",
    signature: line,
    location: {
      file: filePath,
      line: lineIndex + 1,
      column: line.indexOf(name) + 1,
    },
    returnType: type,
  };
}

function parseGoVariable(line: string, filePath: string, lineIndex: number): APISymbol | null {
  const varMatch = line.match(/^var\s+(\w+)\s+(.+)/);
  if (!varMatch) return null;

  const [, name, type] = varMatch;
  if (!isExported(name)) return null;

  return {
    name,
    type: "variable",
    visibility: "public",
    signature: line,
    location: {
      file: filePath,
      line: lineIndex + 1,
      column: line.indexOf(name) + 1,
    },
    returnType: type,
  };
}

function isExported(name: string | undefined): boolean {
  return Boolean(name) && name![0] === name![0].toUpperCase();
}

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
