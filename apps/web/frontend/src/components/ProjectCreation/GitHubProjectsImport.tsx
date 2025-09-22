/**
 * GitHubProjectsImport - Component for importing projects from GitHub repositories
 */

import { useGitHubState } from '@contexts/AppContext';
import { Button, cn } from '@design-system';
import { useProjects } from '@hooks/api-hooks';
import { apiService } from '@services/api';
import { GitBranch as GitIcon, RefreshCw, Upload } from 'lucide-react';
import React, { useEffect } from 'react';
import { toast } from 'react-toastify';

interface GitHubProjectsImportProps {
  onClose: () => void;
}

export function GitHubProjectsImport({ onClose }: GitHubProjectsImportProps) {
  const { refetch: refetchProjects } = useProjects();
  const [isCreatingProject, setIsCreatingProject] = React.useState(false);

  const {
    gitHubRepos,
    gitHubOrgs,
    selectedRepos,
    reposByOwner,
    isLoadingGitHub,
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
      const [reposResult, orgsResult] = await Promise.all([
        apiService.getGitHubUserRepos(),
        apiService.getGitHubUserOrgs(),
      ]);

      let allRepos: any[] = [];
      const allGrouped: Record<string, any[]> = {};

      if (reposResult.success && reposResult.repositories) {
        allRepos = [...reposResult.repositories];
        reposResult.repositories.forEach(repo => {
          const owner = repo.owner.login;
          if (!allGrouped[owner]) allGrouped[owner] = [];
          allGrouped[owner].push(repo);
        });
      }

      if (orgsResult.success && orgsResult.organizations) {
        setGitHubOrgs(orgsResult.organizations);
        for (const org of orgsResult.organizations) {
          try {
            const orgReposResult = await apiService.getGitHubOrgRepos(org.login);
            if (orgReposResult.success && orgReposResult.repositories) {
              // Add org repos to the collections
              allRepos = [...allRepos, ...orgReposResult.repositories];
              allGrouped[org.login] = orgReposResult.repositories;
            }
          } catch (error) {
            console.warn(`Failed to load repos for org ${org.login}:`, error);
          }
        }
      }

      // Set all repos and grouped repos at once
      setGitHubRepos(allRepos);
      setReposByOwner(allGrouped);

      if (!reposResult.success) {
        toast.error(reposResult.error || 'Failed to load GitHub repositories');
      }
    } catch (error) {
      console.error('Failed to load GitHub projects:', error);
      toast.error('Failed to load GitHub projects');
    } finally {
      setLoadingGitHub(false);
    }
  };

  const handleSelectRepo = (repoId: number) => {
    toggleRepoSelection(repoId);
  };

  const handleImportSelectedRepos = async () => {
    if (selectedRepos.size === 0) {
      toast.error('Please select at least one repository to import');
      return;
    }

    setIsCreatingProject(true);
    try {
      for (const repoId of selectedRepos) {
        // Search through all repos (both user repos and org repos)
        const repo = gitHubRepos.find(r => r.id === repoId);
        if (repo) {
          const scanResult = await apiService.scanGitUrl(repo.clone_url);
          if (scanResult.success) {
            const projectName = repo.name;
            await apiService.createProject(projectName, scanResult.tempPath);
            toast.success(`Project "${projectName}" imported successfully`);
          } else {
            toast.error(
              `Failed to scan repository "${repo.name}": ${scanResult.error || 'Unknown error'}`
            );
          }
        } else {
          console.warn(`Repository with ID ${repoId} not found in gitHubRepos`);
        }
      }
      refetchProjects();
      onClose();
      setSelectedRepos(new Set());
    } catch (error) {
      toast.error('Failed to import repositories');
      console.error('Import error:', error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex items-center justify-between flex-shrink-0">
        <h4 className="text-lg font-medium text-gray-900">Your GitHub Projects</h4>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleLoadGitHubProjects}
          disabled={isLoadingGitHub}
          leftIcon={
            isLoadingGitHub ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )
          }
        >
          {isLoadingGitHub ? 'Loading...' : 'Load Projects'}
        </Button>
      </div>

      {isLoadingGitHub && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600">Loading your GitHub projects...</p>
          </div>
        </div>
      )}

      {Object.keys(reposByOwner).length > 0 && !isLoadingGitHub && (
        <>
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-transparent">
              {Object.entries(reposByOwner).map(([owner, repos]) => (
                <div key={owner} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {owner.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-900">{owner}</h5>
                      <p className="text-xs text-gray-500">{repos.length} repositories</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {repos.map(repo => (
                      <div
                        key={repo.id}
                        className={cn(
                          'flex items-center gap-3 p-2 rounded border cursor-pointer transition-colors',
                          selectedRepos.has(repo.id)
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        )}
                        onClick={() => handleSelectRepo(repo.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedRepos.has(repo.id)}
                          onChange={e => e.stopPropagation()}
                          onClick={e => e.stopPropagation()}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 pointer-events-none"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h6 className="text-sm font-medium text-gray-900 truncate">
                              {repo.name}
                            </h6>
                            {repo.language && (
                              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                                {repo.language}
                              </span>
                            )}
                            {repo.private && (
                              <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-600 rounded">
                                Private
                              </span>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-xs text-gray-500 truncate mt-1">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
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
          </div>

          {selectedRepos.size > 0 && (
            <div className="border-t border-gray-200 pt-4 flex-shrink-0">
              <Button
                variant="primary"
                onClick={handleImportSelectedRepos}
                disabled={isCreatingProject}
                className="w-full"
                leftIcon={
                  isCreatingProject ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )
                }
              >
                {isCreatingProject
                  ? 'Importing Projects...'
                  : `Import ${selectedRepos.size} Selected Project${selectedRepos.size > 1 ? 's' : ''}`}
              </Button>
            </div>
          )}
        </>
      )}

      {!isLoadingGitHub && Object.keys(reposByOwner).length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <GitIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Projects Loaded</h4>
            <p className="text-sm text-gray-600 mb-4">
              Click "Load Projects" to fetch your GitHub repositories and organizations
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
