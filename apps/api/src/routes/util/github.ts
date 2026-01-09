/**
 * GitHub API proxy routes for repository and organization access.
 * Provides endpoints for fetching user repos, organizations, and org repos.
 */
import { Hono } from "hono";
import type { Context } from "hono";

/** Dependencies for the GitHub router (currently unused but reserved for future expansion) */
type Dependencies = Record<string, unknown>;

const GITHUB_API_BASE = "https://api.github.com";
const TOKEN_MISSING_ERROR = "GITHUB_TOKEN environment variable not set";

/** Standard GitHub API request headers */
const GITHUB_API_HEADERS = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
} as const;

/** Get GitHub token from environment */
function getGitHubToken(): string | null {
  return process.env.GITHUB_TOKEN ?? null;
}

/** Create request headers with authorization */
function createAuthHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, ...GITHUB_API_HEADERS };
}

/** Create error response object */
function errorResponse(error: string, details?: string) {
  return { success: false as const, error, ...(details && { details }) };
}

/** Create success response object */
function successResponse<T extends string, V>(key: T, value: V) {
  return { success: true as const, [key]: value } as { success: true } & Record<T, V>;
}

/** Handle GitHub API errors from response */
async function handleApiError(response: Response): Promise<{ success: false; error: string }> {
  const errorData = await response.json();
  return errorResponse(`GitHub API error: ${errorData.message}`);
}

/** Map a repository response to a simplified format */
function mapRepository(repo: any) {
  return {
    id: repo.id,
    name: repo.name,
    full_name: repo.full_name,
    description: repo.description,
    private: repo.private,
    clone_url: repo.clone_url,
    ssh_url: repo.ssh_url,
    html_url: repo.html_url,
    language: repo.language,
    stargazers_count: repo.stargazers_count,
    forks_count: repo.forks_count,
    updated_at: repo.updated_at,
    owner: {
      login: repo.owner.login,
      type: repo.owner.type,
      avatar_url: repo.owner.avatar_url,
    },
  };
}

/** Map an organization response to a simplified format */
function mapOrganization(org: any) {
  return {
    login: org.login,
    id: org.id,
    description: org.description,
    avatar_url: org.avatar_url,
    public_repos: org.public_repos,
  };
}

/** Fetch JSON from GitHub API with authentication */
async function fetchGitHubApi(
  url: string,
  token: string,
): Promise<{ ok: true; data: any } | { ok: false; error: string }> {
  const response = await fetch(url, { headers: createAuthHeaders(token) });
  if (!response.ok) {
    const errorData = await response.json();
    return { ok: false, error: `GitHub API error: ${errorData.message}` };
  }
  return { ok: true, data: await response.json() };
}

/** Fetch user repositories from GitHub API */
async function fetchUserRepos(c: Context) {
  const token = getGitHubToken();
  if (!token) return c.json(errorResponse(TOKEN_MISSING_ERROR), 400);

  const result = await fetchGitHubApi(
    `${GITHUB_API_BASE}/user/repos?per_page=100&sort=updated`,
    token,
  );
  if (!result.ok) return c.json(errorResponse(result.error), 400);

  return c.json(successResponse("repositories", result.data.map(mapRepository)));
}

/** Fetch user organizations from GitHub API */
async function fetchUserOrgs(c: Context) {
  const token = getGitHubToken();
  if (!token) return c.json(errorResponse(TOKEN_MISSING_ERROR), 400);

  const result = await fetchGitHubApi(`${GITHUB_API_BASE}/user/orgs`, token);
  if (!result.ok) return c.json(errorResponse(result.error), 400);

  return c.json(successResponse("organizations", result.data.map(mapOrganization)));
}

/** Fetch organization repositories from GitHub API */
async function fetchOrgRepos(c: Context, org: string) {
  const token = getGitHubToken();
  if (!token) return c.json(errorResponse(TOKEN_MISSING_ERROR), 400);

  const result = await fetchGitHubApi(
    `${GITHUB_API_BASE}/orgs/${org}/repos?per_page=100&sort=updated`,
    token,
  );
  if (!result.ok) return c.json(errorResponse(result.error), 400);

  return c.json(successResponse("repositories", result.data.map(mapRepository)));
}

/** Wrap route handler with error logging */
function withErrorHandling(handler: (c: Context) => Promise<Response>, errorMessage: string) {
  return async (c: Context) => {
    try {
      return await handler(c);
    } catch (error) {
      console.error(errorMessage, error);
      const details = error instanceof Error ? error.message : "Unknown error";
      return c.json(errorResponse(errorMessage.replace("Failed to ", ""), details), 500);
    }
  };
}

/**
 * Create the GitHub API router with repository access endpoints.
 * Requires GITHUB_TOKEN environment variable for authentication.
 */
export function createGithubRouter(_deps: Dependencies) {
  const router = new Hono();

  router.get("/user/repos", withErrorHandling(fetchUserRepos, "Failed to fetch repositories"));
  router.get("/user/orgs", withErrorHandling(fetchUserOrgs, "Failed to fetch organizations"));
  router.get(
    "/orgs/:org/repos",
    withErrorHandling(
      (c) => fetchOrgRepos(c, c.req.param("org")),
      "Failed to fetch organization repositories",
    ),
  );

  return router;
}
