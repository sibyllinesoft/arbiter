/**
 * Landing Page - Main dashboard for Arbiter web service
 */

import arbiterLogo from "@assets/arbiter.webp";
import { useUIState } from "@contexts/AppContext";
import { useCurrentProject, useSetCurrentProject } from "@contexts/ProjectContext";
import { Button } from "@design-system";
import { useDeleteProject, useProjects } from "@hooks/api-hooks";
import { useWebSocketQuerySync } from "@hooks/useWebSocketQuerySync";
import { GitBranch, Plus, Settings } from "lucide-react";
import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { ProjectList, useUnifiedTabs } from "../components";
import Tabs from "../components/Layout/Tabs";
import { ProjectCreationModal } from "../components/ProjectCreation";
// @ts-ignore
import { ConfigModal } from "../components/io/ConfigModal";

interface LandingPageProps {
  onNavigateToConfig?: () => void;
}

/** Handle project selection after deletion */
function selectNextProject(
  deletedId: string,
  currentProjectId: string | undefined,
  updatedProjects: any[],
  setCurrentProject: (p: any) => void,
  navigate: (path: string, options?: { replace?: boolean }) => void,
  locationPath: string,
): void {
  if (currentProjectId !== deletedId) return;

  if (updatedProjects.length > 0) {
    const nextProject = updatedProjects[0];
    setCurrentProject(nextProject ?? null);
    if (nextProject && locationPath.startsWith("/project")) {
      navigate(`/project/${nextProject.id}`, { replace: true });
    }
  } else {
    setCurrentProject(null);
    if (locationPath.startsWith("/project")) {
      navigate("/", { replace: true });
    }
  }
}

export function LandingPage({ onNavigateToConfig }: LandingPageProps) {
  const navigate = useNavigate();
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const deleteProjectMutation = useDeleteProject();
  const currentProject = useCurrentProject();
  const setCurrentProject = useSetCurrentProject();
  const { activeTab, setActiveTab } = useUIState();
  const location = useLocation();

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const handleSelectProject = (project: any) => {
    setCurrentProject(project);
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      "Are you sure you want to delete this project? This action cannot be undone.",
    );
    if (!confirmed) return;

    try {
      await deleteProjectMutation.mutateAsync(projectId);
      const updatedProjects = (projects || []).filter((project) => project.id !== projectId);
      selectNextProject(
        projectId,
        currentProject?.id,
        updatedProjects,
        setCurrentProject,
        navigate,
        location.pathname,
      );
      toast.success("Project deleted successfully");
    } catch (error) {
      toast.error("Failed to delete project");
      console.error("Failed to delete project:", error);
    }
  };

  const handleSettingsProject = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    const project = projects?.find((p) => p.id === projectId);
    if (project) {
      setCurrentProject(project);
      navigate(`/project/${projectId}`);
    }
  };

  const allTabs = useUnifiedTabs({ project: currentProject });

  // Enable real-time updates for current project (if any)
  // This keeps the landing page tabs in sync when changes are made via CLI or agents
  useWebSocketQuerySync({
    projectId: currentProject?.id || null,
    showToastNotifications: false, // Quieter on landing page
  });

  useEffect(() => {
    if (!projects) return;

    if (projects.length === 0) {
      if (currentProject) {
        setCurrentProject(null);
        if (location.pathname.startsWith("/project")) {
          navigate("/", { replace: true });
        }
      }
      return;
    }

    const currentProjectExists = currentProject
      ? projects.some((project) => project.id === currentProject.id)
      : false;

    if (!currentProjectExists) {
      const nextProject = projects[0];
      if (nextProject) {
        setCurrentProject(nextProject);
        if (location.pathname.startsWith("/project")) {
          navigate(`/project/${nextProject.id}`, { replace: true });
        }
      }
    }
  }, [currentProject, location.pathname, navigate, projects, setCurrentProject]);

  const getProjectStatus = (project?: any) => {
    if (!project) return null;
    const entities = project.entities || {
      services: 0,
      databases: 0,
      modules: 0,
      infrastructure: 0,
      tools: 0,
      frontends: 0,
      views: 0,
      external: 0,
      routes: 0,
      flows: 0,
      capabilities: 0,
    };
    return {
      status: project.status || ("active" as const),
      entities,
      lastActivity: project.lastActivity || "2 minutes ago",
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-graphite-950 dark:to-graphite-900">
      <header className="bg-white dark:bg-graphite-950 border-b border-gray-200 dark:border-graphite-700 shadow-sm">
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
                <h1 className="text-xl font-semibold text-gray-900 dark:text-graphite-25">
                  Arbiter
                </h1>
                <p className="text-sm text-gray-500 dark:text-graphite-400">
                  Infrastructure Management Dashboard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="md"
                leftIcon={
                  <Settings className="w-4 h-4 text-[rgb(80_97_122/var(--tw-text-opacity,1))]" />
                }
                onClick={() => {
                  setIsConfigModalOpen(true);
                  onNavigateToConfig?.();
                }}
                className="w-6 h-6 p-1 border border-gray-200 rounded-lg hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              />
            </div>
          </div>
        </div>
      </header>

      <main className="h-[calc(100vh-4rem)] flex overflow-hidden">
        <div className="w-72 flex-shrink-0 bg-white dark:bg-graphite-900 border-r border-gray-200 dark:border-graphite-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-graphite-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-graphite-25 flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                Projects
              </h2>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => setIsProjectModalOpen(true)}
                className="!px-5 !py-1"
              >
                Add
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-trackless">
            <ProjectList
              projects={projects || []}
              currentProject={currentProject}
              onSelectProject={handleSelectProject}
              onDeleteProject={handleDeleteProject}
              onSettingsProject={handleSettingsProject}
              getProjectStatus={getProjectStatus}
              isLoading={projectsLoading}
            />
          </div>
        </div>

        <div className="flex-1 bg-white dark:bg-graphite-950 overflow-hidden">
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
          onNavigateToProject={(project) => {
            setCurrentProject(project);
            navigate(`/project/${project.id}`);
          }}
        />
      )}
      {isConfigModalOpen && <ConfigModal onClose={() => setIsConfigModalOpen(false)} />}
    </div>
  );
}
