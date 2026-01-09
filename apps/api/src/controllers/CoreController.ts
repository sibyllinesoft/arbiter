import path from "path";
import fs from "fs-extra";
import { glob } from "glob";
import { isCloudflareRuntime } from "../util/runtime-env";
import type { ServerConfig } from "../util/types";

type Dependencies = Record<string, unknown>;

interface SearchResult {
  title: string;
  type: string;
  path: string;
  content: string;
  relevance: number;
}

interface LineMatch {
  relevance: number;
  matchingLines: string[];
}

const SEARCH_PATTERNS: Record<string, string[]> = {
  all: ["**/*.md", "**/*.ts", "**/*.js", "**/*.cue", "**/*.json", "**/*.yaml", "**/*.yml"],
  specs: ["**/*.cue", "**/spec/**/*", "**/specs/**/*"],
  docs: ["**/*.md", "**/docs/**/*", "**/README*"],
};

const IGNORE_PATTERNS = ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/build/**"];
const MAX_FILE_SIZE = 100000;

function calculateLineRelevance(
  line: string,
  queryLower: string,
  lineNumber: number,
): LineMatch | null {
  const lineLower = line.toLowerCase();
  if (!lineLower.includes(queryLower)) return null;

  let relevance = 1;
  const trimmed = line.trim();
  if (trimmed.startsWith("#") || line.includes("title:") || line.includes("name:")) {
    relevance += 3;
  }

  return {
    relevance,
    matchingLines: [`${lineNumber + 1}: ${trimmed}`],
  };
}

function analyzeFileContent(content: string, queryLower: string): LineMatch {
  const lines = content.split("\n");
  let totalRelevance = 0;
  const allMatchingLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = calculateLineRelevance(lines[i], queryLower, i);
    if (match) {
      totalRelevance += match.relevance;
      allMatchingLines.push(...match.matchingLines);
    }
  }

  return { relevance: totalRelevance, matchingLines: allMatchingLines };
}

export class CoreController {
  private readonly projectRoot: string;

  constructor(private readonly deps: Dependencies) {
    this.projectRoot = path.resolve(__dirname, "../../../..");
  }

  runtime() {
    const runtime = isCloudflareRuntime() ? "cloudflare" : "node";
    return {
      runtime,
      cloudflareTunnelSupported: runtime !== "cloudflare",
    };
  }

  private async processFile(filePath: string, queryLower: string): Promise<SearchResult | null> {
    if (!(await fs.pathExists(filePath))) return null;

    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > MAX_FILE_SIZE) return null;

    const content = await fs.readFile(filePath, "utf-8");
    const { relevance, matchingLines } = analyzeFileContent(content, queryLower);

    if (relevance === 0) return null;

    return {
      title: path.basename(filePath),
      type: path.extname(filePath).slice(1) || "file",
      path: path.relative(this.projectRoot, filePath),
      content: matchingLines.slice(0, 5).join("\n"),
      relevance,
    };
  }

  async search(query: string, searchType: string, limit: number): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();
    const patterns = SEARCH_PATTERNS[searchType] || SEARCH_PATTERNS.all;

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: this.projectRoot,
        ignore: IGNORE_PATTERNS,
        absolute: true,
      });

      for (const filePath of files) {
        const result = await this.processFile(filePath, queryLower);
        if (result) results.push(result);
      }
    }

    return results.sort((a, b) => b.relevance - a.relevance).slice(0, limit);
  }

  async fetchFile(filePath: string, encoding: BufferEncoding = "utf-8") {
    const normalizedPath = filePath.startsWith("/") ? filePath.slice(1) : filePath;
    const fullPath = path.resolve(this.projectRoot, normalizedPath);
    if (!fullPath.startsWith(`${this.projectRoot}/`)) {
      const err: any = new Error("Access denied: Path outside project directory");
      err.status = 403;
      throw err;
    }

    const exists = await fs.pathExists(fullPath);
    if (!exists) {
      const err: any = new Error("File not found");
      err.status = 404;
      throw err;
    }

    const content = await fs.readFile(fullPath, encoding);
    return { path: normalizedPath, content, encoding };
  }
}
