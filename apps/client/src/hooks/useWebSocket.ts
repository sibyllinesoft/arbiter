/**
 * WebSocket hook for real-time updates
 */

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

interface WebSocketOptions {
  autoReconnect?: boolean;
  showToastNotifications?: boolean;
  reconnectDelay?: number;
  maxReconnectAttempts?: number;
}

interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: string;
  projectId?: string;
  data?: any;
  project_id?: string;
}

export function useWebSocket(projectId: string | null, options: WebSocketOptions = {}) {
  const {
    autoReconnect = true,
    showToastNotifications = false,
    reconnectDelay = 3000,
    maxReconnectAttempts = 5,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = () => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/events${projectId ? `?projectId=${projectId}` : ""}`;
      const ws = new WebSocket(wsUrl);

      // Handle immediate connection (if already open)
      if (ws.readyState === WebSocket.OPEN) {
        setIsConnected(true);
        setConnectionError(null);
        reconnectAttemptsRef.current = 0;

        if (showToastNotifications) {
          toast.success("Connected to real-time updates", {
            position: "bottom-right",
            autoClose: 2000,
          });
        }
      }

      ws.onopen = () => {
        // Add small delay to allow connection to stabilize
        setTimeout(() => {
          if (ws.readyState === WebSocket.OPEN) {
            setIsConnected(true);
            setConnectionError(null);
            reconnectAttemptsRef.current = 0;

            if (showToastNotifications) {
              toast.success("Connected to real-time updates", {
                position: "bottom-right",
                autoClose: 2000,
              });
            }
          }
        }, 100);
      };

      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          const normalized: WebSocketMessage = {
            ...raw,
            payload: raw.payload ?? raw.data ?? null,
            timestamp: raw.timestamp ?? new Date().toISOString(),
            projectId: raw.projectId ?? raw.project_id ?? projectId ?? undefined,
          };
          setLastMessage(normalized);

          // Show notifications for specific event types
          if (showToastNotifications) {
            switch (normalized.type) {
              case "webhook_received":
                toast.info("Webhook received", {
                  position: "bottom-right",
                  autoClose: 3000,
                });
                break;
              case "handler_executed":
                {
                  const success = normalized.payload?.success;
                  const handlerMessage = normalized.payload?.message || "Handler executed";
                  if (success) {
                    toast.success(handlerMessage, {
                      position: "bottom-right",
                      autoClose: 3000,
                    });
                  } else {
                    toast.error(handlerMessage, {
                      position: "bottom-right",
                      autoClose: 5000,
                    });
                  }
                }
                break;
              case "validation_completed":
                if (normalized.payload?.success) {
                  toast.success("Validation completed", {
                    position: "bottom-right",
                    autoClose: 2000,
                  });
                }
                break;
            }
          }
        } catch (error) {
          console.warn("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;

        if (autoReconnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;

          if (showToastNotifications) {
            toast.warning(
              `Connection lost. Reconnecting... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`,
              {
                position: "bottom-right",
                autoClose: 3000,
              },
            );
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectDelay);
        }
      };

      ws.onerror = (_error) => {
        // Only treat as error if we're not in a normal connecting state
        if (ws.readyState !== WebSocket.CONNECTING) {
          setConnectionError("WebSocket connection error");

          if (showToastNotifications) {
            toast.error("Real-time connection error", {
              position: "bottom-right",
              autoClose: 5000,
            });
          }
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      setConnectionError("Failed to establish connection");
    }
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  };

  const sendMessage = (message: any) => {
    if (wsRef.current && isConnected && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn(
        "WebSocket not ready for sending message, readyState:",
        wsRef.current?.readyState,
      );
    }
  };

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [projectId]); // Reconnect when project changes

  return {
    isConnected,
    lastMessage,
    connectionError,
    sendMessage,
    reconnect: connect,
    disconnect,
    reconnectAttempts: reconnectAttemptsRef.current,
  };
}
