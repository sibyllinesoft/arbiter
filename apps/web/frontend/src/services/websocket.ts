/**
 * WebSocket service for real-time communication
 */

import type { WebSocketMessage, WsEvent } from '../types/api';
import { createLogger } from '../utils/logger';

const log = createLogger('WebSocket');

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
    const protocol = this.locationService.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use API server port (5050) instead of frontend port for WebSocket connection
    this.wsUrl = `${protocol}//localhost:5050/ws?project_id=${projectId}`;

    try {
      this.ws = this.webSocketFactory.create(this.wsUrl);
      this.setupEventListeners();
    } catch (error) {
      log.error('Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    this.isManuallyDisconnected = true;
    this.clearTimers();

    if (this.ws) {
      this.ws.close(1000, 'Manual disconnect');
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
      log.debug('WebSocket not connected, queuing message:', message);
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

    this.ws.addEventListener('open', this.handleOpen.bind(this));
    this.ws.addEventListener('message', this.handleMessage.bind(this));
    this.ws.addEventListener('close', this.handleClose.bind(this));
    this.ws.addEventListener('error', this.handleError.bind(this));
  }

  private handleOpen(): void {
    log.info('WebSocket connected');
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
        case 'event':
          this.handleEventMessage(message);
          break;

        case 'error':
          log.error('WebSocket server error:', message.data);
          break;

        case 'pong':
          // Server responded to ping
          log.trace('Received pong from server');
          break;

        case 'ping':
          // Server sent ping, respond with pong
          log.trace('Received ping from server, responding with pong');
          this.send({ type: 'pong', data: {} });
          break;

        default:
          log.warn('Unknown WebSocket message type:', message);
      }
    } catch (error) {
      log.error('Failed to parse WebSocket message:', error);
    }
  }

  private handleEventMessage(message: WebSocketMessage): void {
    try {
      const rawEvent = message.data as any;

      // Handle different event formats from server
      const wsEvent: WsEvent = {
        type: rawEvent.type || rawEvent.event_type,
        project_id: rawEvent.project_id,
        timestamp: rawEvent.timestamp,
        data: rawEvent.data,
      };

      // Validate event structure - connection_established events don't need project_id
      if (!wsEvent.type || !wsEvent.timestamp) {
        log.warn('Invalid WebSocket event structure:', rawEvent);
        return;
      }

      // Skip project-specific events if we don't have a project_id (except connection_established)
      if (!wsEvent.project_id && wsEvent.type !== 'connection_established') {
        log.debug('Skipping non-project event:', wsEvent.type);
        return;
      }

      log.debug('Processing WebSocket event:', {
        type: wsEvent.type,
        project_id: wsEvent.project_id,
      });

      // Notify all subscribers
      this.eventHandlers.forEach(handler => {
        try {
          handler(wsEvent);
        } catch (error) {
          log.error('Error in WebSocket event handler:', error);
        }
      });
    } catch (error) {
      log.error('Failed to handle WebSocket event:', error);
    }
  }

  private handleClose(event: CloseEvent): void {
    log.info('WebSocket disconnected:', { code: event.code, reason: event.reason });
    this.clearTimers();
    this.options.onDisconnect();

    if (!this.isManuallyDisconnected && event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  private handleError(event: Event): void {
    log.error('WebSocket error:', event);
    this.options.onError(event);
  }

  private scheduleReconnect(): void {
    if (
      this.isManuallyDisconnected ||
      this.reconnectAttempts >= this.options.maxReconnectAttempts
    ) {
      log.warn('Max reconnect attempts reached or manually disconnected');
      return;
    }

    if (this.reconnectTimer) {
      this.timerService.clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    log.info(
      `Scheduling WebSocket reconnect attempt ${this.reconnectAttempts}/${this.options.maxReconnectAttempts} in ${this.options.reconnectInterval}ms`
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
      log.error('Cannot reconnect: no previous URL available');
      return;
    }

    const urlParams = new URLSearchParams(this.wsUrl.split('?')[1]);
    const projectId = urlParams.get('project_id');

    if (!projectId) {
      log.error('Cannot reconnect: no project ID available');
      return;
    }

    this.connect(projectId);
  }

  private startPingInterval(): void {
    this.clearPingTimer();

    this.pingTimer = this.timerService.setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          data: { timestamp: new Date().toISOString() },
        });
        log.trace('Ping sent to server');
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
