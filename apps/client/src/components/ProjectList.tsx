/**
 * ProjectList - Displays a list of projects with entity badges and actions
 */

import {
  Component,
  Database,
  Layout,
  Navigation,
  Server,
  Shield,
  Terminal,
  Trash2,
  Workflow,
} from 'lucide-react';
import React from 'react';
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
    <div className="divide-y divide-gray-600 dark:divide-gray-700">
      {projects.map(project => {
        const projectStatus = getProjectStatus(project);
        const isSelected = currentProject?.id === project.id;

        return (
          <div
            key={project.id}
            className={cn(
              'relative cursor-pointer transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700',
              isSelected &&
                'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500 dark:border-l-blue-400'
            )}
            onClick={() => onSelectProject(project)}
          >
            {/* Project Header with Floating Badges */}
            <div className="p-6">
              {/* Project Header Row: Name and Delete Icon */}
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 flex-1">
                  {project.name}
                </h3>
                <button
                  onClick={e => onDeleteProject(e, project.id)}
                  className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-400 hover:bg-red-500/10 dark:hover:bg-red-900/20 rounded transition-colors ml-4"
                  title="Delete project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Entity Metrics - Below the name */}
              {projectStatus && (
                <div className="flex flex-wrap gap-2">
                  {projectStatus.entities.services > 0 && (
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md shadow-sm"
                      style={{ backgroundColor: '#3E82B6', borderColor: '#1E466B' }}
                    >
                      <Server className="w-3.5 h-3.5 text-white" />
                      <span className="text-xs font-medium text-white">
                        Services: {projectStatus.entities.services}
                      </span>
                    </div>
                  )}

                  {projectStatus.entities.libraries > 0 && (
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md shadow-sm"
                      style={{ backgroundColor: '#7666B9', borderColor: '#3A2A70' }}
                    >
                      <Component className="w-3.5 h-3.5 text-white" />
                      <span className="text-xs font-medium text-white">
                        Libraries: {projectStatus.entities.libraries}
                      </span>
                    </div>
                  )}

                  {projectStatus.entities.clis > 0 && (
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md shadow-sm"
                      style={{ backgroundColor: '#BA5956', borderColor: '#803131' }}
                    >
                      <Terminal className="w-3.5 h-3.5 text-white" />
                      <span className="text-xs font-medium text-white">
                        CLI: {projectStatus.entities.clis}
                      </span>
                    </div>
                  )}

                  {projectStatus.entities.frontends > 0 && (
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md shadow-sm"
                      style={{ backgroundColor: '#45A190', borderColor: '#1D6A5B' }}
                    >
                      <Layout className="w-3.5 h-3.5 text-white" />
                      <span className="text-xs font-medium text-white">
                        Frontends: {projectStatus.entities.frontends}
                      </span>
                    </div>
                  )}

                  {projectStatus.entities.databases > 0 && (
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md shadow-sm"
                      style={{ backgroundColor: '#A6842A', borderColor: '#725718' }}
                    >
                      <Database className="w-3.5 h-3.5 text-white" />
                      <span className="text-xs font-medium text-white">
                        Databases: {projectStatus.entities.databases}
                      </span>
                    </div>
                  )}

                  {projectStatus.entities.modules > 0 && (
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md shadow-sm"
                      style={{ backgroundColor: '#6B7280', borderColor: '#374151' }}
                    >
                      <Component className="w-3.5 h-3.5 text-white" />
                      <span className="text-xs font-medium text-white">
                        Modules: {projectStatus.entities.modules}
                      </span>
                    </div>
                  )}

                  {projectStatus.entities.infrastructure > 0 && (
                    <div
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md shadow-sm"
                      style={{ backgroundColor: '#059669', borderColor: '#047857' }}
                    >
                      <Server className="w-3.5 h-3.5 text-white" />
                      <span className="text-xs font-medium text-white">
                        Infrastructure: {projectStatus.entities.infrastructure}
                      </span>
                    </div>
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
