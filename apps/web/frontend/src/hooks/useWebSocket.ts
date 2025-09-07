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

/**
 * Show notification for WebSocket updates
 */
function showUpdateNotification(user: string, timestamp: string): void {
  const time = new Date(timestamp).toLocaleTimeString();
  toast.info(`Updated by ${user} at ${time}`, {
    position: "top-right",
    autoClose: 3000,
  });
}

/**
 * Dispatch WebSocket event to appropriate handler
 */
function dispatchWebSocketEvent(event: WsEvent, dispatch: any): void {
  switch (event.type) {
    case "fragment_updated":
      handleFragmentUpdatedEvent(event.data as WsFragmentUpdatedData, dispatch);
      break;

    case "resolved_updated":
      handleResolvedUpdatedEvent(event.data as WsResolvedUpdatedData, dispatch);
      break;

    case "gaps_updated":
      handleGapsUpdatedEvent(event.data as WsGapsUpdatedData, dispatch);
      break;

    case "ir_updated":
      handleIrUpdatedEvent(event.data as WsIrUpdatedData, dispatch);
      break;

    default:
      console.warn("Unknown WebSocket event type:", event.type);
  }
}

/**
 * Handle fragment update events
 */
function handleFragmentUpdatedEvent(data: WsFragmentUpdatedData, dispatch: any): void {
  switch (data.operation) {
    case "created":
    case "updated":
      dispatch({ type: "UPDATE_FRAGMENT", payload: data.fragment });
      break;

    case "deleted":
      dispatch({ type: "DELETE_FRAGMENT", payload: data.fragment.id });
      break;
  }
}

/**
 * Handle resolved spec update events
 */
function handleResolvedUpdatedEvent(data: WsResolvedUpdatedData, dispatch: any): void {
  dispatch({
    type: "SET_RESOLVED",
    payload: {
      resolved: data.resolved,
      specHash: data.spec_hash,
    },
  });
}

/**
 * Handle gaps update events
 */
function handleGapsUpdatedEvent(data: WsGapsUpdatedData, dispatch: any): void {
  dispatch({ type: "SET_GAPS", payload: data.gaps });

  // Update spec hash if provided
  if (data.spec_hash) {
    dispatch({
      type: "SET_VALIDATION_STATE",
      payload: {
        errors: [],
        warnings: [],
        isValidating: false,
        lastValidation: null,
        specHash: data.spec_hash,
      },
    });
  }
}

/**
 * Handle IR update events
 */
function handleIrUpdatedEvent(data: WsIrUpdatedData, dispatch: any): void {
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
}

/**
 * Create WebSocket connection handlers
 */
function createWebSocketHandlers(params: {
  projectId: string;
  dispatch: any;
  setError: (error: string | null) => void;
  showToastNotifications: boolean;
  autoReconnect: boolean;
}) {
  const { projectId, dispatch, setError, showToastNotifications, autoReconnect } = params;

  return {
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
}

/**
 * Sync initial data from API
 */
/**
 * Fetch all initial project data in parallel with error handling
 */
async function fetchInitialProjectData(projectId: string) {
  return await Promise.all([
    apiService.getFragments(projectId),
    apiService.getResolvedSpec(projectId).catch(() => null),
    apiService.getGaps(projectId).catch(() => null),
    apiService.getAllIRs(projectId).catch(() => ({})),
  ]);
}

/**
 * Update fragments state
 */
function updateFragmentsState(dispatch: any, fragments: any) {
  dispatch({ type: "SET_FRAGMENTS", payload: fragments });
}

/**
 * Update resolved spec state if data exists
 */
function updateResolvedState(dispatch: any, resolved: any) {
  if (!resolved) {
    return;
  }

  dispatch({
    type: "SET_RESOLVED",
    payload: {
      resolved: resolved.resolved,
      specHash: resolved.spec_hash,
    },
  });
}

/**
 * Update gaps state if data exists
 */
function updateGapsState(dispatch: any, gaps: any) {
  if (!gaps) {
    return;
  }

  dispatch({ type: "SET_GAPS", payload: gaps });
}

/**
 * Update IR states for all kinds
 */
function updateIRsState(dispatch: any, irs: any) {
  Object.entries(irs).forEach(([kind, ir]) => {
    dispatch({ type: "SET_IR", payload: { kind, data: ir } });
  });
}

/**
 * Update last sync timestamp
 */
function updateLastSyncState(dispatch: any) {
  dispatch({ type: "SET_LAST_SYNC", payload: new Date().toISOString() });
}

/**
 * Update all project states with fetched data
 */
function updateProjectStates(dispatch: any, fragments: any, resolved: any, gaps: any, irs: any) {
  updateFragmentsState(dispatch, fragments);
  updateResolvedState(dispatch, resolved);
  updateGapsState(dispatch, gaps);
  updateIRsState(dispatch, irs);
  updateLastSyncState(dispatch);
}

/**
 * Handle sync error with logging and user notification
 */
function handleSyncError(error: unknown, setError: (error: string | null) => void) {
  console.error("Failed to sync initial data:", error);
  setError(error instanceof Error ? error.message : "Failed to sync data");
}

async function syncInitialProjectData(
  projectId: string,
  dispatch: any,
  setError: (error: string | null) => void,
  setLoading: (loading: boolean) => void,
) {
  try {
    setLoading(true);

    // Fetch all initial data in parallel
    const [fragments, resolved, gaps, irs] = await fetchInitialProjectData(projectId);

    // Update all states
    updateProjectStates(dispatch, fragments, resolved, gaps, irs);
  } catch (error) {
    handleSyncError(error, setError);
  } finally {
    setLoading(false);
  }
}

/**
 * Custom hook for WebSocket connection management
 */
function useWebSocketConnection(
  projectId: string | null,
  handleWebSocketEvent: WebSocketEventHandler,
  options: {
    showToastNotifications: boolean;
    autoReconnect: boolean;
    dispatch: any;
    setError: (error: string | null) => void;
  },
) {
  const { showToastNotifications, autoReconnect, dispatch, setError } = options;
  const eventHandlerRef = useRef<WebSocketEventHandler | null>(null);
  const lastProjectIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      return handleNoProject();
    }

    if (shouldSkipReconnection(projectId, lastProjectIdRef.current)) {
      return;
    }

    return setupWebSocketConnection({
      projectId,
      eventHandler: handleWebSocketEvent,
      eventHandlerRef,
      lastProjectIdRef,
      showToastNotifications,
      autoReconnect,
      dispatch,
      setError,
    });
  }, [projectId, handleWebSocketEvent, dispatch, setError, showToastNotifications, autoReconnect]);
}

/**
 * Handle the case when there's no project ID
 */
function handleNoProject() {
  const eventHandlerRef = useRef<WebSocketEventHandler | null>(null);
  const dispatch = useApp().dispatch;

  if (eventHandlerRef.current) {
    wsService.disconnect();
    eventHandlerRef.current = null;
    dispatch({ type: "SET_CONNECTION_STATUS", payload: false });
    dispatch({ type: "RESET_RECONNECT_ATTEMPTS" });
  }
  return;
}

/**
 * Check if WebSocket reconnection should be skipped
 */
function shouldSkipReconnection(projectId: string, lastProjectId: string | null): boolean {
  return projectId === lastProjectId && wsService.isConnected();
}

/**
 * Setup WebSocket connection with handlers
 */
function setupWebSocketConnection(params: {
  projectId: string;
  eventHandler: WebSocketEventHandler;
  eventHandlerRef: React.MutableRefObject<WebSocketEventHandler | null>;
  lastProjectIdRef: React.MutableRefObject<string | null>;
  showToastNotifications: boolean;
  autoReconnect: boolean;
  dispatch: any;
  setError: (error: string | null) => void;
}) {
  const {
    projectId,
    eventHandler,
    eventHandlerRef,
    lastProjectIdRef,
    showToastNotifications,
    autoReconnect,
    dispatch,
    setError,
  } = params;

  // Disconnect previous connection
  if (eventHandlerRef.current) {
    wsService.disconnect();
  }

  // Setup new connection
  eventHandlerRef.current = eventHandler;
  lastProjectIdRef.current = projectId;

  const unsubscribe = wsService.subscribe(eventHandlerRef.current);
  const handlers = createWebSocketHandlers({
    projectId,
    dispatch,
    setError,
    showToastNotifications,
    autoReconnect,
  });

  wsService.options = {
    ...wsService.options,
    ...handlers,
  };

  wsService.connect(projectId);

  return () => {
    unsubscribe();
    if (eventHandlerRef.current === eventHandler) {
      wsService.disconnect();
      eventHandlerRef.current = null;
    }
  };
}

/**
 * Custom hook for initial data synchronization
 */
function useInitialDataSync(
  projectId: string | null,
  isConnected: boolean,
  dispatch: any,
  setError: (error: string | null) => void,
  setLoading: (loading: boolean) => void,
) {
  useEffect(() => {
    if (!projectId || !isConnected) {
      return;
    }

    const performSync = async () => {
      await syncInitialProjectData(projectId, dispatch, setError, setLoading);
    };

    performSync();
  }, [projectId, isConnected, dispatch, setError, setLoading]);
}

export function useWebSocket(projectId: string | null, options: UseWebSocketOptions = {}) {
  const { state, dispatch, setError, setLoading } = useApp();
  const { autoReconnect = true, showToastNotifications = true } = options;

  // Handle WebSocket events
  const handleWebSocketEvent = useCallback(
    (event: WsEvent) => {
      console.log("WebSocket event received:", event);

      // Show toast notification
      if (showToastNotifications && event.user && event.user !== "current_user") {
        showUpdateNotification(event.user, event.timestamp);
      }

      // Delegate to specific event handlers
      dispatchWebSocketEvent(event, dispatch);

      // Update last sync time
      dispatch({ type: "SET_LAST_SYNC", payload: event.timestamp });
    },
    [dispatch, showToastNotifications],
  );

  // Use extracted hooks for specific concerns
  useWebSocketConnection(projectId, handleWebSocketEvent, {
    showToastNotifications,
    autoReconnect,
    dispatch,
    setError,
  });

  useInitialDataSync(projectId, state.isConnected, dispatch, setError, setLoading);

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