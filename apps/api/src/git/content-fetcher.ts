/**
 * Content fetcher implementations for local and GitHub repositories.
 * Provides a unified interface for reading file contents from different sources.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_MAX_SIZE = 256 * 1024;
const GITHUB_RAW_BASE_URL = "https://raw.githubusercontent.com";
const GITHUB_RAW_ACCEPT_HEADER = "application/vnd.github.raw";

/** Interface for fetching text content from files */
export interface ContentFetcher {
  fetchText(filePath: string): Promise<string | null>;
}

/** Check if path attempts directory traversal */
function isPathTraversal(normalizedPath: string): boolean {
  return normalizedPath.startsWith("..");
}

/** Safely read file if it exists, is a file, and under size limit */
async function safeReadFile(absolutePath: string, maxSize: number): Promise<string | null> {
  try {
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile() || stat.size > maxSize) return null;
    return await fs.readFile(absolutePath, "utf-8");
  } catch {
    return null;
  }
}

/** Build GitHub raw content URL for a file */
function buildGithubRawUrl(
  baseUrl: string,
  owner: string,
  repo: string,
  ref: string,
  filePath: string,
): string {
  const normalized = filePath.replace(/^\/+/, "");
  const encodedPath = normalized
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${baseUrl}/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/${encodedPath}`;
}

/** Build fetch headers for GitHub API */
function buildGithubHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: GITHUB_RAW_ACCEPT_HEADER };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Check if content exceeds size limit from headers or actual length */
function exceedsSizeLimit(response: Response, text: string, maxSize: number): boolean {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxSize) return true;
  return text.length > maxSize;
}

/**
 * Create a content fetcher for local filesystem access.
 * Enforces path traversal protection and size limits.
 */
export function createLocalContentFetcher(
  projectRoot: string,
  maxSize = DEFAULT_MAX_SIZE,
): ContentFetcher {
  const root = path.resolve(projectRoot);
  return {
    async fetchText(filePath: string): Promise<string | null> {
      const normalized = path.normalize(filePath);
      if (isPathTraversal(normalized)) return null;
      const absolutePath = path.join(root, normalized);
      return safeReadFile(absolutePath, maxSize);
    },
  };
}

/** Options for creating a GitHub content fetcher */
export interface GithubFetcherOptions {
  owner: string;
  repo: string;
  ref: string;
  token?: string;
  maxSize?: number;
  baseUrl?: string;
}

/**
 * Create a content fetcher for GitHub raw content.
 * Uses raw.githubusercontent.com to fetch file contents.
 */
export function createGithubContentFetcher(options: GithubFetcherOptions): ContentFetcher {
  const {
    owner,
    repo,
    ref,
    token,
    maxSize = DEFAULT_MAX_SIZE,
    baseUrl = GITHUB_RAW_BASE_URL,
  } = options;

  return {
    async fetchText(filePath: string): Promise<string | null> {
      const url = buildGithubRawUrl(baseUrl, owner, repo, ref, filePath);
      try {
        const response = await fetch(url, { headers: buildGithubHeaders(token) });
        if (!response.ok) return null;

        const text = await response.text();
        if (exceedsSizeLimit(response, text, maxSize)) return null;

        return text;
      } catch {
        return null;
      }
    },
  };
}
