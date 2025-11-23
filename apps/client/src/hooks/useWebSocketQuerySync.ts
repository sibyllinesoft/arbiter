/**
 * WebSocket Query Synchronization Hook
 *
 * Listens to WebSocket events and automatically invalidates React Query caches
 * to ensure all pages stay in sync with real-time changes from CLI, agents, or other users.
 */

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useWebSocket } from "./useWebSocket";

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

  const { isConnected, lastMessage } = useWebSocket(projectId, {
    autoReconnect: true,
    showToastNotifications,
  });

  useEffect(() => {
    if (!lastMessage || !projectId) return;

    const eventType = lastMessage.type;
    const eventData = lastMessage.data || lastMessage.payload;

    console.debug("[WebSocket Query Sync]", { eventType, eventData, projectId });

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
        queryClient.invalidateQueries({ queryKey: ["resolved-spec", projectId] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
        queryClient.invalidateQueries({ queryKey: ["project", projectId] });
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
        // No cache invalidation needed
        break;

      // Ping/pong - no action
      case "ping":
      case "pong":
        break;

      default:
        console.warn("[WebSocket Query Sync] Unknown event type:", eventType);
        // For unknown events, defensively invalidate common queries
        queryClient.invalidateQueries({ queryKey: ["resolved-spec", projectId] });
        queryClient.invalidateQueries({ queryKey: ["projects"] });
    }
  }, [lastMessage, projectId, queryClient]);

  return {
    isConnected,
    lastMessage,
  };
}
