/**
 * Git URL parsing utilities for GitHub repository URLs.
 * Supports SSH, HTTPS, and tree URLs with optional ref extraction.
 */

/** Parsed components from a GitHub repository URL */
export interface ParsedGitUrl {
  provider: "github";
  owner: string;
  repo: string;
  ref?: string;
}

/**
 * Parse a Git URL into its component parts.
 * Supports SSH (git@), HTTPS, and GitHub tree URLs.
 */
export function parseGitUrl(input: string): ParsedGitUrl | null {
  const normalized = input.startsWith("git+") ? input.slice(4) : input;

  if (normalized.startsWith("git@")) {
    return parseSshGitUrl(normalized);
  }

  return parseHttpsGitUrl(normalized);
}

/**
 * Parse an SSH-style git URL (git@host:owner/repo).
 */
function parseSshGitUrl(normalized: string): ParsedGitUrl | null {
  const match = normalized.match(/^git@([^:]+):([^/]+)\/(.+?)(?:\.git)?$/);
  if (!match) return null;

  const [, host, owner, repoRaw] = match;
  if (!isGithubHost(host)) return null;

  return { provider: "github", owner, repo: repoRaw };
}

/**
 * Parse an HTTPS-style git URL.
 */
function parseHttpsGitUrl(normalized: string): ParsedGitUrl | null {
  try {
    const url = new URL(normalized);
    if (!isGithubHost(url.hostname)) {
      return null;
    }

    const segments = url.pathname
      .replace(/\.git$/, "")
      .replace(/^\//, "")
      .split("/")
      .filter(Boolean);
    if (segments.length < 2) {
      return null;
    }

    const [owner, repo] = segments;
    const ref = extractRef(segments, url);

    return { provider: "github", owner, repo, ref };
  } catch {
    return null;
  }
}

/**
 * Extract the ref from URL segments, query params, or hash.
 */
function extractRef(segments: string[], url: URL): string | undefined {
  // Check tree path: /owner/repo/tree/branch/name
  if (segments.length >= 4 && segments[2] === "tree") {
    return segments.slice(3).join("/");
  }

  // Check query param: ?ref=branch
  if (url.searchParams.has("ref")) {
    return url.searchParams.get("ref") ?? undefined;
  }

  // Check hash fragment: #branch
  if (url.hash) {
    const fragment = url.hash.replace(/^#/, "");
    return fragment || undefined;
  }

  return undefined;
}

/** Check if a hostname is a GitHub domain */
function isGithubHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return normalized === "github.com" || normalized === "www.github.com";
}
