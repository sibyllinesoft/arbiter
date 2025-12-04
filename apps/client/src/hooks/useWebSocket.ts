import { useEffect, useMemo, useRef } from "react";
import { useWebSocketClient } from "../contexts/WebSocketContext";
import type { NormalizedWebSocketEvent } from "../services/websocket";

export function useWebSocketState() {
  const { state } = useWebSocketClient();
  return state;
}

export function useWebSocketInstance() {
  const { client } = useWebSocketClient();
  return client;
}

/**
 * Subscribe to one or many WebSocket event types.
 * Pass "*" to receive every event.
 */
export function useWebSocketEvent<T = unknown>(
  eventType: string | string[] | "*",
  handler: (event: NormalizedWebSocketEvent<T>) => void,
) {
  const { client } = useWebSocketClient();
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  const eventTypes = useMemo(
    () => (Array.isArray(eventType) ? eventType : [eventType]),
    [eventType],
  );

  useEffect(() => {
    const unsubscribers = eventTypes.map((type) =>
      client.on(type as "*" | string, (event) => handlerRef.current(event as any)),
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [client, eventTypes]);
}
