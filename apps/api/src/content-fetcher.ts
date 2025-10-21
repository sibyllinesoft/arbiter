import { promises as fs } from "node:fs";
import path from "node:path";

export interface ContentFetcher {
  fetchText(filePath: string): Promise<string | null>;
}

export function createLocalContentFetcher(
  projectRoot: string,
  maxSize = 256 * 1024,
): ContentFetcher {
  const root = path.resolve(projectRoot);
  return {
    async fetchText(filePath: string): Promise<string | null> {
      const normalized = path.normalize(filePath);
      if (normalized.startsWith("..")) {
        return null;
      }
      const absolutePath = path.join(root, normalized);
      try {
        const stat = await fs.stat(absolutePath);
        if (!stat.isFile() || stat.size > maxSize) {
          return null;
        }
        return await fs.readFile(absolutePath, "utf-8");
      } catch {
        return null;
      }
    },
  };
}

export interface GithubFetcherOptions {
  owner: string;
  repo: string;
  ref: string;
  token?: string;
  maxSize?: number;
  baseUrl?: string;
}

export function createGithubContentFetcher(options: GithubFetcherOptions): ContentFetcher {
  const {
    owner,
    repo,
    ref,
    token,
    maxSize = 256 * 1024,
    baseUrl = "https://raw.githubusercontent.com",
  } = options;

  return {
    async fetchText(filePath: string): Promise<string | null> {
      const normalized = filePath.replace(/^\/+/, "");
      const url = `${baseUrl}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/${normalized
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/")}`;

      try {
        const response = await fetch(url, {
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.raw",
              }
            : {
                Accept: "application/vnd.github.raw",
              },
        });

        if (!response.ok) {
          return null;
        }

        const contentLength = response.headers.get("content-length");
        if (contentLength && Number(contentLength) > maxSize) {
          return null;
        }

        const text = await response.text();
        if (text.length > maxSize) {
          return null;
        }

        return text;
      } catch {
        return null;
      }
    },
  };
}
