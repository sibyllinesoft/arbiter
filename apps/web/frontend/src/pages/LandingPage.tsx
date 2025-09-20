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
} from 'lucide-react';
import { Button, Card, StatusBadge, cn } from '../design-system';
import { useProjects, useHealthCheck } from '../hooks/api-hooks';
import { useWebSocket } from '../hooks/useWebSocket';
import { useCurrentProject, useSetCurrentProject } from '../contexts/ProjectContext';
import { ActionLog } from '../components/ActionLog';
import { apiService } from '../services/api';
import { toast } from 'react-toastify';

interface LandingPageProps {
  onNavigateToConfig: () => void;
}

export function LandingPage({ onNavigateToConfig }: LandingPageProps) {
  const { data: projects, isLoading: projectsLoading, refetch: refetchProjects } = useProjects();
  const { data: health, isLoading: healthLoading } = useHealthCheck();
  const currentProject = useCurrentProject();
  const setCurrentProject = useSetCurrentProject();

  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // WebSocket for real-time updates
  const { isConnected, lastMessage } = useWebSocket(currentProject?.id || null, {
    autoReconnect: true,
    showToastNotifications: true,
  });

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;

    setIsCreatingProject(true);
    try {
      const newProject = await apiService.createProject(newProjectName.trim());
      setCurrentProject(newProject);
      setNewProjectName('');
      refetchProjects();
      toast.success(`Project "${newProject.name}" created successfully`);
    } catch (error) {
      toast.error('Failed to create project');
      console.error('Failed to create project:', error);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleSelectProject = (project: any) => {
    setCurrentProject(project);
    toast.info(`Switched to project "${project.name}"`);
  };

  // Auto-select first project if none selected
  useEffect(() => {
    if (!currentProject && projects && projects.length > 0) {
      setCurrentProject(projects[0]);
    }
  }, [currentProject, projects, setCurrentProject]);

  const getProjectStatus = () => {
    if (!currentProject) return null;

    // This would typically come from validation/health checks
    return {
      status: 'active' as const,
      services: 3,
      databases: 1,
      infrastructure: 'configured',
      lastActivity: '2 minutes ago',
    };
  };

  const projectStatus = getProjectStatus();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
                <Layers className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Arbiter</h1>
                <p className="text-sm text-gray-500">Infrastructure Management Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <StatusBadge
                variant={isConnected ? 'success' : 'error'}
                size="sm"
                icon={
                  isConnected ? <Zap className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />
                }
              >
                {isConnected ? 'Connected' : 'Disconnected'}
              </StatusBadge>

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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Project Selector & Status */}
          <div className="lg:col-span-1 space-y-6">
            {/* Project Selector */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <GitBranch className="w-5 h-5" />
                  Projects
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<RefreshCw className="w-4 h-4" />}
                  onClick={() => refetchProjects()}
                  disabled={projectsLoading}
                >
                  Refresh
                </Button>
              </div>

              {/* Create New Project */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New project name..."
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyDown={e => e.key === 'Enter' && handleCreateProject()}
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus className="w-4 h-4" />}
                    onClick={handleCreateProject}
                    disabled={!newProjectName.trim() || isCreatingProject}
                  >
                    Create
                  </Button>
                </div>
              </div>

              {/* Project List */}
              <div className="space-y-2">
                {projectsLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">Loading projects...</p>
                  </div>
                ) : projects && projects.length > 0 ? (
                  projects.map(project => (
                    <button
                      key={project.id}
                      onClick={() => handleSelectProject(project)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border transition-all duration-200',
                        'hover:border-blue-300 hover:bg-blue-50',
                        currentProject?.id === project.id
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                          : 'border-gray-200 bg-white'
                      )}
                    >
                      <div className="font-medium text-gray-900">{project.name}</div>
                      <div className="text-sm text-gray-500">{project.id}</div>
                      {currentProject?.id === project.id && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
                          <CheckCircle className="w-3 h-3" />
                          Current project
                        </div>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <GitBranch className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No projects yet</p>
                    <p className="text-xs">Create your first project above</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Project Status */}
            {currentProject && projectStatus && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Project Status</h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Overall Status</span>
                    <StatusBadge variant="success" size="sm">
                      {projectStatus.status === 'active' ? 'Active' : 'Inactive'}
                    </StatusBadge>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <Server className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                      <div className="text-lg font-semibold text-blue-900">
                        {projectStatus.services}
                      </div>
                      <div className="text-xs text-blue-600">Services</div>
                    </div>

                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <Database className="w-6 h-6 text-green-600 mx-auto mb-1" />
                      <div className="text-lg font-semibold text-green-900">
                        {projectStatus.databases}
                      </div>
                      <div className="text-xs text-green-600">Databases</div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Last Activity</span>
                      <span className="text-gray-900 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {projectStatus.lastActivity}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* System Health */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">System Health</h3>

              {healthLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Checking health...</p>
                </div>
              ) : health ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">API Server</span>
                    <StatusBadge variant="success" size="sm">
                      Online
                    </StatusBadge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">WebSocket</span>
                    <StatusBadge variant={isConnected ? 'success' : 'error'} size="sm">
                      {isConnected ? 'Connected' : 'Disconnected'}
                    </StatusBadge>
                  </div>
                  <div className="text-xs text-gray-500 pt-2 border-t border-gray-200">
                    Last checked: {new Date(health.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ) : (
                <div className="text-center py-4 text-red-600">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2" />
                  <p className="text-sm">Health check failed</p>
                </div>
              )}
            </Card>
          </div>

          {/* Right Column - Action Log */}
          <div className="lg:col-span-2">
            <ActionLog projectId={currentProject?.id || null} lastWebSocketMessage={lastMessage} />
          </div>
        </div>
      </main>
    </div>
  );
}
