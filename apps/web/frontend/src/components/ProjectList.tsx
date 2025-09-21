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
      <Card className="p-12 text-center">
        <div className="text-gray-400 mb-4">
          <Server className="w-12 h-12 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects</h3>
        <p className="text-gray-600">Create your first project to get started</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {projects.map(project => {
        const projectStatus = getProjectStatus(project);
        const isSelected = currentProject?.id === project.id;

        return (
          <Card
            key={project.id}
            className={cn(
              'relative p-6 cursor-pointer transition-all duration-200 hover:shadow-md',
              isSelected && 'ring-2 ring-blue-500 bg-blue-50'
            )}
            onClick={() => onSelectProject(project)}
          >
            {/* Project Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-gray-900">{project.name}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={e => onDeleteProject(e, project.id)}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                  title="Delete project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Entity Metrics */}
            {projectStatus && (
              <div className="flex flex-wrap gap-2 mb-4">
                {projectStatus.entities.services > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 rounded-md">
                    <Server className="w-3.5 h-3.5 text-blue-600" />
                    <span className="text-xs font-medium text-blue-900">
                      Services: {projectStatus.entities.services}
                    </span>
                  </div>
                )}

                {projectStatus.entities.databases > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded-md">
                    <Database className="w-3.5 h-3.5 text-green-600" />
                    <span className="text-xs font-medium text-green-900">
                      Databases: {projectStatus.entities.databases}
                    </span>
                  </div>
                )}

                {projectStatus.entities.components > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-purple-50 rounded-md">
                    <Component className="w-3.5 h-3.5 text-purple-600" />
                    <span className="text-xs font-medium text-purple-900">
                      Components: {projectStatus.entities.components}
                    </span>
                  </div>
                )}

                {projectStatus.entities.routes > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-indigo-50 rounded-md">
                    <Navigation className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="text-xs font-medium text-indigo-900">
                      Routes: {projectStatus.entities.routes}
                    </span>
                  </div>
                )}

                {projectStatus.entities.flows > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow-50 rounded-md">
                    <Workflow className="w-3.5 h-3.5 text-yellow-600" />
                    <span className="text-xs font-medium text-yellow-900">
                      Flows: {projectStatus.entities.flows}
                    </span>
                  </div>
                )}

                {projectStatus.entities.capabilities > 0 && (
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-red-50 rounded-md">
                    <Shield className="w-3.5 h-3.5 text-red-600" />
                    <span className="text-xs font-medium text-red-900">
                      Capabilities: {projectStatus.entities.capabilities}
                    </span>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
