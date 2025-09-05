/**
 * React hook for WebSocket integration with app state
 */

import { useCallback, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { useApp } from "../contexts/AppContext";
import { apiService } from "../services/api";
import { type WebSocketEventHandler, wsService } from "../services/websocket";
import type {
  WsEvent,
  WsFragmentUpdatedData,
  WsGapsUpdatedData,
  WsIrUpdatedData,
  WsResolvedUpdatedData,
} from "../types/api";

export interface UseWebSocketOptions {
  autoReconnect?: boolean;
  showToastNotifications?: boolean;
}

export function useWebSocket(projectId: string | null, options: UseWebSocketOptions = {}) {
  const { state, dispatch, setError, setLoading } = useApp();

  const { autoReconnect = true, showToastNotifications = true } = options;

  const eventHandlerRef = useRef<WebSocketEventHandler | null>(null);
  const lastProjectIdRef = useRef<string | null>(null);

  // Handle WebSocket events
  const handleWebSocketEvent = useCallback(
    (event: WsEvent) => {
      console.log("WebSocket event received:", event);

      // Show toast notification
      if (showToastNotifications && event.user && event.user !== "current_user") {
        const timestamp = new Date(event.timestamp).toLocaleTimeString();
        toast.info(`Updated by ${event.user} at ${timestamp}`, {
          position: "top-right",
          autoClose: 3000,
        });
      }

      // Handle different event types
      switch (event.type) {
        case "fragment_updated":
          handleFragmentUpdated(event.data as WsFragmentUpdatedData);
          break;

        case "resolved_updated":
          handleResolvedUpdated(event.data as WsResolvedUpdatedData);
          break;

        case "gaps_updated":
          handleGapsUpdated(event.data as WsGapsUpdatedData);
          break;

        case "ir_updated":
          handleIrUpdated(event.data as WsIrUpdatedData);
          break;

        default:
          console.warn("Unknown WebSocket event type:", event.type);
      }

      // Update last sync time
      dispatch({ type: "SET_LAST_SYNC", payload: event.timestamp });
    },
    [
      dispatch,
      showToastNotifications,
      handleFragmentUpdated,
      handleGapsUpdated,
      handleIrUpdated,
      handleResolvedUpdated,
    ],
  );

  // Handle fragment updates
  const handleFragmentUpdated = useCallback(
    (data: WsFragmentUpdatedData) => {
      switch (data.operation) {
        case "created":
        case "updated":
          dispatch({ type: "UPDATE_FRAGMENT", payload: data.fragment });
          break;

        case "deleted":
          dispatch({ type: "DELETE_FRAGMENT", payload: data.fragment.id });
          break;
      }
    },
    [dispatch],
  );

  // Handle resolved spec updates
  const handleResolvedUpdated = useCallback(
    (data: WsResolvedUpdatedData) => {
      dispatch({
        type: "SET_RESOLVED",
        payload: {
          resolved: data.resolved,
          specHash: data.spec_hash,
        },
      });
    },
    [dispatch],
  );

  // Handle gaps updates
  const handleGapsUpdated = useCallback(
    (data: WsGapsUpdatedData) => {
      dispatch({ type: "SET_GAPS", payload: data.gaps });

      // Update spec hash if provided
      if (data.spec_hash) {
        dispatch({
          type: "SET_VALIDATION_STATE",
          payload: {
            errors: state.validationErrors,
            warnings: state.validationWarnings,
            isValidating: state.isValidating,
            lastValidation: state.lastValidation,
            specHash: data.spec_hash,
          },
        });
      }
    },
    [
      dispatch,
      state.validationErrors,
      state.validationWarnings,
      state.isValidating,
      state.lastValidation,
    ],
  );

  // Handle IR updates
  const handleIrUpdated = useCallback(
    (data: WsIrUpdatedData) => {
      dispatch({
        type: "SET_IR",
        payload: {
          kind: data.kind,
          data: {
            kind: data.kind,
            data: data.data,
            generated_at: new Date().toISOString(),
          },
        },
      });
    },
    [dispatch],
  );

  // Connect to WebSocket when project changes
  useEffect(() => {
    if (!projectId) {
      if (eventHandlerRef.current) {
        // Disconnect if no project
        wsService.disconnect();
        eventHandlerRef.current = null;
        dispatch({ type: "SET_CONNECTION_STATUS", payload: false });
        dispatch({ type: "RESET_RECONNECT_ATTEMPTS" });
      }
      return;
    }

    // Don't reconnect if same project
    if (projectId === lastProjectIdRef.current && wsService.isConnected()) {
      return;
    }

    // Disconnect previous connection
    if (eventHandlerRef.current) {
      wsService.disconnect();
    }

    // Create new event handler
    eventHandlerRef.current = handleWebSocketEvent;
    lastProjectIdRef.current = projectId;

    // Set up WebSocket with connection handlers
    const unsubscribe = wsService.subscribe(eventHandlerRef.current);

    // Configure WebSocket options
    wsService.options = {
      ...wsService.options,
      onConnect: () => {
        console.log("WebSocket connected for project:", projectId);
        dispatch({ type: "SET_CONNECTION_STATUS", payload: true });
        dispatch({ type: "RESET_RECONNECT_ATTEMPTS" });
        setError(null);

        if (showToastNotifications) {
          toast.success("Connected to real-time updates", {
            position: "bottom-right",
            autoClose: 2000,
          });
        }
      },
      onDisconnect: () => {
        console.log("WebSocket disconnected");
        dispatch({ type: "SET_CONNECTION_STATUS", payload: false });

        if (showToastNotifications && autoReconnect) {
          toast.warning("Lost connection, attempting to reconnect...", {
            position: "bottom-right",
            autoClose: 3000,
          });
        }
      },
      onReconnect: (attempt: number) => {
        console.log(`WebSocket reconnect attempt ${attempt}`);
        dispatch({ type: "INCREMENT_RECONNECT_ATTEMPTS" });

        if (showToastNotifications) {
          toast.info(`Reconnecting... (attempt ${attempt})`, {
            position: "bottom-right",
            autoClose: 2000,
          });
        }
      },
      onError: (error: Event) => {
        console.error("WebSocket error:", error);
        const errorMessage = "WebSocket connection error";
        setError(errorMessage);

        if (showToastNotifications) {
          toast.error(errorMessage, {
            position: "bottom-right",
            autoClose: 5000,
          });
        }
      },
    };

    // Connect to WebSocket
    wsService.connect(projectId);

    // Cleanup on unmount or project change
    return () => {
      unsubscribe();
      if (eventHandlerRef.current === handleWebSocketEvent) {
        wsService.disconnect();
        eventHandlerRef.current = null;
      }
    };
  }, [projectId, handleWebSocketEvent, dispatch, setError, showToastNotifications, autoReconnect]);

  // Sync initial data when connection is established
  useEffect(() => {
    if (!projectId || !state.isConnected) {
      return;
    }

    let cancelled = false;

    const syncInitialData = async () => {
      try {
        setLoading(true);

        // Fetch all initial data in parallel
        const [fragments, resolved, gaps, irs] = await Promise.all([
          apiService.getFragments(projectId),
          apiService.getResolvedSpec(projectId).catch(() => null),
          apiService.getGaps(projectId).catch(() => null),
          apiService.getAllIRs(projectId).catch(() => ({})),
        ]);

        if (cancelled) return;

        // Update state
        dispatch({ type: "SET_FRAGMENTS", payload: fragments });

        if (resolved) {
          dispatch({
            type: "SET_RESOLVED",
            payload: {
              resolved: resolved.resolved,
              specHash: resolved.spec_hash,
            },
          });
        }

        if (gaps) {
          dispatch({ type: "SET_GAPS", payload: gaps });
        }

        // Update IRs
        Object.entries(irs).forEach(([kind, ir]) => {
          dispatch({ type: "SET_IR", payload: { kind, data: ir } });
        });

        dispatch({ type: "SET_LAST_SYNC", payload: new Date().toISOString() });
      } catch (error) {
        if (cancelled) return;

        console.error("Failed to sync initial data:", error);
        setError(error instanceof Error ? error.message : "Failed to sync data");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    syncInitialData();

    return () => {
      cancelled = true;
    };
  }, [projectId, state.isConnected, dispatch, setError, setLoading]);

  // Return connection status and utilities
  return {
    isConnected: state.isConnected,
    reconnectAttempts: state.reconnectAttempts,
    lastSync: state.lastSync,

    // Manual control methods
    connect: () => projectId && wsService.connect(projectId),
    disconnect: () => wsService.disconnect(),

    // Send message through WebSocket
    send: wsService.send.bind(wsService),
  };
}
