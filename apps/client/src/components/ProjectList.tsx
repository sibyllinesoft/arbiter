/**
 * ProjectList - Displays a list of projects with entity badges and actions
 */

import {
  Component,
  Database,
  Eye,
  Layout,
  Navigation,
  Server,
  Shield,
  Terminal,
  Trash2,
  Workflow,
} from "lucide-react";
import React from "react";
import { Badge, Card, cn } from "../design-system";

interface ProjectListProps {
  projects: any[];
  currentProject: any;
  onSelectProject: (project: any) => void;
  onDeleteProject: (e: React.MouseEvent, projectId: string) => void;
  getProjectStatus: (project: any) => any;
  isLoading?: boolean;
}

export function ProjectList({
  projects,
  currentProject,
  onSelectProject,
  onDeleteProject,
  getProjectStatus,
  isLoading = false,
}: ProjectListProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[1, 2, 3, 4, 5, 6].map((j) => (
                <div key={j} className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="text-gray-400 dark:text-gray-500 mb-4">
          <Server className="w-12 h-12 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Projects</h3>
        <p className="text-gray-600 dark:text-gray-400">Create your first project to get started</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-600 dark:divide-gray-700">
      {projects.map((project) => {
        const projectStatus = getProjectStatus(project);
        const isSelected = currentProject?.id === project.id;

        return (
          <div
            key={project.id}
            className={cn(
              "relative cursor-pointer transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700",
              isSelected &&
                "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500 dark:border-l-blue-400",
            )}
            onClick={() => onSelectProject(project)}
          >
            {/* Project Header with Floating Badges */}
            <div className="p-6">
              {/* Project Header Row: Name and Delete Icon */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-2xl font-semibold text-gray-900/70 dark:text-gray-100/70 flex-1">
                  {project.name}
                </h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteProject(e, project.id);
                  }}
                  className="p-1 text-black/40 dark:text-white/40 hover:text-red-400 hover:bg-red-500/10 dark:hover:text-red-300 dark:hover:bg-red-900/20 rounded transition-colors ml-4"
                  title="Delete project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Entity Metrics - Below the name */}
              {projectStatus && (
                <div className="flex flex-wrap gap-2">
                  {projectStatus.entities.services > 0 && (
                    <Badge
                      variant="default"
                      className="bg-blue-500 dark:bg-blue-600 text-white/70 dark:text-white/70 border-blue-700 dark:border-blue-800"
                    >
                      <Server className="w-3.5 h-3.5 mr-1 text-white/70 dark:text-white/70" />
                      <span className="text-xs font-medium text-white/70 dark:text-white/70">
                        Services:{" "}
                        <span className="text-white dark:text-white">
                          {projectStatus.entities.services}
                        </span>
                      </span>
                    </Badge>
                  )}

                  {projectStatus.entities.modules > 0 && (
                    <Badge
                      variant="default"
                      className="bg-purple-500 dark:bg-purple-600 text-white/70 dark:text-white/70 border-purple-700 dark:border-purple-800"
                    >
                      <Component className="w-3.5 h-3.5 mr-1 text-white/70 dark:text-white/70" />
                      <span className="text-xs font-medium text-white/70 dark:text-white/70">
                        Modules:{" "}
                        <span className="text-white dark:text-white">
                          {projectStatus.entities.modules}
                        </span>
                      </span>
                    </Badge>
                  )}

                  {projectStatus.entities.tools > 0 && (
                    <Badge
                      variant="default"
                      className="bg-red-500 dark:bg-red-600 text-white/70 dark:text-white/70 border-red-700 dark:border-red-800"
                    >
                      <Terminal className="w-3.5 h-3.5 mr-1 text-white/70 dark:text-white/70" />
                      <span className="text-xs font-medium text-white/70 dark:text-white/70">
                        Tools:{" "}
                        <span className="text-white dark:text-white">
                          {projectStatus.entities.tools}
                        </span>
                      </span>
                    </Badge>
                  )}

                  {projectStatus.entities.frontends > 0 && (
                    <Badge
                      variant="default"
                      className="bg-teal-500 dark:bg-teal-600 text-white/70 dark:text-white/70 border-teal-700 dark:border-teal-800"
                    >
                      <Layout className="w-3.5 h-3.5 mr-1 text-white/70 dark:text-white/70" />
                      <span className="text-xs font-medium text-white/70 dark:text-white/70">
                        Frontends:{" "}
                        <span className="text-white dark:text-white">
                          {projectStatus.entities.frontends}
                        </span>
                      </span>
                    </Badge>
                  )}

                  {projectStatus.entities.views > 0 && (
                    <Badge
                      variant="default"
                      className="bg-[#725718] dark:bg-[#5D4614] text-white/70 dark:text-white/70 border-[#5D4614] dark:border-[#3D2E0C]"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1 text-white/70 dark:text-white/70" />
                      <span className="text-xs font-medium text-white/70 dark:text-white/70">
                        Views:{" "}
                        <span className="text-white dark:text-white">
                          {projectStatus.entities.views}
                        </span>
                      </span>
                    </Badge>
                  )}

                  {projectStatus.entities.databases > 0 && (
                    <Badge
                      variant="default"
                      className="bg-amber-500 dark:bg-amber-600 text-white/70 dark:text-white/70 border-amber-700 dark:border-amber-800"
                    >
                      <Database className="w-3.5 h-3.5 mr-1 text-white/70 dark:text-white/70" />
                      <span className="text-xs font-medium text-white/70 dark:text-white/70">
                        Databases:{" "}
                        <span className="text-white dark:text-white">
                          {projectStatus.entities.databases}
                        </span>
                      </span>
                    </Badge>
                  )}

                  {projectStatus.entities.infrastructure > 0 && (
                    <Badge
                      variant="default"
                      className="bg-emerald-500 dark:bg-emerald-600 text-white/70 dark:text-white/70 border-emerald-700 dark:border-emerald-800"
                    >
                      <Shield className="w-3.5 h-3.5 mr-1 text-white/70 dark:text-white/70" />
                      <span className="text-xs font-medium text-white/70 dark:text-white/70">
                        Infrastructure:{" "}
                        <span className="text-white dark:text-white">
                          {projectStatus.entities.infrastructure}
                        </span>
                      </span>
                    </Badge>
                  )}

                  {projectStatus.entities.routes > 0 && (
                    <Badge
                      variant="default"
                      className="bg-indigo-500 dark:bg-indigo-600 text-white/70 dark:text-white/70 border-indigo-700 dark:border-indigo-800"
                    >
                      <Navigation className="w-3.5 h-3.5 mr-1 text-white/70 dark:text-white/70" />
                      <span className="text-xs font-medium text-white/70 dark:text-white/70">
                        Routes:{" "}
                        <span className="text-white dark:text-white">
                          {projectStatus.entities.routes}
                        </span>
                      </span>
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
