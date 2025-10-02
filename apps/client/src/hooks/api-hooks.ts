/**
 * API hooks using React Query
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import type { CreateHandlerRequest, UpdateHandlerRequest } from '../types/api';

// Project hooks
export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiService.getProjects(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['projects', projectId],
    queryFn: () => apiService.getProject(projectId),
    enabled: !!projectId,
  });
}

export function useProjectEvents(
  projectId: string,
  options: { limit?: number; includeDangling?: boolean } = {}
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
      'project-events',
      projectId,
      requestOptions.limit ?? null,
      requestOptions.includeDangling ?? null,
    ],
    queryFn: () => apiService.getProjectEvents(projectId, requestOptions),
    enabled: !!projectId,
    refetchInterval: 5000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => apiService.createProject(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => apiService.deleteProject(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useSetEventHead(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (headEventId: string | null) =>
      apiService.setProjectEventHead(projectId, headEventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-events', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useRevertProjectEvents(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventIds: string[]) => apiService.revertProjectEvents(projectId, eventIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-events', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useResolvedSpec(projectId: string | null) {
  return useQuery({
    queryKey: ['resolved-spec', projectId],
    queryFn: () => apiService.getResolvedSpec(projectId!),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

// Handler hooks
export function useHandlers() {
  return useQuery({
    queryKey: ['handlers'],
    queryFn: () => apiService.getHandlers(),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useHandler(handlerId: string) {
  return useQuery({
    queryKey: ['handlers', handlerId],
    queryFn: () => apiService.getHandler(handlerId),
    enabled: !!handlerId,
  });
}

export function useCreateHandler() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateHandlerRequest) => apiService.createHandler(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handlers'] });
    },
  });
}

export function useUpdateHandler() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ handlerId, request }: { handlerId: string; request: UpdateHandlerRequest }) =>
      apiService.updateHandler(handlerId, request),
    onSuccess: (_, { handlerId }) => {
      queryClient.invalidateQueries({ queryKey: ['handlers'] });
      queryClient.invalidateQueries({ queryKey: ['handlers', handlerId] });
    },
  });
}

export function useDeleteHandler() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (handlerId: string) => apiService.deleteHandler(handlerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['handlers'] });
    },
  });
}

export function useToggleHandler() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ handlerId, enabled }: { handlerId: string; enabled: boolean }) =>
      apiService.toggleHandler(handlerId, enabled),
    onSuccess: (_, { handlerId }) => {
      queryClient.invalidateQueries({ queryKey: ['handlers'] });
      queryClient.invalidateQueries({ queryKey: ['handlers', handlerId] });
    },
  });
}

// Health check hook
export function useHealthCheck() {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiService.healthCheck(),
    refetchInterval: 30000, // Check every 30 seconds
    retry: 3,
  });
}
