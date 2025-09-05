/**
 * WebSocket service for real-time communication
 */

import type { WebSocketMessage, WsEvent } from "../types/api";

export type WebSocketEventHandler = (event: WsEvent) => void;

export interface TimerService {
  setTimeout(callback: () => void, delay: number): number;
  setInterval(callback: () => void, delay: number): number;
  clearTimeout(timerId: number): void;
  clearInterval(timerId: number): void;
}

export interface LocationService {
  protocol: string;
  host: string;
}

export interface WebSocketFactory {
  create(url: string): WebSocket;
}

export interface WebSocketDependencies {
  timerService?: TimerService;
  locationService?: LocationService;
  webSocketFactory?: WebSocketFactory;
}

export interface WebSocketOptions extends WebSocketDependencies {
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onReconnect?: (attempt: number) => void;
  onError?: (error: Event) => void;
}

// Default implementations for production use
const defaultTimerService: TimerService = {
  setTimeout: (callback: () => void, delay: number) => window.setTimeout(callback, delay),
  setInterval: (callback: () => void, delay: number) => window.setInterval(callback, delay),
  clearTimeout: (timerId: number) => window.clearTimeout(timerId),
  clearInterval: (timerId: number) => window.clearInterval(timerId),
};

const defaultLocationService: LocationService = {
  get protocol() {
    return window.location.protocol;
  },
  get host() {
    return window.location.host;
  },
};

const defaultWebSocketFactory: WebSocketFactory = {
  create: (url: string) => new WebSocket(url),
};

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private reconnectAttempts = 0;
  private isManuallyDisconnected = false;
  private eventHandlers = new Set<WebSocketEventHandler>();
  private messageQueue: WebSocketMessage[] = [];
  private wsUrl: string | null = null;

  private readonly timerService: TimerService;
  private readonly locationService: LocationService;
  private readonly webSocketFactory: WebSocketFactory;

  private readonly options: Required<Omit<WebSocketOptions, keyof WebSocketDependencies>> = {
    reconnectInterval: 5000, // 5 seconds
    maxReconnectAttempts: 10,
    pingInterval: 30000, // 30 seconds
    onConnect: () => {},
    onDisconnect: () => {},
    onReconnect: () => {},
    onError: () => {},
  };

  constructor(options: WebSocketOptions = {}) {
    // Extract dependencies from options
    const { timerService, locationService, webSocketFactory, ...wsOptions } = options;

    // Set up dependencies with defaults
    this.timerService = timerService || defaultTimerService;
    this.locationService = locationService || defaultLocationService;
    this.webSocketFactory = webSocketFactory || defaultWebSocketFactory;

    // Merge websocket options
    this.options = { ...this.options, ...wsOptions };
  }

  connect(projectId: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    this.isManuallyDisconnected = false;
    const protocol = this.locationService.protocol === "https:" ? "wss:" : "ws:";
    this.wsUrl = `${protocol}//${this.locationService.host}/api/ws?project_id=${projectId}`;

    try {
      this.ws = this.webSocketFactory.create(this.wsUrl);
      this.setupEventListeners();
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.isManuallyDisconnected = true;
    this.clearTimers();

    if (this.ws) {
      this.ws.close(1000, "Manual disconnect");
      this.ws = null;
    }

    this.reconnectAttempts = 0;
  }

  send(message: WebSocketMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message for when connection is restored
      this.messageQueue.push(message);
      console.warn("WebSocket not connected, queuing message:", message);
    }
  }

  subscribe(handler: WebSocketEventHandler): () => void {
    this.eventHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  private setupEventListeners(): void {
    if (!this.ws) return;

    this.ws.addEventListener("open", this.handleOpen.bind(this));
    this.ws.addEventListener("message", this.handleMessage.bind(this));
    this.ws.addEventListener("close", this.handleClose.bind(this));
    this.ws.addEventListener("error", this.handleError.bind(this));
  }

  private handleOpen(): void {
    console.log("WebSocket connected");
    this.reconnectAttempts = 0;
    this.options.onConnect();

    // Send queued messages
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }

    // Start ping interval
    this.startPingInterval();
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      switch (message.type) {
        case "event":
          this.handleEventMessage(message);
          break;

        case "error":
          console.error("WebSocket server error:", message.data);
          break;

        case "pong":
          // Server responded to ping
          break;

        default:
          console.warn("Unknown WebSocket message type:", message);
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  }

  private handleEventMessage(message: WebSocketMessage): void {
    try {
      const wsEvent = message.data as WsEvent;

      // Validate event structure
      if (!wsEvent.type || !wsEvent.project_id || !wsEvent.timestamp) {
        console.warn("Invalid WebSocket event structure:", wsEvent);
        return;
      }

      // Notify all subscribers
      this.eventHandlers.forEach((handler) => {
        try {
          handler(wsEvent);
        } catch (error) {
          console.error("Error in WebSocket event handler:", error);
        }
      });
    } catch (error) {
      console.error("Failed to handle WebSocket event:", error);
    }
  }

  private handleClose(event: CloseEvent): void {
    console.log("WebSocket disconnected:", event.code, event.reason);
    this.clearTimers();
    this.options.onDisconnect();

    if (!this.isManuallyDisconnected && event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  private handleError(event: Event): void {
    console.error("WebSocket error:", event);
    this.options.onError(event);
  }

  private scheduleReconnect(): void {
    if (
      this.isManuallyDisconnected ||
      this.reconnectAttempts >= this.options.maxReconnectAttempts
    ) {
      console.log("Max reconnect attempts reached or manually disconnected");
      return;
    }

    if (this.reconnectTimer) {
      this.timerService.clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    console.log(
      `Scheduling WebSocket reconnect attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts} in ${this.options.reconnectInterval}ms`,
    );

    this.reconnectTimer = this.timerService.setTimeout(() => {
      this.options.onReconnect(this.reconnectAttempts);
      this.reconnect();
    }, this.options.reconnectInterval);
  }

  private reconnect(): void {
    if (this.isManuallyDisconnected) {
      return;
    }

    // Use stored URL instead of relying on WebSocket instance
    if (!this.wsUrl) {
      console.error("Cannot reconnect: no previous URL available");
      return;
    }

    const urlParams = new URLSearchParams(this.wsUrl.split("?")[1]);
    const projectId = urlParams.get("project_id");

    if (!projectId) {
      console.error("Cannot reconnect: no project ID available");
      return;
    }

    this.connect(projectId);
  }

  private startPingInterval(): void {
    this.clearPingTimer();

    this.pingTimer = this.timerService.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: "ping",
          data: { timestamp: new Date().toISOString() },
        });
      }
    }, this.options.pingInterval);
  }

  private clearTimers(): void {
    this.clearReconnectTimer();
    this.clearPingTimer();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      this.timerService.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearPingTimer(): void {
    if (this.pingTimer) {
      this.timerService.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}

// Export factory function to create WebSocket service instances
export function createWebSocketService(options: WebSocketOptions = {}): WebSocketService {
  return new WebSocketService(options);
}

// Export singleton instance for global use
export const wsService = createWebSocketService();
