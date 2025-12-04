### Phase 1: Core Service Refactor (The Singleton Truth)

The goal is to make `WebSocketService` the robust engine that handles the raw socket, heartbeats, and reconnection logic. It should expose an event bus for the rest of the app.

**Refactor `src/services/websocket.ts`:**
1.  **State Machine:** Implement a proper connection state machine (Disconnected -> Connecting -> Connected -> Reconnecting).
2.  **Event Emitter Pattern:** Instead of a single callback set, allow subscribing to specific message types or channels.
3.  **Message Queue:** If the socket is not open, queue outgoing messages and flush them upon reconnection.
4.  **Heartbeat Logic:** Move the ping/pong logic entirely inside this class so the UI doesn't care about it.

**Proposed Interface:**
```typescript
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

class WebSocketClient {
  // Observable state
  public readonly state: BehaviorSubject<ConnectionState>; 
  
  constructor(private url: string, private options: WebSocketOptions) {}

  connect();
  disconnect();
  
  // Subscribe to specific event types (e.g., 'validation_completed', 'tunnel_log')
  on<T>(eventType: string, callback: (data: T) => void): UnsubscribeFunction;
  
  // Send data (queues if disconnected)
  send(type: string, payload: any);
}
```

### Phase 2: The React Context Layer

Stop initializing WebSockets inside hooks. Initialize them *once* at the top level and pass the instance down.

**Create `src/contexts/WebSocketContext.tsx`:**
1.  Instantiate the `WebSocketClient` here.
2.  Handle the lifecycle (connect on mount, disconnect on unmount).
3.  Expose the `WebSocketClient` instance and the current `connectionState` to children.

```tsx
// Conceptual implementation
export const WebSocketProvider = ({ children, projectId }) => {
  const [client] = useState(() => new WebSocketClient(getWsUrl(projectId)));
  
  useEffect(() => {
    if (projectId) client.connect();
    return () => client.disconnect();
  }, [projectId, client]);

  return (
    <WebSocketContext.Provider value={client}>
      {children}
    </WebSocketContext.Provider>
  );
};
```

### Phase 3: Hook Standardization

Refactor your hooks to consume the Context, rather than creating sockets.

**1. Fix `src/hooks/useWebSocket.ts`:**
This hook should strictly be for subscribing to events from the existing connection.

```typescript
export function useWebSocketEvent<T>(eventType: string, handler: (data: T) => void) {
  const client = useContext(WebSocketContext);

  useEffect(() => {
    // Register listener with the central service
    const unsubscribe = client.on(eventType, handler);
    return unsubscribe;
  }, [client, eventType, handler]);
}
```

**2. Fix `src/hooks/useWebSocketQuerySync.ts`:**
Update this to use the new event listener hook. It should simply listen for specific server events and trigger React Query invalidation.

### Phase 4: Fix TunnelManager (The Outlier)

`src/components/TunnelManager.tsx` currently creates its own ad-hoc WebSocket. This causes duplicate logic and unmanaged connections.

**The Fix:**
1.  If the Tunnel uses the same WebSocket endpoint as the main app:
    *   Update `TunnelManager` to use `useWebSocketEvent('tunnel_log', ...)` to receive logs.
    *   Use `client.send()` to subscribe to the tunnel channel.
2.  If the Tunnel uses a *different* endpoint (e.g., `ws://host/events` vs `ws://host/tunnel`):
    *   Instantiate a second `WebSocketClient` specifically for this component, or manage multiple sockets in the `WebSocketContext` (e.g., `mainClient` and `auxClient`). **Do not write raw `new WebSocket()` code inside the component.**

### Phase 5: Data Integrity (Zod Validation)

WebSocket messages are currently typed as `any` or loose interfaces. If the server sends malformed data, the client crashes.

1.  Install `zod`.
2.  Define schemas for your WebSocket messages in `src/types/schemas.ts`.
3.  In `WebSocketService`, parse incoming messages with `Schema.safeParse()`.
    *   If valid: emit event.
    *   If invalid: log error, do not crash UI.

### Phase 6: Reconnection Strategy (Exponential Backoff)

Your current `useWebSocket` has basic reconnection logic, but it resets on component remounts.

1.  Move the **Exponential Backoff** logic into `WebSocketClient` class.
2.  Ensure it tracks attempts and resets only on a successful connection *that stays stable for X seconds*.
3.  Handle `document.visibilityState`. If the tab goes to the background and the OS kills the socket, the `WebSocketClient` should detect `onclose` and pause reconnection attempts until the tab is visible again (to save resources), or use a Worker.

### Implementation Order

1.  **Refactor `src/services/websocket.ts`**: Make it a robust class that doesn't depend on React.
2.  **Create Context**: Wrap your app in `App.tsx` with the provider.
3.  **Update `useWebSocketQuerySync`**: Switch it to consume the context.
4.  **Refactor `TunnelManager`**: Remove the raw WebSocket code and use the shared service.
5.  **Clean up**: Delete the old `useWebSocket` hook logic and replace it with the subscription-only version.

### Specific Fix for "Jankiness" (React Strict Mode)

In `src/main.tsx`, you are using `<StrictMode>`. In development, this mounts components twice.
*   **Current Problem:** Your `useWebSocket` hook creates a socket, the component unmounts (strict mode), creates *another* socket. You likely have race conditions where the first socket disconnects *after* the second one tries to connect.
*   **Solution:** The **Context/Provider** approach solves this immediately because the Service instance is created outside the render loop of the consuming components.

### Code Example: The New Service Class

Here is a starting point for the hardened service class to replace `src/services/websocket.ts`:

```typescript
import { createLogger } from "@/utils/logger";

const log = createLogger("WS-Client");

type Listeners = Set<(data: any) => void>;

export class RobustWebSocket {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, Listeners>();
  private messageQueue: string[] = [];
  private reconnectAttempts = 0;
  private shouldReconnect = true;
  
  constructor(private url: string) {}

  public connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;
    this.shouldReconnect = true;

    try {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = this.handleOpen;
      this.ws.onclose = this.handleClose;
      this.ws.onmessage = this.handleMessage;
      this.ws.onerror = (e) => log.error("Socket error", e);
    } catch (e) {
      this.handleClose({ code: 1006 } as CloseEvent);
    }
  }

  public disconnect() {
    this.shouldReconnect = false;
    this.ws?.close();
  }

  public subscribe(event: string, cb: (data: any) => void) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  private handleOpen = () => {
    this.reconnectAttempts = 0;
    log.info("Connected");
    // Flush queue
    while (this.messageQueue.length) {
      this.ws?.send(this.messageQueue.shift()!);
    }
  };

  private handleClose = (e: CloseEvent) => {
    if (!this.shouldReconnect) return;
    
    // Exponential Backoff
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    log.warn(`Disconnected. Reconnecting in ${delay}ms...`);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  };

  private handleMessage = (ev: MessageEvent) => {
    try {
      const msg = JSON.parse(ev.data);
      // Assuming message structure: { type: "EVENT_NAME", payload: ... }
      const handlers = this.listeners.get(msg.type);
      handlers?.forEach(cb => cb(msg.payload));
    } catch (e) {
      log.error("Failed to parse message", e);
    }
  };
}
```
