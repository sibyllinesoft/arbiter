import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import chalk from "chalk";
import { glob } from "glob";
import type { APISurface, APISymbol, SurfaceOptions } from "./types.js";
import { calculateStatistics } from "./utils.js";

export async function extractBashSurface(
  options: SurfaceOptions,
  _sourceFiles: string[] = [],
): Promise<APISurface | null> {
  try {
    const shellFiles = await glob("**/*.{sh,bash}", {
      ignore: ["node_modules/**", ".git/**", "**/test-fixtures*/**"],
    });

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

    for (const file of allFiles) {
      try {
        const content = await readFile(file, "utf-8");
        const fileSymbols = await parseBashFile(file, content, options);
        symbols.push(...fileSymbols);
      } catch (error) {
        console.log(
          chalk.dim(`Failed to parse ${file}: ${error instanceof Error ? error.message : error}`),
        );
      }
    }

    const visibleSymbols = options.includePrivate
      ? symbols
      : symbols.filter((symbol) => symbol.visibility === "public");

    const surface: APISurface = {
      language: "bash",
      version: await getBashVersion(),
      timestamp: Date.now(),
      symbols: visibleSymbols,
      statistics: calculateStatistics(symbols),
    };

    console.log(chalk.green(`✅ Extracted ${surface.symbols.length} bash symbols`));
    return surface;
  } catch (error) {
    console.error(chalk.red("Bash surface extraction failed:"), error);
    return null;
  }
}

async function parseBashFile(
  filePath: string,
  content: string,
  options: SurfaceOptions,
): Promise<APISymbol[]> {
  const symbols: APISymbol[] = [];
  const lines = content.split("\n");

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const functionMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s*\(\)\s*\{/);
    if (functionMatch) {
      const [, name] = functionMatch;
      const visibility: APISymbol["visibility"] = name.startsWith("_") ? "private" : "public";

      symbols.push({
        name,
        type: "function",
        visibility,
        signature: `${name}()`,
        location: {
          file: filePath,
          line: lineIndex + 1,
          column: line.indexOf(name) + 1,
        },
      });
      continue;
    }

    const cliMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s+--[a-zA-Z0-9-]+/);
    if (cliMatch) {
      const [, command] = cliMatch;
      symbols.push({
        name: command,
        type: "variable",
        visibility: "public",
        signature: trimmed,
        location: {
          file: filePath,
          line: lineIndex + 1,
          column: line.indexOf(command) + 1,
        },
      });
    }
  }

  return options.includePrivate
    ? symbols
    : symbols.filter((symbol) => symbol.visibility === "public");
}

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
