import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createWebSocketClient, wsClient as sharedClient } from "../services/websocket";
import type { ConnectionState, WebSocketClient } from "../services/websocket";
import { useCurrentProject } from "./ProjectContext";

interface WebSocketContextValue {
  client: WebSocketClient;
  state: ConnectionState;
}

const WebSocketContext = createContext<WebSocketContextValue | undefined>(undefined);

interface WebSocketProviderProps {
  children: React.ReactNode;
  /**
   * Optional: allow overriding the shared singleton (useful for tests or storybook)
   */
  client?: WebSocketClient;
}

export function WebSocketProvider({ children, client }: WebSocketProviderProps) {
  const [wsClient] = useState<WebSocketClient>(
    () => client ?? sharedClient ?? createWebSocketClient(),
  );
  const [state, setState] = useState<ConnectionState>(wsClient.state.current);
  const currentProject = useCurrentProject();

  // Keep connection state in sync
  useEffect(() => {
    const unsubscribe = wsClient.onState(setState);
    return unsubscribe;
  }, [wsClient]);

  // Connect on mount and disconnect on unmount
  useEffect(() => {
    wsClient.connect(currentProject?.id ?? null);
    return () => {
      wsClient.disconnect();
    };
  }, [wsClient, currentProject?.id]);

  // Update project subscription when it changes without recreating the client
  useEffect(() => {
    wsClient.setProject(currentProject?.id ?? null);
    if (wsClient.state.current === "disconnected") {
      wsClient.connect(currentProject?.id ?? null);
    }
  }, [currentProject?.id, wsClient]);

  const value = useMemo(
    () => ({
      client: wsClient,
      state,
    }),
    [wsClient, state],
  );

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

export function useWebSocketClient(): WebSocketContextValue {
  const ctx = useContext(WebSocketContext);
  if (!ctx) {
    throw new Error("useWebSocketClient must be used within a WebSocketProvider");
  }
  return ctx;
}
