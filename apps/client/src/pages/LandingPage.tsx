/**
 * Landing Page - Main dashboard for Arbiter web service
 */

import arbiterLogo from '@assets/arbiter.webp';
import { useUIState } from '@contexts/AppContext';
import { useCurrentProject, useSetCurrentProject } from '@contexts/ProjectContext';
import { Button } from '@design-system';
import { useDeleteProject, useProjects } from '@hooks/api-hooks';
import { GitBranch, Plus, Settings } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { ProjectList, useUnifiedTabs } from '../components';
// @ts-ignore
import { ConfigModal } from '../components/ConfigModal';
import Tabs from '../components/Layout/Tabs';
import { ProjectCreationModal } from '../components/ProjectCreation';

export function LandingPage() {
  const navigate = useNavigate();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const deleteProjectMutation = useDeleteProject();
  const currentProject = useCurrentProject();
  const setCurrentProject = useSetCurrentProject();
  const { activeTab, setActiveTab } = useUIState();

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const handleSelectProject = (project: any) => {
    setCurrentProject(project);
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (
      window.confirm('Are you sure you want to delete this project? This action cannot be undone.')
    ) {
      try {
        await deleteProjectMutation.mutateAsync(projectId);
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

  const allTabs = useUnifiedTabs({ project: currentProject });

  useEffect(() => {
    if (projects) {
      if (projects.length === 0) {
        if (currentProject) setCurrentProject(null);
      } else if (!currentProject && projects?.[0]) {
        setCurrentProject(projects[0]);
      } else {
        const currentProjectExists = currentProject
          ? projects.some(p => p.id === currentProject.id)
          : false;
        if (!currentProjectExists) {
          setCurrentProject(projects?.[0] ?? null);
        }
      }
    }
  }, [currentProject, projects, setCurrentProject]);

  const getProjectStatus = (project?: any) => {
    if (!project) return null;
    const entities = project.entities || {
      services: 0,
      databases: 0,
      libraries: 0,
      clis: 0,
      frontends: 0,
      external: 0,
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
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Settings className="w-6 h-6" />}
                onClick={() => setIsConfigModalOpen(true)}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="h-[calc(100vh-4rem)] flex overflow-hidden">
        <div className="w-72 flex-shrink-0 bg-white border-r border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
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

        <div className="flex-1 bg-white overflow-hidden">
          <Tabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            tabs={allTabs}
            className="h-full"
          />
        </div>
      </main>

      {isProjectModalOpen && (
        <ProjectCreationModal
          onClose={() => setIsProjectModalOpen(false)}
          onNavigateToProject={project => {
            setCurrentProject(project);
            navigate(`/project/${project.id}`);
          }}
        />
      )}
      {isConfigModalOpen && <ConfigModal onClose={() => setIsConfigModalOpen(false)} />}
    </div>
  );
}
