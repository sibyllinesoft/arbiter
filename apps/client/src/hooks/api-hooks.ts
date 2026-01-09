/**
 * API hooks using React Query.
 * Provides data fetching, caching, and mutation hooks for API operations.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiService } from "../services/api";

/**
 * Fetch all projects.
 * @returns Query result with projects array
 */
export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => apiService.getProjects(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Fetch a single project by ID.
 * @param projectId - Project identifier
 * @returns Query result with project data
 */
export function useProject(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => apiService.getProject(projectId),
    enabled: !!projectId,
  });
}

/**
 * Fetch events for a project with optional filtering.
 * @param projectId - Project identifier
 * @param options - Query options (limit, includeDangling)
 * @returns Query result with events array
 */
export function useProjectEvents(
  projectId: string,
  options: { limit?: number; includeDangling?: boolean } = {},
) {
  const requestOptions: { limit?: number; includeDangling?: boolean } = {};

  if (options.limit !== undefined) {
    requestOptions.limit = options.limit;
  }

  if (options.includeDangling !== undefined) {
    requestOptions.includeDangling = options.includeDangling;
  }

  return useQuery({
    queryKey: [
      "project-events",
      projectId,
      requestOptions.limit ?? null,
      requestOptions.includeDangling ?? null,
    ],
    queryFn: () => apiService.getProjectEvents(projectId, requestOptions),
    enabled: !!projectId,
    refetchInterval: 5000,
  });
}

/**
 * Create a new project mutation.
 * @returns Mutation hook for creating projects
 */
export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => apiService.createProject(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/**
 * Delete a project mutation.
 * @returns Mutation hook for deleting projects
 */
export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => apiService.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/**
 * Set the event head for a project.
 * @param projectId - Project identifier
 * @returns Mutation hook for setting event head
 */
export function useSetEventHead(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (headEventId: string | null) =>
      apiService.setProjectEventHead(projectId, headEventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-events", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/**
 * Revert project events mutation.
 * @param projectId - Project identifier
 * @returns Mutation hook for reverting events
 */
export function useRevertProjectEvents(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventIds: string[]) => apiService.revertProjectEvents(projectId, eventIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-events", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/**
 * Fetch resolved spec for a project.
 * @param projectId - Project identifier
 * @returns Query result with resolved specification
 */
export function useResolvedSpec(projectId: string | null) {
  return useQuery({
    queryKey: ["resolved-spec", projectId],
    queryFn: () => apiService.getResolvedSpec(projectId!),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Health check hook for API connectivity.
 * @returns Query result with health status
 */
export function useHealthCheck() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiService.healthCheck(),
    refetchInterval: 30000, // Check every 30 seconds
    retry: 3,
  });
}

/**
 * Fetch UI option catalog for form fields.
 * @returns Query result with UI options
 */
export function useUiOptionCatalog() {
  return useQuery({
    queryKey: ["ui-options"],
    queryFn: () => apiService.getUiOptionCatalog(),
    staleTime: 1000 * 60 * 60, // 1 hour
  });
}
