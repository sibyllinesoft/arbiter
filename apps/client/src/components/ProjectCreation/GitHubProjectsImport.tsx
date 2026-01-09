/**
 * GitHubProjectsImport - Component for importing projects from GitHub repositories.
 * Fetches user repos and organization repos, allowing selection and bulk import.
 */

import { useGitHubState } from "@contexts/AppContext";
import { Button, cn } from "@design-system";
import { useProjects } from "@hooks/api-hooks";
import { GitBranch as GitIcon, RefreshCw, Upload } from "lucide-react";
import React from "react";
import { toast } from "react-toastify";
import { importSelectedRepos, loadGitHubProjects } from "./github-import-handlers";

/** Props for the GitHubProjectsImport component */
interface GitHubProjectsImportProps {
  onClose: () => void;
}

/**
 * Component for importing multiple projects from GitHub.
 * Displays user repos and org repos grouped by owner with selection.
 */
export function GitHubProjectsImport({ onClose }: GitHubProjectsImportProps) {
  const { refetch: refetchProjects } = useProjects();
  const [isCreatingProject, setIsCreatingProject] = React.useState(false);

  const {
    state: { gitHubRepos, selectedRepos, reposByOwner, isLoadingGitHub },
    setGitHubRepos,
    setGitHubOrgs,
    setSelectedRepos,
    toggleRepoSelection,
    setReposByOwner,
    setLoadingGitHub,
  } = useGitHubState();

  const handleLoadGitHubProjects = async () => {
    setLoadingGitHub(true);
    try {
      const result = await loadGitHubProjects();
      setGitHubRepos(result.repos);
      setReposByOwner(result.reposByOwner);
      setGitHubOrgs(result.organizations);
    } catch (error) {
      console.error("Failed to load GitHub projects:", error);
      toast.error("Failed to load GitHub projects", { autoClose: 3000 });
    } finally {
      setLoadingGitHub(false);
    }
  };

  const handleSelectRepo = (repoId: number) => {
    toggleRepoSelection(repoId);
  };

  const handleImportSelectedRepos = async () => {
    setIsCreatingProject(true);
    try {
      const success = await importSelectedRepos(selectedRepos, gitHubRepos);
      if (success) {
        refetchProjects();
        onClose();
        setSelectedRepos(new Set());
      }
    } catch (error) {
      toast.error("Failed to import repositories", { autoClose: 3000 });
      console.error("Import error:", error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center justify-between flex-shrink-0">
        <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">
          Your GitHub Projects
        </h4>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleLoadGitHubProjects}
          disabled={isLoadingGitHub}
          className="whitespace-nowrap"
          leftIcon={
            isLoadingGitHub ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )
          }
        >
          {isLoadingGitHub ? "Loading..." : "Load Projects"}
        </Button>
      </div>

      {isLoadingGitHub && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-gray-400 dark:text-graphite-300" />
            <p className="text-sm text-gray-600 dark:text-graphite-300">
              Loading your GitHub projects...
            </p>
          </div>
        </div>
      )}

      {reposByOwner && Object.keys(reposByOwner).length > 0 && !isLoadingGitHub && (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto pr-2 scrollbar-transparent min-h-0">
            {Object.entries(reposByOwner).map(([owner, repos]) => (
              <div
                key={owner}
                className="rounded-lg border border-gray-200 p-3 dark:border-graphite-700 dark:bg-graphite-900"
              >
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-graphite-800">
                    <span className="text-sm font-medium text-gray-600 dark:text-graphite-200">
                      {owner.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-gray-100">{owner}</h5>
                    <p className="text-xs text-gray-500 dark:text-graphite-300">
                      {repos.length} repositories
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {repos.map((repo) => (
                    <div
                      key={repo.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded border p-2 transition-colors",
                        selectedRepos.has(repo.id)
                          ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50 dark:border-graphite-700 dark:hover:border-graphite-600 dark:hover:bg-graphite-800",
                      )}
                      onClick={() => handleSelectRepo(repo.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedRepos.has(repo.id)}
                        onChange={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        className="pointer-events-none h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-graphite-600 dark:bg-graphite-800 dark:text-blue-300 dark:focus:ring-blue-400"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h6 className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {repo.name}
                          </h6>
                          {repo.language && (
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-graphite-800 dark:text-graphite-300">
                              {repo.language}
                            </span>
                          )}
                          {repo.private && (
                            <span className="rounded px-2 py-0.5 text-xs bg-yellow-100 text-yellow-600 dark:bg-yellow-500/10 dark:text-yellow-300">
                              Private
                            </span>
                          )}
                        </div>
                        {repo.description && (
                          <p className="mt-1 truncate text-xs text-gray-500 dark:text-graphite-300">
                            {repo.description}
                          </p>
                        )}
                        <div className="mt-1 flex items-center gap-3 text-xs text-gray-400 dark:text-graphite-400">
                          <span>★ {repo.stargazers_count}</span>
                          <span>⑂ {repo.forks_count}</span>
                          <span>Updated {new Date(repo.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex-shrink-0 border-t border-gray-200 pt-4 dark:border-graphite-700">
            <Button
              variant="primary"
              onClick={handleImportSelectedRepos}
              className="w-full"
              leftIcon={
                isCreatingProject ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )
              }
              disabled={isCreatingProject || selectedRepos.size === 0}
            >
              {isCreatingProject
                ? "Importing Projects..."
                : selectedRepos.size > 0
                  ? `Import ${selectedRepos.size} Selected Project${selectedRepos.size > 1 ? "s" : ""}`
                  : "Select Projects to Import"}
            </Button>
          </div>
        </>
      )}

      {!isLoadingGitHub && (!reposByOwner || Object.keys(reposByOwner).length === 0) && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <GitIcon className="mx-auto mb-4 h-12 w-12 text-gray-300 dark:text-graphite-500" />
            <h4 className="mb-2 text-lg font-medium text-gray-900 dark:text-gray-100">
              No Projects Loaded
            </h4>
            <p className="mb-4 text-sm text-gray-600 dark:text-graphite-300">
              Click "Load Projects" to fetch your GitHub repositories and organizations
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
