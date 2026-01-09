/**
 * @module ArchitectureDiagram/hooks/useArchitectureDiagramData
 * Hook for fetching and managing architecture diagram data.
 * Handles project data loading, UI option catalog, and optimistic updates.
 */

import { DEFAULT_UI_OPTION_CATALOG, type UiOptionCatalog } from "@/components/modals/entityTypes";
import { apiService } from "@/services/api";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { computeTaskOptions, syncOptimisticRemovals } from "./architectureDiagramUtils";

/**
 * Return type for the useArchitectureDiagramData hook.
 */
export interface ArchitectureDiagramDataResult {
  projectData: any;
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  optimisticRemovals: Set<string>;
  toggleOptimisticRemoval: (artifactId: string, shouldAdd: boolean) => void;
  refreshProjectData: (options?: { silent?: boolean }) => Promise<void>;
  optionCatalogWithTasks: UiOptionCatalog;
  queryClient: ReturnType<typeof useQueryClient>;
}

/**
 * Hook for managing architecture diagram data.
 * @param projectId - The project ID to fetch data for
 * @returns Data and utilities for the architecture diagram
 */
export function useArchitectureDiagramData(projectId: string): ArchitectureDiagramDataResult {
  const [projectData, setProjectData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uiOptionCatalog, setUiOptionCatalog] =
    useState<UiOptionCatalog>(DEFAULT_UI_OPTION_CATALOG);
  const [optimisticRemovals, setOptimisticRemovals] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const toggleOptimisticRemoval = useCallback((artifactId: string, shouldAdd: boolean) => {
    setOptimisticRemovals((prev) => {
      const next = new Set(prev);
      if (shouldAdd) {
        next.add(artifactId);
      } else {
        next.delete(artifactId);
      }
      return next;
    });
  }, []);

  const refreshProjectData = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!projectId) {
        setProjectData(null);
        setError(null);
        if (!silent) {
          setLoading(false);
        }
        return;
      }

      try {
        if (!silent) {
          setLoading(true);
        }
        setError(null);
        const result = await apiService.getResolvedSpec(projectId);
        setProjectData(result.resolved);
      } catch (err: any) {
        if (err.status === 404 || err.message?.includes("404")) {
          setProjectData(null);
          setError("Project not found or has been deleted");
          console.warn(`Project ${projectId} not found - likely deleted`);
        } else {
          setError(err instanceof Error ? err.message : "Failed to fetch project data");
          console.error("Failed to fetch project data:", err);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [projectId],
  );

  // Fetch project data on mount
  useEffect(() => {
    refreshProjectData();
  }, [refreshProjectData]);

  // Fetch UI option catalog
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const options = await apiService.getUiOptionCatalog();
        if (!mounted || !options) return;

        setUiOptionCatalog((prev) => {
          const nextCatalog: UiOptionCatalog = { ...options } as UiOptionCatalog;
          if (!nextCatalog.serviceFrameworks) {
            nextCatalog.serviceFrameworks = {};
          }
          return nextCatalog;
        });
      } catch (error) {
        console.warn("[ArchitectureDiagram] failed to load UI option catalog", error);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Compute task options from project data
  const { openTaskOptions, groupSelectionOptions } = useMemo(
    () => computeTaskOptions(projectData),
    [projectData],
  );

  const optionCatalogWithTasks = useMemo<UiOptionCatalog>(
    () => ({
      ...uiOptionCatalog,
      groupIssueOptions: openTaskOptions,
      issueGroupOptions: groupSelectionOptions,
    }),
    [uiOptionCatalog, openTaskOptions, groupSelectionOptions],
  );

  // Sync optimistic removals with project data
  useEffect(() => {
    if (!projectData || optimisticRemovals.size === 0) {
      return;
    }
    setOptimisticRemovals((prev) => syncOptimisticRemovals(projectData, prev));
  }, [projectData, optimisticRemovals.size]);

  return {
    projectData,
    loading,
    error,
    setError,
    optimisticRemovals,
    toggleOptimisticRemoval,
    refreshProjectData,
    optionCatalogWithTasks,
    queryClient,
  };
}
