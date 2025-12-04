/**
 * WebSocket Query Synchronization Hook
 *
 * Listens to WebSocket events and automatically invalidates React Query caches
 * to ensure all pages stay in sync with real-time changes from CLI, agents, or other users.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
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

      // Map event types to query invalidations
      switch (eventType) {
        // Fragment/Entity CRUD operations - invalidate resolved spec and project list
        case "fragment_created":
        case "fragment_updated":
        case "fragment_deleted":
        case "entity_created":
        case "entity_updated":
        case "entity_deleted":
        case "entity_restored":
          queryClient.invalidateQueries({
            queryKey: ["resolved-spec", projectId],
            refetchType: "all",
          });
          queryClient.invalidateQueries({ queryKey: ["projects"], refetchType: "all" });
          queryClient.invalidateQueries({ queryKey: ["project", projectId], refetchType: "all" });
          queryClient.invalidateQueries({ queryKey: ["projects", projectId], refetchType: "all" });
          break;

        // Fragment revision - invalidate specs and revisions
        case "fragment_revision_created":
          queryClient.invalidateQueries({ queryKey: ["resolved-spec", projectId] });
          queryClient.invalidateQueries({ queryKey: ["fragments", projectId] });
          break;

        // Validation events - invalidate validation results
        case "validation_started":
        case "validation_completed":
        case "validation_failed":
          queryClient.invalidateQueries({ queryKey: ["resolved-spec", projectId] });
          queryClient.invalidateQueries({ queryKey: ["validation", projectId] });
          break;

        // Version management - invalidate versions and specs
        case "version_frozen":
          queryClient.invalidateQueries({ queryKey: ["versions", projectId] });
          queryClient.invalidateQueries({ queryKey: ["projects"] });
          break;

        // Git operations - invalidate project and specs
        case "git_push_processed":
        case "git_merge_processed":
          queryClient.invalidateQueries({ queryKey: ["resolved-spec", projectId] });
          queryClient.invalidateQueries({ queryKey: ["project", projectId] });
          queryClient.invalidateQueries({ queryKey: ["git-status", projectId] });
          break;

        // Event log operations - invalidate event history
        case "event_head_updated":
        case "events_reverted":
        case "events_reapplied":
          queryClient.invalidateQueries({ queryKey: ["events", projectId] });
          queryClient.invalidateQueries({ queryKey: ["resolved-spec", projectId] });
          break;

        // Connection events - mostly informational
        case "connection_established":
        case "subscription_confirmed":
        case "global_subscription_confirmed":
          break;

        // Ping/pong - no action
        case "ping":
        case "pong":
          break;

        default:
          console.warn("[WebSocket Query Sync] Unknown event type:", eventType);
          queryClient.invalidateQueries({ queryKey: ["resolved-spec", projectId] });
          queryClient.invalidateQueries({ queryKey: ["projects"] });
      }
    },
    [projectId, queryClient],
  );

  useWebSocketEvent("*", handleEvent);

  return {
    isConnected: connectionState === "connected",
    lastMessage: null,
  };
}
