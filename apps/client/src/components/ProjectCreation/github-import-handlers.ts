/**
 * Handler utilities for GitHub project import operations.
 * Extracted from GitHubProjectsImport to reduce component complexity.
 */

import type { GitHubOrganization, GitHubReposByOwner, GitHubRepository } from "@/types/github";
import { apiService } from "@services/api";
import { toast } from "react-toastify";

/** Result of loading GitHub projects */
export interface LoadGitHubResult {
  repos: GitHubRepository[];
  reposByOwner: GitHubReposByOwner;
  organizations: GitHubOrganization[];
  success: boolean;
}

/** Aggregates repositories from API results */
function aggregateUserRepos(
  result: { success: boolean; repositories?: GitHubRepository[] },
  repos: GitHubRepository[],
  grouped: GitHubReposByOwner,
): void {
  if (!result.success || !result.repositories) return;

  repos.push(...result.repositories);
  result.repositories.forEach((repo) => {
    const owner = repo.owner.login;
    if (!grouped[owner]) grouped[owner] = [];
    grouped[owner].push(repo);
  });
}

/** Loads repos for a single organization */
async function loadOrgRepos(
  org: GitHubOrganization,
  repos: GitHubRepository[],
  grouped: GitHubReposByOwner,
): Promise<void> {
  try {
    const result = await apiService.getGitHubOrgRepos(org.login);
    if (result.success && result.repositories) {
      repos.push(...result.repositories);
      grouped[org.login] = result.repositories;
    }
  } catch (error) {
    console.warn(`Failed to load repos for org ${org.login}:`, error);
  }
}

/** Loads all GitHub projects (user repos and org repos) */
export async function loadGitHubProjects(): Promise<LoadGitHubResult> {
  const [reposResult, orgsResult] = await Promise.all([
    apiService.getGitHubUserRepos(),
    apiService.getGitHubUserOrgs(),
  ]);

  const repos: GitHubRepository[] = [];
  const grouped: GitHubReposByOwner = {};

  aggregateUserRepos(reposResult, repos, grouped);

  const organizations: GitHubOrganization[] = orgsResult.success
    ? (orgsResult.organizations ?? [])
    : [];

  for (const org of organizations) {
    await loadOrgRepos(org, repos, grouped);
  }

  if (!reposResult.success) {
    toast.error(reposResult.error || "Failed to load GitHub repositories", { autoClose: 3000 });
  }

  return {
    repos,
    reposByOwner: grouped,
    organizations,
    success: reposResult.success,
  };
}

/** Extract error message from various error formats */
function extractErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "Unknown error";

  const err = error as Record<string, unknown>;
  const details = err.details as Record<string, unknown> | undefined;

  return (
    (details?.error as string) ||
    (details?.detail as string) ||
    (details?.message as string) ||
    (err.message as string) ||
    "Unknown error"
  );
}

/** Imports a single repository */
async function importSingleRepo(repo: GitHubRepository): Promise<boolean> {
  try {
    const scanResult = await apiService.scanGitUrl(repo.clone_url);
    if (!scanResult.success) {
      toast.error(
        `Failed to scan repository "${repo.name}": ${scanResult.error || "Unknown error"}`,
        {
          autoClose: 3000,
        },
      );
      return false;
    }

    await apiService.createProject(repo.name, scanResult.tempPath);
    toast.success(`Project "${repo.name}" imported successfully`, { autoClose: 2000 });
    return true;
  } catch (error) {
    const errorMessage = extractErrorMessage(error);
    toast.error(`Failed to scan repository "${repo.name}": ${errorMessage}`, { autoClose: 3000 });
    console.error(`Scan error for ${repo.name}:`, error);
    return false;
  }
}

/** Imports selected GitHub repositories */
export async function importSelectedRepos(
  selectedRepos: Set<number>,
  gitHubRepos: GitHubRepository[],
): Promise<boolean> {
  if (selectedRepos.size === 0) {
    toast.error("Please select at least one repository to import", { autoClose: 2000 });
    return false;
  }

  for (const repoId of selectedRepos) {
    const repo = gitHubRepos.find((r) => r.id === repoId);
    if (repo) {
      await importSingleRepo(repo);
    } else {
      console.warn(`Repository with ID ${repoId} not found in gitHubRepos`);
    }
  }

  return true;
}
