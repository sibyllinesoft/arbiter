/**
 * ProjectList - Displays a list of projects with entity badges and actions
 */

import React from 'react';
import { Server, Database, Component, Navigation, Workflow, Shield, Trash2 } from 'lucide-react';
import { Card, cn } from '../design-system';

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
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-6 animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[1, 2, 3, 4, 5, 6].map(j => (
                <div key={j} className="h-8 bg-gray-200 rounded"></div>
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
        <div className="text-gray-400 mb-4">
          <Server className="w-12 h-12 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects</h3>
        <p className="text-gray-600">Create your first project to get started</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-graphite-600">
      {projects.map(project => {
        const projectStatus = getProjectStatus(project);
        const isSelected = currentProject?.id === project.id;

        return (
          <div
            key={project.id}
            className={cn(
              'relative cursor-pointer transition-all duration-200 hover:bg-graphite-800',
              isSelected && 'bg-blue-600/10 border-l-4 border-l-blue-500'
            )}
            onClick={() => onSelectProject(project)}
          >
            {/* Project Header with Floating Badges */}
            <div className="flex items-start justify-between p-6">
              <div className="flex-1">
                <h3 className="text-2xl font-semibold text-graphite-25 mb-3">{project.name}</h3>

                {/* Entity Metrics - Floating with name */}
                {projectStatus && (
                  <div className="flex flex-wrap gap-2">
                    {projectStatus.entities.services > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-blue-500 rounded-md shadow-sm">
                        <Server className="w-3.5 h-3.5 text-blue-50" />
                        <span className="text-xs font-medium text-blue-50">
                          Services: {projectStatus.entities.services}
                        </span>
                      </div>
                    )}

                    {projectStatus.entities.databases > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-green-600 to-green-500 rounded-md shadow-sm">
                        <Database className="w-3.5 h-3.5 text-green-50" />
                        <span className="text-xs font-medium text-green-50">
                          Databases: {projectStatus.entities.databases}
                        </span>
                      </div>
                    )}

                    {projectStatus.entities.components > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-purple-500 rounded-md shadow-sm">
                        <Component className="w-3.5 h-3.5 text-purple-50" />
                        <span className="text-xs font-medium text-purple-50">
                          Components: {projectStatus.entities.components}
                        </span>
                      </div>
                    )}

                    {projectStatus.entities.routes > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-graphite-500 to-graphite-400 rounded-md shadow-sm">
                        <Navigation className="w-3.5 h-3.5 text-graphite-50" />
                        <span className="text-xs font-medium text-graphite-50">
                          Routes: {projectStatus.entities.routes}
                        </span>
                      </div>
                    )}

                    {projectStatus.entities.flows > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-gold-600 to-gold-500 rounded-md shadow-sm">
                        <Workflow className="w-3.5 h-3.5 text-gold-50" />
                        <span className="text-xs font-medium text-gold-50">
                          Flows: {projectStatus.entities.flows}
                        </span>
                      </div>
                    )}

                    {projectStatus.entities.capabilities > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-600 to-red-500 rounded-md shadow-sm">
                        <Shield className="w-3.5 h-3.5 text-red-50" />
                        <span className="text-xs font-medium text-red-50">
                          Capabilities: {projectStatus.entities.capabilities}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Delete Button */}
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={e => onDeleteProject(e, project.id)}
                  className="p-1 text-graphite-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                  title="Delete project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
