/**
 * WebSocket Query Synchronization Hook
 *
 * Listens to WebSocket events and automatically invalidates React Query caches
 * to ensure all pages stay in sync with real-time changes from CLI, agents, or other users.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { NormalizedWebSocketEvent } from "../services/websocket";
import { useWebSocketEvent, useWebSocketState } from "./useWebSocket";

interface UseWebSocketQuerySyncOptions {
  projectId: string | null;
  showToastNotifications?: boolean;
}

/**
 * Hook that synchronizes React Query cache with WebSocket events
 *
 * This ensures all UI components automatically update when:
 * - CLI makes changes to the project
 * - AI agents modify specs
 * - Other users make edits
 * - Background processes complete (validation, git operations, etc.)
 */
export function useWebSocketQuerySync({
  projectId,
  showToastNotifications = false,
}: UseWebSocketQuerySyncOptions) {
  const queryClient = useQueryClient();
  const connectionState = useWebSocketState();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _notifications = showToastNotifications; // kept for future use, currently unused

  const invalidateProjectCaches = useCallback(
    (id: string) => {
      queryClient.invalidateQueries({
        queryKey: ["resolved-spec", id],
        refetchType: "all",
      });
      queryClient.invalidateQueries({ queryKey: ["projects"], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["project", id], refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: ["projects", id], refetchType: "all" });
    },
    [queryClient],
  );

  const invalidateValidation = useCallback(
    (id: string) => {
      queryClient.invalidateQueries({ queryKey: ["resolved-spec", id] });
      queryClient.invalidateQueries({ queryKey: ["validation", id] });
    },
    [queryClient],
  );

  const invalidateGit = useCallback(
    (id: string) => {
      queryClient.invalidateQueries({ queryKey: ["resolved-spec", id] });
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["git-status", id] });
    },
    [queryClient],
  );

  const invalidateEvents = useCallback(
    (id: string) => {
      queryClient.invalidateQueries({ queryKey: ["events", id] });
      queryClient.invalidateQueries({ queryKey: ["resolved-spec", id] });
    },
    [queryClient],
  );

  const registry = useMemo<
    Record<NormalizedWebSocketEvent["type"], (targetProjectId: string) => void>
  >(
    () => ({
      project_created: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
      project_deleted: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
      fragment_created: (id) => invalidateProjectCaches(id),
      fragment_updated: (id) => invalidateProjectCaches(id),
      fragment_deleted: (id) => invalidateProjectCaches(id),
      entity_created: (id) => invalidateProjectCaches(id),
      entity_updated: (id) => invalidateProjectCaches(id),
      entity_deleted: (id) => invalidateProjectCaches(id),
      entity_restored: (id) => invalidateProjectCaches(id),
      fragment_revision_created: (id) => {
        queryClient.invalidateQueries({ queryKey: ["resolved-spec", id] });
        queryClient.invalidateQueries({ queryKey: ["fragments", id] });
      },
      validation_started: (id) => invalidateValidation(id),
      validation_completed: (id) => invalidateValidation(id),
      validation_failed: (id) => invalidateValidation(id),
      version_frozen: (id) => {
        queryClient.invalidateQueries({ queryKey: ["versions", id] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
      },
      git_push_processed: (id) => invalidateGit(id),
      git_merge_processed: (id) => invalidateGit(id),
      event_head_updated: (id) => invalidateEvents(id),
      events_reverted: (id) => invalidateEvents(id),
      events_reapplied: (id) => invalidateEvents(id),
      connection_established: () => {},
      subscription_confirmed: () => {},
      global_subscription_confirmed: () => {},
      ping: () => {},
      pong: () => {},
    }),
    [invalidateEvents, invalidateGit, invalidateProjectCaches, invalidateValidation, queryClient],
  );

  const handleEvent = useCallback(
    (message: NormalizedWebSocketEvent) => {
      const eventType = message.type;
      const targetProjectId = message.projectId ?? projectId ?? undefined;

      // Handle global events that don't require a projectId
      if (eventType === "project_created" || eventType === "project_deleted") {
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        return;
      }

      if (!projectId || !targetProjectId || targetProjectId !== projectId) {
        return;
      }

      const handler = registry[eventType];
      if (handler) {
        handler(targetProjectId);
      } else {
        console.warn("[WebSocket Query Sync] Unknown event type:", eventType);
        queryClient.invalidateQueries({ queryKey: ["resolved-spec", projectId] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
    },
    [projectId, queryClient, registry],
  );

  useWebSocketEvent("*", handleEvent);

  return {
    isConnected: connectionState === "connected",
    lastMessage: null,
  };
}
