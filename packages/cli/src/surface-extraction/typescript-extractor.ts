import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import type { APISurface, APISymbol, SurfaceOptions } from "@/surface-extraction/types.js";
import { calculateStatistics } from "@/surface-extraction/utils.js";
import chalk from "chalk";

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

    if (trimmedLine.startsWith("//") || trimmedLine.startsWith("/*") || !trimmedLine) {
      continue;
    }

    const exportMatch = trimmedLine.match(/^export\s+(async\s+)?(\w+)\s+(\w+)/);
    if (exportMatch) {
      const [, asyncKeyword, type, name] = exportMatch;
      const _isAsync = Boolean(asyncKeyword);

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

      if (symbolType === "function") {
        const funcMatch = line.match(/function\s+\w+\s*\([^)]*\)(?:\s*:\s*[^{]+)?/);
        if (funcMatch) {
          symbol.signature = funcMatch[0];
        }
      }

      symbols.push(symbol);
    }

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

  return options.includePrivate ? symbols : symbols.filter((s) => s.visibility === "public");
}

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
