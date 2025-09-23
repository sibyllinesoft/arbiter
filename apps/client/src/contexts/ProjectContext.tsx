/**
 * Project context for managing current project state
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import type { Project } from '../types/api';

interface ProjectContextValue {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  const value: ProjectContextValue = {
    currentProject,
    setCurrentProject,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useCurrentProject(): Project | null {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useCurrentProject must be used within a ProjectProvider');
  }
  return context.currentProject;
}

export function useSetCurrentProject(): (project: Project | null) => void {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useSetCurrentProject must be used within a ProjectProvider');
  }
  return context.setCurrentProject;
}
