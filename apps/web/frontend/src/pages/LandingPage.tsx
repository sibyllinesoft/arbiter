/**
 * Landing Page - Main dashboard for Arbiter web service
 */

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Activity,
  GitBranch,
  Database,
  Server,
  Layers,
  Zap,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Component,
  Navigation,
  Workflow,
  Shield,
  X,
  Upload,
  FileText,
  Code,
  Globe,
  Smartphone,
  Trash2,
  GitBranch as GitIcon,
  Link,
} from 'lucide-react';
import { Button, Card, StatusBadge, cn } from '../design-system';
import { useProjects, useHealthCheck, useDeleteProject } from '../hooks/api-hooks';
import { useWebSocket } from '../hooks/useWebSocket';
import { useCurrentProject, useSetCurrentProject } from '../contexts/ProjectContext';
import { useAppSettings, useUIState, useGitHubState } from '../contexts/AppContext';
import { apiService } from '../services/api';
import { toast } from 'react-toastify';
import { ProjectList, useUnifiedTabs } from '../components';
import Tabs from '../components/Layout/Tabs';
import arbiterLogo from '../assets/arbiter.webp';

interface LandingPageProps {
  onNavigateToConfig: () => void;
  onNavigateToProject: (project: any) => void;
}

export function LandingPage({ onNavigateToConfig, onNavigateToProject }: LandingPageProps) {
  const { data: projects, isLoading: projectsLoading, refetch: refetchProjects } = useProjects();
  const { data: health, isLoading: healthLoading } = useHealthCheck();
  const deleteProjectMutation = useDeleteProject();
  const currentProject = useCurrentProject();
  const setCurrentProject = useSetCurrentProject();
  const { settings } = useAppSettings();
  const { activeTab, gitUrl, setActiveTab, setGitUrl } = useUIState();

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [modalTab, setModalTab] = useState('git'); // 'git', 'github'

  // Debug modalTab changes
  useEffect(() => {
    console.log('modalTab changed to:', modalTab);
  }, [modalTab]);

  // WebSocket for real-time updates
  const { isConnected } = useWebSocket(currentProject?.id || null, {
    autoReconnect: true,
    showToastNotifications: settings.showNotifications,
  });

  const handleCreateProjectFromPreset = async (preset: any, projectName: string) => {
    setIsCreatingProject(true);
    try {
      // TODO: Implement preset-based project creation
      const newProject = await apiService.createProject(projectName);
      setCurrentProject(newProject);
      refetchProjects();
      setIsProjectModalOpen(false);
      toast.success(`Project "${newProject.name}" created from ${preset.name} preset`);
    } catch (error) {
      toast.error('Failed to create project');
      console.error('Failed to create project:', error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleScanGitUrl = async () => {
    if (!gitUrl.trim()) {
      toast.error('Please enter a valid Git URL');
      return;
    }

    setIsScanning(true);
    try {
      const result = await apiService.scanGitUrl(gitUrl);
      if (result.success) {
        setScanResult(result);
        toast.success('Repository scanned successfully');
      } else {
        toast.error(result.error || 'Failed to scan repository');
      }
    } catch (error) {
      toast.error('Failed to scan git repository');
      console.error('Git scan error:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const analyzeProjectStructure = (files: string[]) => {
    const hasPackageJson = files.some(f => f.toLowerCase().includes('package.json'));
    const hasCargoToml = files.some(f => f.toLowerCase().includes('cargo.toml'));
    const hasDockerfile = files.some(f => f.toLowerCase().includes('dockerfile'));
    const hasCueFiles = files.some(f => f.endsWith('.cue'));
    const hasYamlFiles = files.some(f => f.endsWith('.yaml') || f.endsWith('.yml'));
    const hasJsonFiles = files.some(f => f.endsWith('.json'));

    const importableFiles = files.filter(f => {
      const ext = f.split('.').pop()?.toLowerCase();
      return (
        ['cue', 'json', 'yaml', 'yml', 'toml'].includes(ext || '') ||
        ['package.json', 'cargo.toml', 'dockerfile'].some(pattern =>
          f.toLowerCase().includes(pattern)
        )
      );
    });

    return {
      hasPackageJson,
      hasCargoToml,
      hasDockerfile,
      hasCueFiles,
      hasYamlFiles,
      hasJsonFiles,
      importableFiles,
    };
  };

  const handleImportFromScan = async () => {
    if (!scanResult) return;

    setIsCreatingProject(true);
    try {
      // Use project name from scan result, or fallback logic
      let projectName: string;
      if (scanResult.projectName) {
        projectName = scanResult.projectName;
      } else if (scanResult.gitUrl) {
        projectName = scanResult.gitUrl.split('/').pop()?.replace('.git', '') || 'git-import';
      } else {
        projectName = scanResult.path || 'filesystem-import';
      }

      // For git scans, pass the temp path for brownfield detection
      // For local file selection, create project without path (browser security limitation)
      let projectPath: string | undefined;
      if (!scanResult.isLocalFileSelection && scanResult.tempPath) {
        projectPath = scanResult.tempPath;
      }

      console.log('Creating project:', {
        projectName,
        projectPath,
        isLocal: scanResult.isLocalFileSelection,
      });

      const newProject = await apiService.createProject(projectName, projectPath);

      console.log('Project created:', newProject);

      setCurrentProject(newProject);
      refetchProjects();
      setIsProjectModalOpen(false);

      // Clean up temp directory if it was created from git scan
      if (scanResult.tempPath && !scanResult.isLocalFileSelection) {
        try {
          const tempId = Buffer.from(scanResult.tempPath).toString('base64');
          await apiService.cleanupImport(tempId);
        } catch (cleanupError) {
          console.warn('Failed to cleanup temp directory:', cleanupError);
        }
      }

      const sourceType = scanResult.isLocalFileSelection ? 'local filesystem' : 'repository';
      const fileTypes = [];
      if (scanResult.projectStructure?.hasPackageJson) fileTypes.push('Node.js');
      if (scanResult.projectStructure?.hasCargoToml) fileTypes.push('Rust');
      if (scanResult.projectStructure?.hasDockerfile) fileTypes.push('Docker');
      if (scanResult.projectStructure?.hasCueFiles) fileTypes.push('CUE');
      const typeDescription = fileTypes.length > 0 ? fileTypes.join(', ') : 'mixed files';
      toast.success(`Project "${newProject.name}" created from ${sourceType} (${typeDescription})`);
    } catch (error) {
      toast.error('Failed to create project from scan');
      console.error('Import from scan error:', error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleSelectProject = (project: any) => {
    setCurrentProject(project);
    // Don't navigate to project view anymore, just select it
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation(); // Prevent project selection when clicking delete

    if (
      window.confirm('Are you sure you want to delete this project? This action cannot be undone.')
    ) {
      try {
        await deleteProjectMutation.mutateAsync(projectId);

        // If we deleted the current project, clear the selection
        if (currentProject?.id === projectId) {
          setCurrentProject(null);
        }

        toast.success('Project deleted successfully');
      } catch (error) {
        toast.error('Failed to delete project');
        console.error('Failed to delete project:', error);
      }
    }
  };

  // Get unified tabs
  const allTabs = useUnifiedTabs({ project: currentProject });

  // Auto-select first project if none selected, or clear if no projects exist
  useEffect(() => {
    if (projects) {
      if (projects.length === 0) {
        // No projects exist, ensure current project is cleared
        if (currentProject) {
          setCurrentProject(null);
        }
      } else if (!currentProject) {
        // Projects exist but none selected, select the first one
        setCurrentProject(projects[0]);
      } else {
        // Check if current project still exists in the projects list
        const currentProjectExists = projects.some(p => p.id === currentProject.id);
        if (!currentProjectExists) {
          // Current project was deleted, select first available or clear if none
          setCurrentProject(projects.length > 0 ? projects[0] : null);
        }
      }
    }
  }, [currentProject, projects, setCurrentProject]);

  const getProjectStatus = (project?: any) => {
    if (!project) return null;

    // Use entity counts from the API response - these are now calculated server-side
    const entities = project.entities || {
      services: 0,
      databases: 0,
      components: 0,
      routes: 0,
      flows: 0,
      capabilities: 0,
    };

    return {
      status: project.status || ('active' as const),
      entities,
      lastActivity: project.lastActivity || '2 minutes ago',
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg overflow-hidden">
                <img
                  src={arbiterLogo}
                  alt="Arbiter Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Arbiter</h1>
                <p className="text-sm text-gray-500">Infrastructure Management Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Config Button */}
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Settings className="w-4 h-4" />}
                onClick={onNavigateToConfig}
              >
                Config
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Full Width Layout */}
      <main className="h-[calc(100vh-4rem)] flex overflow-hidden">
        {/* Left Sidebar - Project List */}
        <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                Projects
              </h2>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setIsProjectModalOpen(true)}
              >
                New Project
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            <ProjectList
              projects={projects || []}
              currentProject={currentProject}
              onSelectProject={handleSelectProject}
              onDeleteProject={handleDeleteProject}
              getProjectStatus={getProjectStatus}
              isLoading={projectsLoading}
            />
          </div>
        </div>

        {/* Right Content - Unified Tabs */}
        <div className="flex-1 bg-white overflow-hidden">
          <Tabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={allTabs}
            className="h-full"
          />
        </div>
      </main>

      {/* Project Creation Modal */}
      {isProjectModalOpen && <ProjectCreationModal />}
    </div>
  );

  function ProjectCreationModal() {
    const [selectedPreset, setSelectedPreset] = useState<any>(null);
    const [projectName, setProjectName] = useState('');

    // GitHub state from global context
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

    const presets = [
      {
        id: 'web-app',
        name: 'Web Application',
        description: 'Full-stack web application with React frontend and Node.js backend',
        icon: Globe,
        color: 'blue',
        features: ['React Frontend', 'Node.js API', 'Database', 'Authentication'],
      },
      {
        id: 'mobile-app',
        name: 'Mobile Application',
        description: 'Cross-platform mobile app with React Native',
        icon: Smartphone,
        color: 'green',
        features: ['React Native', 'Push Notifications', 'Offline Support', 'App Store Ready'],
      },
      {
        id: 'api-service',
        name: 'API Service',
        description: 'RESTful API service with database integration',
        icon: Server,
        color: 'purple',
        features: ['REST API', 'Database Schema', 'Documentation', 'Testing'],
      },
      {
        id: 'microservice',
        name: 'Microservice',
        description: 'Containerized microservice with monitoring',
        icon: Component,
        color: 'orange',
        features: ['Docker', 'Health Checks', 'Metrics', 'Service Discovery'],
      },
    ];

    const handlePresetSelect = (preset: any) => {
      setSelectedPreset(preset);
      setProjectName(preset.name.replace(/\s+/g, '-').toLowerCase());
    };

    const handleCreateFromPreset = () => {
      if (selectedPreset && projectName.trim()) {
        handleCreateProjectFromPreset(selectedPreset, projectName.trim());
      }
    };

    const handleLoadGitHubProjects = async () => {
      console.log('Loading GitHub projects, modalTab:', modalTab);
      setLoadingGitHub(true);
      try {
        // Load user repos and organizations in parallel
        const [reposResult, orgsResult] = await Promise.all([
          apiService.getGitHubUserRepos(),
          apiService.getGitHubUserOrgs(),
        ]);

        if (reposResult.success && reposResult.repositories) {
          setGitHubRepos(reposResult.repositories);

          // Group repos by owner
          const grouped = reposResult.repositories.reduce(
            (acc, repo) => {
              const owner = repo.owner.login;
              if (!acc[owner]) {
                acc[owner] = [];
              }
              acc[owner].push(repo);
              return acc;
            },
            {} as Record<string, any[]>
          );

          setReposByOwner(grouped);
        }

        if (orgsResult.success && orgsResult.organizations) {
          setGitHubOrgs(orgsResult.organizations);

          // Load repos for each organization
          for (const org of orgsResult.organizations) {
            try {
              const orgReposResult = await apiService.getGitHubOrgRepos(org.login);
              if (orgReposResult.success && orgReposResult.repositories) {
                setReposByOwner(prev => ({
                  ...prev,
                  [org.login]: orgReposResult.repositories || [],
                }));
              }
            } catch (error) {
              console.warn(`Failed to load repos for org ${org.login}:`, error);
            }
          }
        }

        if (!reposResult.success) {
          toast.error(reposResult.error || 'Failed to load GitHub repositories');
        }
      } catch (error) {
        console.error('Failed to load GitHub projects:', error);
        toast.error('Failed to load GitHub projects');
      } finally {
        console.log('Finished loading GitHub projects, modalTab:', modalTab);
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
          const repo = gitHubRepos.find(r => r.id === repoId);
          if (repo) {
            // Use the existing scan and import functionality
            const scanResult = await apiService.scanGitUrl(repo.clone_url);
            if (scanResult.success) {
              const projectName = repo.name;
              await apiService.createProject(projectName, scanResult.tempPath);
              toast.success(`Project "${projectName}" imported successfully`);
            }
          }
        }

        refetchProjects();
        setIsProjectModalOpen(false);
        setSelectedRepos(new Set());
      } catch (error) {
        toast.error('Failed to import repositories');
        console.error('Import error:', error);
      } finally {
        setIsCreatingProject(false);
      }
    };

    function GitHubProjectsTab() {
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

          {Object.keys(reposByOwner).length > 0 && (
            <>
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 overflow-y-auto space-y-4 pr-2">
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
                              onChange={() => handleSelectRepo(repo.id)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
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
                                <span>
                                  Updated {new Date(repo.updated_at).toLocaleDateString()}
                                </span>
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

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
          <div className="p-6 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Create New Project</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsProjectModalOpen(false);
                  setModalTab('git'); // Reset to default tab
                }}
                leftIcon={<X className="w-4 h-4" />}
              >
                Close
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 min-h-[500px] flex-1 min-h-0">
            {/* Left Side - Create from Preset */}
            <div className="p-6 border-r border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Create from Preset
              </h3>

              <div className="space-y-3 mb-6">
                {presets.map(preset => (
                  <div
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    className={cn(
                      'p-4 border rounded-lg cursor-pointer transition-all',
                      selectedPreset?.id === preset.id
                        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'p-2 rounded-lg',
                          preset.color === 'blue' && 'bg-blue-100 text-blue-600',
                          preset.color === 'green' && 'bg-green-100 text-green-600',
                          preset.color === 'purple' && 'bg-purple-100 text-purple-600',
                          preset.color === 'orange' && 'bg-orange-100 text-orange-600'
                        )}
                      >
                        <preset.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{preset.name}</h4>
                        <p className="text-sm text-gray-600 mt-1">{preset.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {preset.features.map(feature => (
                            <span
                              key={feature}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {selectedPreset && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={e => setProjectName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter project name..."
                    />
                  </div>
                  <Button
                    variant="primary"
                    onClick={handleCreateFromPreset}
                    disabled={!projectName.trim() || isCreatingProject}
                    className="w-full"
                  >
                    {isCreatingProject ? 'Creating...' : `Create ${selectedPreset.name}`}
                  </Button>
                </div>
              )}
            </div>

            {/* Right Side - Import Project */}
            <div className="p-6 flex flex-col h-full overflow-hidden">
              <div className="flex-shrink-0">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Import Project
                </h3>

                {/* Import Tabs */}
                <div className="mb-6">
                  <div className="flex border-b border-gray-200 mb-4">
                    <button
                      onClick={() => setModalTab('git')}
                      className={cn(
                        'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
                        modalTab === 'git'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      )}
                    >
                      <GitIcon className="w-4 h-4 inline mr-2" />
                      Git URL
                    </button>
                    <button
                      onClick={() => setModalTab('github')}
                      className={cn(
                        'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
                        modalTab === 'github'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      )}
                    >
                      <GitIcon className="w-4 h-4 inline mr-2" />
                      GitHub Projects
                    </button>
                  </div>
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 min-h-0 overflow-hidden">
                {modalTab === 'git' && (
                  <div className="space-y-4 h-full overflow-y-auto">
                    <div className="border-2 border-dashed rounded-lg p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <GitIcon className="w-8 h-8 text-gray-400" />
                        <div>
                          <h4 className="text-lg font-medium text-gray-900">
                            Clone from Git Repository
                          </h4>
                          <p className="text-sm text-gray-600">
                            Enter a GitHub, GitLab, or other Git repository URL
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <input
                          type="url"
                          value={gitUrl}
                          onChange={e => setGitUrl(e.target.value)}
                          placeholder="https://github.com/user/repo.git"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <Button
                          variant="secondary"
                          onClick={handleScanGitUrl}
                          disabled={!gitUrl.trim() || isScanning}
                          className="w-full"
                          leftIcon={
                            isScanning ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Link className="w-4 h-4" />
                            )
                          }
                        >
                          {isScanning ? 'Scanning Repository...' : 'Scan Repository'}
                        </Button>
                      </div>
                    </div>

                    {/* Scan Results */}
                    {scanResult && (
                      <div className="border border-green-200 bg-green-50 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <h4 className="font-medium text-green-900">
                            Repository Scanned Successfully
                          </h4>
                        </div>

                        <div className="space-y-2 text-sm">
                          <p className="text-green-800">
                            <strong>Detected Files:</strong>{' '}
                            {(() => {
                              const types = [];
                              if (scanResult.projectStructure?.hasPackageJson)
                                types.push('Node.js');
                              if (scanResult.projectStructure?.hasCargoToml) types.push('Rust');
                              if (scanResult.projectStructure?.hasDockerfile) types.push('Docker');
                              if (scanResult.projectStructure?.hasCueFiles) types.push('CUE');
                              if (scanResult.projectStructure?.hasYamlFiles) types.push('YAML');
                              if (scanResult.projectStructure?.hasJsonFiles) types.push('JSON');
                              return types.length > 0
                                ? types.join(', ')
                                : 'Various configuration files';
                            })()}
                          </p>
                          <p className="text-green-800">
                            <strong>Files Found:</strong> {scanResult.files?.length || 0}
                          </p>
                          <p className="text-green-800">
                            <strong>Importable Files:</strong>{' '}
                            {scanResult.projectStructure?.importableFiles?.length || 0}
                          </p>
                          {scanResult.projectStructure?.performanceMetrics && (
                            <p className="text-green-800">
                              <strong>Scan Method:</strong>{' '}
                              {scanResult.projectStructure.performanceMetrics.usedGitLsFiles
                                ? 'Git ls-files (fast)'
                                : 'Directory scan'}
                              {scanResult.projectStructure.performanceMetrics.usedGitLsFiles &&
                                ' ⚡'}
                            </p>
                          )}
                        </div>

                        <Button
                          variant="primary"
                          onClick={handleImportFromScan}
                          disabled={isCreatingProject}
                          className="w-full mt-4"
                        >
                          {isCreatingProject
                            ? 'Creating Project...'
                            : 'Create Project from Repository'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {modalTab === 'github' && (
                  <div className="h-full">
                    <GitHubProjectsTab />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
