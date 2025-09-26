/**
 * Real-time events and WebSocket management
 */
import type { ServerWebSocket } from 'bun';
import type { SpecWorkbenchDB } from './db';
import { NatsService } from './nats';
import type { AuthContext, Event, EventType, ServerConfig, WebSocketMessage } from './types';
import { generateId, getCurrentTimestamp, logger } from './utils';

interface WebSocketConnection {
  id: string;
  ws: ServerWebSocket<{ connectionId: string; authContext: AuthContext }>;
  authContext: AuthContext;
  projectSubscriptions: Set<string>;
  lastPing: number;
}

export class EventService {
  private connections = new Map<string, WebSocketConnection>();
  private projectSubscriptions = new Map<string, Set<string>>(); // projectId -> Set<connectionId>
  private globalSubscribers = new Set<string>(); // for global channels like tunnel-logs
  private pingInterval?: Timer;
  private nats: NatsService;

  constructor(
    private config: ServerConfig,
    private db?: SpecWorkbenchDB
  ) {
    this.nats = new NatsService(config.nats);
    this.startPingInterval();
  }

  /**
   * Start WebSocket ping interval to keep connections alive
   */
  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.pingAllConnections();
    }, this.config.websocket.ping_interval_ms);
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(
    ws: ServerWebSocket<{ connectionId: string; authContext: AuthContext }>,
    authContext: AuthContext
  ): string {
    const connectionId = generateId();

    const connection: WebSocketConnection = {
      id: connectionId,
      ws,
      authContext,
      projectSubscriptions: new Set(),
      lastPing: Date.now(),
    };

    this.connections.set(connectionId, connection);

    // Set connection data for WebSocket
    ws.data = { connectionId, authContext };

    // Reduced logging - only log if debug level enabled
    // logger.info("WebSocket connection established", {
    //   connectionId,
    //   userId: authContext.user_id,
    //   totalConnections: this.connections.size,
    // });

    // Send welcome message
    this.sendToConnection(connectionId, {
      type: 'event',
      data: {
        event_type: 'connection_established',
        connection_id: connectionId,
        timestamp: getCurrentTimestamp(),
      },
    });

    return connectionId;
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);

    if (connection) {
      // Remove from all project subscriptions
      for (const projectId of connection.projectSubscriptions) {
        this.unsubscribeFromProject(connectionId, projectId);
      }

      this.connections.delete(connectionId);

      // Reduced logging - only log if debug level enabled
      // logger.info("WebSocket connection closed", {
      //   connectionId,
      //   userId: connection.authContext.user_id,
      //   totalConnections: this.connections.size,
      // });
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(connectionId: string, message: WebSocketMessage): Promise<void> {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      logger.warn('Message from unknown connection', { connectionId });
      return;
    }

    try {
      switch (message.type) {
        case 'ping':
          this.handlePing(connectionId);
          break;

        case 'event':
          await this.handleEventMessage(connectionId, message);
          break;

        default:
          logger.warn('Unknown message type', {
            connectionId,
            messageType: message.type,
          });
      }
    } catch (error) {
      logger.error('Error handling WebSocket message', error instanceof Error ? error : undefined, {
        connectionId,
        messageType: message.type,
      });

      this.sendToConnection(connectionId, {
        type: 'error',
        data: {
          error: 'Failed to process message',
          originalMessage: message,
        },
      });
    }
  }

  /**
   * Handle ping message
   */
  private handlePing(connectionId: string): void {
    const connection = this.connections.get(connectionId);

    if (connection) {
      connection.lastPing = Date.now();

      this.sendToConnection(connectionId, {
        type: 'pong',
        data: { timestamp: getCurrentTimestamp() },
      });
    }
  }

  /**
   * Handle event-type message (subscribe/unsubscribe)
   */
  private async handleEventMessage(connectionId: string, message: WebSocketMessage): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { data } = message;
    const action = data.action as string;
    const projectId = data.project_id as string;
    const channel = data.channel as string;

    switch (action) {
      case 'subscribe':
        if (projectId) {
          await this.subscribeToProject(connectionId, projectId);
        } else if (channel === 'tunnel-logs') {
          this.subscribeGlobal(connectionId);
        }
        break;

      case 'unsubscribe':
        if (projectId) {
          this.unsubscribeFromProject(connectionId, projectId);
        } else if (channel === 'tunnel-logs') {
          this.unsubscribeGlobal(connectionId);
        }
        break;

      default:
        logger.warn('Unknown event action', { connectionId, action });
    }
  }

  /**
   * Subscribe connection to project events
   */
  private async subscribeToProject(connectionId: string, projectId: string): Promise<void> {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      return;
    }

    // Check if user has access to project
    if (
      !connection.authContext.project_access.includes('*') &&
      !connection.authContext.project_access.includes(projectId)
    ) {
      this.sendToConnection(connectionId, {
        type: 'error',
        data: {
          error: 'Access denied',
          project_id: projectId,
        },
      });
      return;
    }

    // Add to project subscriptions
    connection.projectSubscriptions.add(projectId);

    if (!this.projectSubscriptions.has(projectId)) {
      this.projectSubscriptions.set(projectId, new Set());
    }
    this.projectSubscriptions.get(projectId)?.add(connectionId);

    logger.info('Subscribed to project', {
      connectionId,
      projectId,
      userId: connection.authContext.user_id,
    });

    // Acknowledge subscription
    this.sendToConnection(connectionId, {
      type: 'event',
      project_id: projectId,
      data: {
        event_type: 'subscription_confirmed',
        project_id: projectId,
        timestamp: getCurrentTimestamp(),
      },
    });
  }

  /**
   * Unsubscribe connection from project events
   */
  private unsubscribeFromProject(connectionId: string, projectId: string): void {
    const connection = this.connections.get(connectionId);

    if (connection) {
      connection.projectSubscriptions.delete(projectId);
    }

    const projectConnections = this.projectSubscriptions.get(projectId);
    if (projectConnections) {
      projectConnections.delete(connectionId);

      // Clean up empty project subscriptions
      if (projectConnections.size === 0) {
        this.projectSubscriptions.delete(projectId);
      }
    }

    logger.debug('Unsubscribed from project', { connectionId, projectId });
  }

  /**
   * Subscribe to global events (e.g., tunnel logs)
   */
  private subscribeGlobal(connectionId: string): void {
    this.globalSubscribers.add(connectionId);

    this.sendToConnection(connectionId, {
      type: 'event',
      data: {
        event_type: 'global_subscription_confirmed',
        channel: 'tunnel-logs',
        timestamp: getCurrentTimestamp(),
      },
    }).catch(error => {
      logger.error('Failed to confirm global subscription', error);
      this.globalSubscribers.delete(connectionId);
    });

    logger.info('Subscribed to global tunnel logs', { connectionId });
  }

  /**
   * Unsubscribe from global events
   */
  private unsubscribeGlobal(connectionId: string): void {
    this.globalSubscribers.delete(connectionId);
    logger.debug('Unsubscribed from global tunnel logs', { connectionId });
  }

  /**
   * Broadcast to global subscribers
   */
  public async broadcastGlobal(
    message: WebSocketMessage
  ): Promise<{ successCount: number; errorCount: number }> {
    if (this.globalSubscribers.size === 0) {
      logger.debug('No global subscribers for broadcast');
      return { successCount: 0, errorCount: 0 };
    }

    const { successCount, errorCount } = await this.broadcastToSubscribers(
      this.globalSubscribers,
      message,
      'global'
    );

    logger.info('Broadcasted global event', {
      channel: 'tunnel-logs',
      subscriberCount: this.globalSubscribers.size,
      successCount,
      errorCount,
    });

    return { successCount, errorCount };
  }

  /**
   * Broadcast event to all subscribers of a project
   */
  /**
   * Create WebSocket message from event
   */
  private createWebSocketMessage(projectId: string, event: Event): WebSocketMessage {
    return {
      type: 'event',
      project_id: projectId,
      data: {
        ...event,
        timestamp: event.created_at,
      },
    };
  }

  private async persistEvent(
    projectId: string,
    event: Omit<Event, 'id' | 'created_at' | 'is_active' | 'reverted_at'>
  ): Promise<Event> {
    if (!this.db) {
      return {
        id: generateId(),
        project_id: projectId,
        event_type: event.event_type as EventType,
        data: event.data,
        is_active: true,
        reverted_at: null,
        created_at: getCurrentTimestamp(),
      };
    }

    try {
      return await this.db.createEvent(
        generateId(),
        projectId,
        event.event_type as EventType,
        event.data
      );
    } catch (error) {
      logger.error(
        'Failed to persist event to database',
        error instanceof Error ? error : undefined,
        {
          projectId,
          eventType: event.event_type,
        }
      );

      return {
        id: generateId(),
        project_id: projectId,
        event_type: event.event_type as EventType,
        data: event.data,
        is_active: true,
        reverted_at: null,
        created_at: getCurrentTimestamp(),
      };
    }
  }

  /**
   * Publish event to NATS (non-blocking)
   */
  private async publishToNats(
    projectId: string,
    event: Omit<Event, 'id' | 'created_at' | 'is_active' | 'reverted_at'>,
    specHash?: string
  ): Promise<void> {
    this.nats.publishEvent(projectId, event, specHash).catch(_error => {
      // Already logged in NatsService, but ensure it doesn't affect WebSocket flow
      logger.debug('NATS publish completed with potential error', {
        projectId,
        eventType: event.event_type,
      });
    });
  }

  /**
   * Check if there are subscribers for the project
   */
  private hasProjectSubscribers(projectId: string): boolean {
    const subscribers = this.projectSubscriptions.get(projectId);
    return !!(subscribers && subscribers.size > 0);
  }

  /**
   * Get project subscribers
   */
  private getProjectSubscribers(projectId: string): Set<string> | undefined {
    return this.projectSubscriptions.get(projectId);
  }

  /**
   * Send message to individual connection with error handling
   */
  private async sendToConnectionSafe(
    connectionId: string,
    message: WebSocketMessage,
    projectId: string
  ): Promise<{ success: boolean }> {
    try {
      await this.sendToConnection(connectionId, message);
      return { success: true };
    } catch (error) {
      logger.error(
        'Failed to send message to connection',
        error instanceof Error ? error : undefined,
        {
          connectionId,
          projectId,
        }
      );
      return { success: false };
    }
  }

  /**
   * Broadcast message to all WebSocket subscribers
   */
  private async broadcastToSubscribers(
    subscribers: Set<string>,
    message: WebSocketMessage,
    projectId: string
  ): Promise<{ successCount: number; errorCount: number }> {
    const promises = Array.from(subscribers).map(connectionId =>
      this.sendToConnectionSafe(connectionId, message, projectId)
    );

    const results = await Promise.all(promises);
    const successCount = results.filter(r => r.success).length;
    const errorCount = results.length - successCount;

    return { successCount, errorCount };
  }

  /**
   * Log broadcast results and performance
   */
  private logBroadcastResults(
    projectId: string,
    event: Event,
    subscriberCount: number,
    successCount: number,
    errorCount: number,
    duration: number
  ): void {
    logger.info('Broadcasted event to project', {
      projectId,
      eventType: event.event_type,
      subscriberCount,
      successCount,
      errorCount,
      duration,
    });
  }

  /**
   * Check and warn about broadcast performance
   */
  private checkBroadcastPerformance(projectId: string, duration: number, targetMs = 100): void {
    if (duration > targetMs) {
      logger.warn('Broadcast exceeded target time', {
        projectId,
        duration,
        target: targetMs,
      });
    }
  }

  async broadcastToProject(
    projectId: string,
    event: Omit<Event, 'id' | 'created_at' | 'is_active' | 'reverted_at'>,
    specHash?: string
  ): Promise<Event> {
    const startTime = Date.now();

    // Persist event if database available
    const persistedEvent = await this.persistEvent(projectId, event);

    // Create WebSocket message
    const message = this.createWebSocketMessage(projectId, persistedEvent);

    // Publish to NATS (async, non-blocking)
    await this.publishToNats(projectId, event, specHash);

    // Check for WebSocket subscribers
    if (!this.hasProjectSubscribers(projectId)) {
      logger.debug('No WebSocket subscribers for project', { projectId });
      return persistedEvent;
    }

    const subscribers = this.getProjectSubscribers(projectId)!;

    // Broadcast to all WebSocket subscribers
    const { successCount, errorCount } = await this.broadcastToSubscribers(
      subscribers,
      message,
      projectId
    );

    // Log results and check performance
    const duration = Date.now() - startTime;
    this.logBroadcastResults(
      projectId,
      persistedEvent,
      subscribers.size,
      successCount,
      errorCount,
      duration
    );
    this.checkBroadcastPerformance(projectId, duration);
    return persistedEvent;
  }

  /**
   * Send message to specific connection
   */
  private async sendToConnection(connectionId: string, message: WebSocketMessage): Promise<void> {
    const connection = this.connections.get(connectionId);

    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    try {
      const messageStr = JSON.stringify(message);
      connection.ws.send(messageStr);
    } catch (error) {
      // Connection might be closed, remove it
      this.handleDisconnection(connectionId);
      throw error;
    }
  }

  /**
   * Ping all connections to keep them alive
   */
  private pingAllConnections(): void {
    const now = Date.now();
    const timeout = this.config.websocket.ping_interval_ms * 2;
    const staleConnections: string[] = [];

    for (const [connectionId, connection] of this.connections.entries()) {
      if (now - connection.lastPing > timeout) {
        staleConnections.push(connectionId);
      } else {
        this.sendToConnection(connectionId, {
          type: 'ping',
          data: { timestamp: getCurrentTimestamp() },
        }).catch(() => {
          // Connection error, mark for removal
          staleConnections.push(connectionId);
        });
      }
    }

    // Clean up stale connections
    staleConnections.forEach(connectionId => {
      logger.info('Removing stale connection', { connectionId });
      this.handleDisconnection(connectionId);
    });
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    totalConnections: number;
    totalProjects: number;
    connectionsByProject: Record<string, number>;
    nats: {
      enabled: boolean;
      connected: boolean;
      eventsPublished: number;
    };
  } {
    const connectionsByProject: Record<string, number> = {};

    for (const [projectId, connections] of this.projectSubscriptions.entries()) {
      connectionsByProject[projectId] = connections.size;
    }

    return {
      totalConnections: this.connections.size,
      totalProjects: this.projectSubscriptions.size,
      connectionsByProject,
      nats: this.nats.getStats(),
    };
  }

  /**
   * Close all connections and cleanup
   */
  async cleanup(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Close all connections
    for (const connection of this.connections.values()) {
      try {
        connection.ws.close();
      } catch {
        // Ignore close errors
      }
    }

    this.connections.clear();
    this.projectSubscriptions.clear();

    // Cleanup NATS connection
    await this.nats.cleanup();

    logger.info('EventService cleanup completed');
  }
}
