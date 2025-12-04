import {
  websocketEnvelopeSchema,
  websocketErrorSchema,
  websocketEventSchema,
} from "../types/schemas";
import { createLogger } from "../utils/logger";

const log = createLogger("WS-Client");

export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

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

export interface VisibilityService {
  isVisible(): boolean;
  onVisibilityChange(callback: () => void): () => void;
}

export interface WebSocketFactory {
  create(url: string): WebSocket;
}

export interface WebSocketDependencies {
  timerService?: TimerService;
  locationService?: LocationService;
  webSocketFactory?: WebSocketFactory;
  visibilityService?: VisibilityService;
}

export interface WebSocketClientOptions extends WebSocketDependencies {
  /** Path on the same origin to connect to (default: "/ws") */
  path?: string;
  /** Optional explicit URL override (bypasses path/host resolution) */
  url?: string;
  /** Initial project id to subscribe to */
  projectId?: string | null;
  /** Maximum reconnect attempts before giving up (default: 10, use Infinity for unlimited) */
  maxReconnectAttempts?: number;
  /** Base delay for exponential backoff (ms) */
  reconnectBaseDelay?: number;
  /** Maximum delay for exponential backoff (ms) */
  reconnectMaxDelay?: number;
  /** Time a connection must stay up to reset the backoff counter (ms) */
  stabilityThreshold?: number;
  /** Interval for heartbeat pings (ms) */
  pingInterval?: number;
  /** Timeout waiting for pong before forcing reconnect (ms) */
  pingTimeout?: number;
  /** Pause reconnection while tab is hidden to save resources */
  pauseWhenHidden?: boolean;
}

export interface NormalizedWebSocketEvent<T = unknown> {
  type: string;
  projectId?: string | null;
  timestamp?: string | null;
  payload: T;
  raw: ReturnType<typeof websocketEnvelopeSchema.parse>;
  event: ReturnType<typeof websocketEventSchema.parse>;
}

type EventListener = (event: NormalizedWebSocketEvent) => void;
type WildcardListener = (event: NormalizedWebSocketEvent) => void;
type StateListener = (state: ConnectionState) => void;

class StateSubject {
  private value: ConnectionState;
  private listeners = new Set<StateListener>();

  constructor(initial: ConnectionState) {
    this.value = initial;
  }

  get current(): ConnectionState {
    return this.value;
  }

  next(nextValue: ConnectionState): void {
    if (nextValue === this.value) return;
    this.value = nextValue;
    this.listeners.forEach((listener) => listener(nextValue));
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    // Emit current value immediately for convenience
    listener(this.value);
    return () => this.listeners.delete(listener);
  }
}

// Default dependency implementations for production/browser use
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

const defaultVisibilityService: VisibilityService = {
  isVisible: () => typeof document === "undefined" || document.visibilityState === "visible",
  onVisibilityChange: (callback: () => void) => {
    if (typeof document === "undefined") return () => {};
    const handler = () => callback();
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  },
};

const defaultWebSocketFactory: WebSocketFactory = {
  create: (url: string) => new WebSocket(url),
};

export class WebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private pongTimeoutTimer: number | null = null;
  private stabilityTimer: number | null = null;

  private reconnectAttempts = 0;
  private readonly stateSubject = new StateSubject("disconnected");
  private manuallyDisconnected = false;

  private readonly listeners = new Map<string, Set<EventListener>>();
  private readonly wildcardListeners = new Set<WildcardListener>();
  private readonly subscriptions = new Set<string>();
  private readonly channelSubscriptions = new Set<string>();
  private readonly messageQueue: string[] = [];
  private visibilityUnsubscribe: (() => void) | null = null;

  private url: string | null;
  private path: string;
  private projectId: string | null;
  private readonly options: Required<
    Pick<
      WebSocketClientOptions,
      | "maxReconnectAttempts"
      | "reconnectBaseDelay"
      | "reconnectMaxDelay"
      | "stabilityThreshold"
      | "pingInterval"
      | "pingTimeout"
      | "pauseWhenHidden"
    >
  >;

  private readonly timer: TimerService;
  private readonly location: LocationService;
  private readonly factory: WebSocketFactory;
  private readonly visibility: VisibilityService;

  constructor({
    timerService,
    locationService,
    webSocketFactory,
    visibilityService,
    path = "/ws",
    url,
    projectId = null,
    maxReconnectAttempts = 10,
    reconnectBaseDelay = 500,
    reconnectMaxDelay = 30_000,
    stabilityThreshold = 5_000,
    pingInterval = 30_000,
    pingTimeout = 10_000,
    pauseWhenHidden = true,
  }: WebSocketClientOptions = {}) {
    this.timer = timerService || defaultTimerService;
    this.location = locationService || defaultLocationService;
    this.factory = webSocketFactory || defaultWebSocketFactory;
    this.visibility = visibilityService || defaultVisibilityService;

    this.path = path;
    this.url = url ?? null;
    this.projectId = projectId;
    this.options = {
      maxReconnectAttempts,
      reconnectBaseDelay,
      reconnectMaxDelay,
      stabilityThreshold,
      pingInterval,
      pingTimeout,
      pauseWhenHidden,
    };
  }

  get state() {
    return this.stateSubject;
  }

  /**
   * Subscribe to a specific event_type or all events ("*").
   */
  on(eventType: string | "*", listener: EventListener): () => void {
    if (eventType === "*") {
      this.wildcardListeners.add(listener);
      return () => this.wildcardListeners.delete(listener);
    }

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    const listeners = this.listeners.get(eventType)!;
    listeners.add(listener);

    return () => listeners.delete(listener);
  }

  onState(listener: StateListener): () => void {
    return this.stateSubject.subscribe(listener);
  }

  /**
   * Update the active project subscription. Will re-subscribe on existing connection.
   */
  setProject(projectId: string | null): void {
    if (this.projectId === projectId) return;

    const previous = this.projectId;
    this.projectId = projectId;

    if (this.socket?.readyState === WebSocket.OPEN) {
      if (previous) {
        this.send({
          type: "event",
          data: { action: "unsubscribe", project_id: previous },
        });
        this.subscriptions.delete(previous);
      }
      if (projectId) {
        this.send({
          type: "event",
          data: { action: "subscribe", project_id: projectId },
        });
        this.subscriptions.add(projectId);
      }
    } else if (projectId) {
      this.subscriptions.add(projectId);
    }
  }

  /**
   * Initiate connection (idempotent).
   */
  connect(projectId?: string | null): void {
    if (projectId !== undefined) {
      this.setProject(projectId);
    }

    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    this.manuallyDisconnected = false;
    this.transition(this.reconnectAttempts > 0 ? "reconnecting" : "connecting");

    const targetUrl = this.url ?? this.buildUrl(this.projectId);

    try {
      this.socket = this.factory.create(targetUrl);
      this.attachSocketHandlers(this.socket);
    } catch (error) {
      log.error("Failed to create WebSocket connection", error);
      this.scheduleReconnect();
    }
  }

  /**
   * Cleanly close connection and stop reconnection.
   */
  disconnect(): void {
    this.manuallyDisconnected = true;
    this.clearTimers();
    this.transition("disconnected");

    if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
      this.socket.close(1000, "Client disconnect");
    }
    this.socket = null;
    this.reconnectAttempts = 0;
  }

  /**
   * Enqueue or send a message. Subscribe/unsubscribe actions are tracked so they are replayed after reconnects.
   */
  send(message: { type: string; data?: Record<string, unknown>; project_id?: string }): void {
    this.trackSubscriptions(message);

    const payload = JSON.stringify(message);

    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(payload);
      return;
    }

    this.messageQueue.push(payload);
    log.debug("Queueing outbound message while disconnected", { type: message.type });
  }

  private attachSocketHandlers(socket: WebSocket): void {
    socket.addEventListener("open", this.handleOpen);
    socket.addEventListener("message", this.handleMessage);
    socket.addEventListener("close", this.handleClose);
    socket.addEventListener("error", this.handleError);
  }

  private handleOpen = (): void => {
    log.info("WebSocket connected");
    this.transition("connected");
    this.reconnectAttempts = 0;

    this.scheduleStabilityReset();
    this.startPing();
    this.restoreSubscriptions();
    this.flushQueue();
  };

  private handleMessage = (event: MessageEvent): void => {
    try {
      const parsed = JSON.parse(event.data);
      const envelopeResult = websocketEnvelopeSchema.safeParse(parsed);
      if (!envelopeResult.success) {
        log.warn("Received malformed WebSocket message", envelopeResult.error);
        return;
      }

      const envelope = envelopeResult.data;

      switch (envelope.type) {
        case "pong":
          this.handlePong();
          return;
        case "ping":
          this.send({ type: "pong", data: { timestamp: new Date().toISOString() } });
          return;
        case "error": {
          const errorResult = websocketErrorSchema.safeParse(envelope.data);
          if (errorResult.success) {
            log.warn("WebSocket server error", errorResult.data);
          } else {
            log.warn("WebSocket server error (unvalidated)", envelope.data);
          }
          return;
        }
        case "event":
          this.dispatchEvent(envelope);
          return;
        default:
          log.warn("Unhandled WebSocket message type", envelope.type);
      }
    } catch (error) {
      log.error("Failed to parse WebSocket message", error);
    }
  };

  private handleClose = (event: CloseEvent): void => {
    log.info("WebSocket closed", { code: event.code, reason: event.reason });
    this.clearTimers();
    this.socket = null;

    if (this.manuallyDisconnected || event.code === 1000) {
      this.transition("disconnected");
      return;
    }

    this.scheduleReconnect();
  };

  private handleError = (event: Event): void => {
    log.error("WebSocket error", event);
  };

  private dispatchEvent(envelope: ReturnType<typeof websocketEnvelopeSchema.parse>): void {
    const eventResult = websocketEventSchema.safeParse(envelope.data);
    if (!eventResult.success) {
      log.warn("Received WebSocket event with invalid structure", eventResult.error);
      return;
    }

    const data = eventResult.data;
    const normalized: NormalizedWebSocketEvent = {
      type: data.event_type,
      projectId: data.project_id ?? envelope.project_id ?? this.projectId ?? null,
      timestamp: data.timestamp ?? null,
      payload: data.data ?? data,
      raw: envelope,
      event: data,
    };

    // Emit to listeners for the specific event type
    const listeners = this.listeners.get(data.event_type);
    listeners?.forEach((listener) => {
      try {
        listener(normalized);
      } catch (error) {
        log.error("Error in WebSocket event listener", error);
      }
    });

    // Emit to wildcard listeners
    this.wildcardListeners.forEach((listener) => {
      try {
        listener(normalized);
      } catch (error) {
        log.error("Error in WebSocket wildcard listener", error);
      }
    });
  }

  private transition(state: ConnectionState): void {
    this.stateSubject.next(state);
  }

  private buildUrl(projectId: string | null): string {
    const protocol = this.location.protocol === "https:" ? "wss:" : "ws:";
    const host = this.location.host;
    const query = projectId ? `?project_id=${projectId}` : "";
    return `${protocol}//${host}${this.path}${query}`;
  }

  private restoreSubscriptions(): void {
    // Project subscriptions
    if (this.projectId) {
      this.subscriptions.add(this.projectId);
    }

    this.subscriptions.forEach((projectId) => {
      this.safeSendImmediate({
        type: "event",
        data: { action: "subscribe", project_id: projectId },
      });
    });

    this.channelSubscriptions.forEach((channel) => {
      this.safeSendImmediate({
        type: "event",
        data: { action: "subscribe", channel },
      });
    });
  }

  private flushQueue(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    while (this.messageQueue.length > 0) {
      const next = this.messageQueue.shift();
      if (next) {
        this.socket.send(next);
      }
    }
  }

  private startPing(): void {
    this.clearPingTimer();
    this.pingTimer = this.timer.setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(
          JSON.stringify({ type: "ping", data: { timestamp: new Date().toISOString() } }),
        );
        this.startPongTimeout();
      }
    }, this.options.pingInterval);
  }

  private startPongTimeout(): void {
    this.clearPongTimeout();
    this.pongTimeoutTimer = this.timer.setTimeout(() => {
      log.warn("Pong timeout - forcing reconnect");
      this.socket?.close(4000, "Pong timeout");
    }, this.options.pingTimeout);
  }

  private handlePong(): void {
    this.clearPongTimeout();
  }

  private scheduleStabilityReset(): void {
    this.clearStabilityTimer();
    this.stabilityTimer = this.timer.setTimeout(() => {
      this.reconnectAttempts = 0;
    }, this.options.stabilityThreshold);
  }

  private scheduleReconnect(): void {
    if (this.manuallyDisconnected) {
      return;
    }

    if (!this.visibility.isVisible() && this.options.pauseWhenHidden) {
      log.debug("Tab hidden, deferring WebSocket reconnect until visible");
      if (!this.visibilityUnsubscribe) {
        this.visibilityUnsubscribe = this.visibility.onVisibilityChange(() => {
          if (this.visibility.isVisible()) {
            this.visibilityUnsubscribe?.();
            this.visibilityUnsubscribe = null;
            this.scheduleReconnect();
          }
        });
      }
      return;
    }

    if (this.visibilityUnsubscribe) {
      this.visibilityUnsubscribe();
      this.visibilityUnsubscribe = null;
    }

    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      log.warn("Max reconnect attempts reached, giving up");
      this.transition("disconnected");
      return;
    }

    this.reconnectAttempts += 1;
    const backoff = Math.min(
      this.options.reconnectBaseDelay * Math.pow(2, this.reconnectAttempts - 1),
      this.options.reconnectMaxDelay,
    );
    const jitter = Math.random() * 150;
    const delay = backoff + jitter;

    log.info("Scheduling WebSocket reconnect", {
      attempt: this.reconnectAttempts,
      delay,
    });

    this.clearReconnectTimer();
    this.reconnectTimer = this.timer.setTimeout(() => this.connect(), delay);
  }

  private trackSubscriptions(message: { type: string; data?: Record<string, unknown> }): void {
    if (message.type !== "event" || !message.data) return;

    const action = message.data["action"];
    const projectId = message.data["project_id"];
    const channel = message.data["channel"];

    if (action === "subscribe") {
      if (typeof projectId === "string") {
        this.subscriptions.add(projectId);
      }
      if (typeof channel === "string") {
        this.channelSubscriptions.add(channel);
      }
    } else if (action === "unsubscribe") {
      if (typeof projectId === "string") {
        this.subscriptions.delete(projectId);
      }
      if (typeof channel === "string") {
        this.channelSubscriptions.delete(channel);
      }
    }
  }

  private safeSendImmediate(message: { type: string; data?: Record<string, unknown> }) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  private clearTimers(): void {
    this.clearReconnectTimer();
    this.clearPingTimer();
    this.clearPongTimeout();
    this.clearStabilityTimer();
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      this.timer.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearPingTimer(): void {
    if (this.pingTimer) {
      this.timer.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private clearPongTimeout(): void {
    if (this.pongTimeoutTimer) {
      this.timer.clearTimeout(this.pongTimeoutTimer);
      this.pongTimeoutTimer = null;
    }
  }

  private clearStabilityTimer(): void {
    if (this.stabilityTimer) {
      this.timer.clearTimeout(this.stabilityTimer);
      this.stabilityTimer = null;
    }
  }
}

export function createWebSocketClient(options?: WebSocketClientOptions): WebSocketClient {
  return new WebSocketClient(options);
}

export const wsClient = createWebSocketClient();

// Backward compatible aliases (kept for existing imports)
export const createWebSocketService = createWebSocketClient;
export const wsService = wsClient;
