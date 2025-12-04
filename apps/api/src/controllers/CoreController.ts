import path from "path";
import fs from "fs-extra";
import { glob } from "glob";
import { isCloudflareRuntime } from "../runtime-env";
import type { ServerConfig } from "../types";

type Dependencies = Record<string, unknown>;

interface SearchResult {
  title: string;
  type: string;
  path: string;
  content: string;
  relevance: number;
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

  async search(query: string, searchType: string, limit: number): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    const searchPatterns: Record<string, string[]> = {
      all: ["**/*.md", "**/*.ts", "**/*.js", "**/*.cue", "**/*.json", "**/*.yaml", "**/*.yml"],
      specs: ["**/*.cue", "**/spec/**/*", "**/specs/**/*"],
      docs: ["**/*.md", "**/docs/**/*", "**/README*"],
    };

    const patterns = searchPatterns[searchType] || searchPatterns.all;

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: this.projectRoot,
        ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/build/**"],
        absolute: true,
      });

      for (const filePath of files) {
        if (!(await fs.pathExists(filePath))) continue;

        const stat = await fs.stat(filePath);
        if (!stat.isFile() || stat.size > 100000) continue;

        const content = await fs.readFile(filePath, "utf-8");
        const lines = content.split("\n");

        let relevance = 0;
        const matchingLines: string[] = [];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const lineLower = line.toLowerCase();
          if (lineLower.includes(queryLower)) {
            relevance++;
            matchingLines.push(`${i + 1}: ${line.trim()}`);
            if (line.trim().startsWith("#") || line.includes("title:") || line.includes("name:")) {
              relevance += 3;
            }
          }
        }

        if (relevance > 0) {
          const relativePath = path.relative(this.projectRoot, filePath);
          const fileType = path.extname(filePath).slice(1) || "file";

          results.push({
            title: path.basename(filePath),
            type: fileType,
            path: relativePath,
            content: matchingLines.slice(0, 5).join("\n"),
            relevance,
          });
        }
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
