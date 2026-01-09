/**
 * Project context for managing current project state.
 * Provides global access to the currently selected project.
 */

import { type ReactNode, createContext, useContext, useState } from "react";
import type { Project } from "../types/api";

/** Context value for project state management */
interface ProjectContextValue {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

/** Props for the project provider component */
interface ProjectProviderProps {
  children: ReactNode;
}

/**
 * Provider component that wraps the app with project context.
 * @param props - Provider props with children
 */
export function ProjectProvider({ children }: ProjectProviderProps) {
  const [currentProject, setCurrentProject] = useState<Project | null>(null);

  const value: ProjectContextValue = {
    currentProject,
    setCurrentProject,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

/**
 * Hook to access the current project.
 * @returns Current project or null if none selected
 */
export function useCurrentProject(): Project | null {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useCurrentProject must be used within a ProjectProvider");
  }
  return context.currentProject;
}

/**
 * Hook to get the setter function for current project.
 * @returns Function to update the current project
 */
export function useSetCurrentProject(): (project: Project | null) => void {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useSetCurrentProject must be used within a ProjectProvider");
  }
  return context.setCurrentProject;
}
