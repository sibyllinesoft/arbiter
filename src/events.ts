/**
 * Real-time events and WebSocket management
 */
import type { ServerWebSocket } from "bun";
import type { 
  Event, 
  EventType, 
  WebSocketMessage, 
  AuthContext,
  ServerConfig 
} from "./types.ts";
import { generateId, getCurrentTimestamp, logger } from "./utils.ts";
import { NatsService } from "./nats.ts";

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
  private pingInterval?: Timer;
  private nats: NatsService;

  constructor(private config: ServerConfig) {
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
      lastPing: Date.now()
    };

    this.connections.set(connectionId, connection);

    // Set connection data for WebSocket
    ws.data = { connectionId, authContext };

    logger.info("WebSocket connection established", {
      connectionId,
      userId: authContext.user_id,
      totalConnections: this.connections.size
    });

    // Send welcome message
    this.sendToConnection(connectionId, {
      type: 'event',
      data: {
        event_type: 'connection_established',
        connection_id: connectionId,
        timestamp: getCurrentTimestamp()
      }
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

      logger.info("WebSocket connection closed", {
        connectionId,
        userId: connection.authContext.user_id,
        totalConnections: this.connections.size
      });
    }
  }

  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(connectionId: string, message: WebSocketMessage): Promise<void> {
    const connection = this.connections.get(connectionId);
    
    if (!connection) {
      logger.warn("Message from unknown connection", { connectionId });
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
          logger.warn("Unknown message type", { 
            connectionId, 
            messageType: message.type 
          });
      }
    } catch (error) {
      logger.error("Error handling WebSocket message", error instanceof Error ? error : undefined, {
        connectionId,
        messageType: message.type
      });

      this.sendToConnection(connectionId, {
        type: 'error',
        data: {
          error: 'Failed to process message',
          originalMessage: message
        }
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
        data: { timestamp: getCurrentTimestamp() }
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

    switch (action) {
      case 'subscribe':
        if (projectId) {
          await this.subscribeToProject(connectionId, projectId);
        }
        break;
        
      case 'unsubscribe':
        if (projectId) {
          this.unsubscribeFromProject(connectionId, projectId);
        }
        break;
        
      default:
        logger.warn("Unknown event action", { connectionId, action });
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
    if (!connection.authContext.project_access.includes("*") && 
        !connection.authContext.project_access.includes(projectId)) {
      
      this.sendToConnection(connectionId, {
        type: 'error',
        data: {
          error: 'Access denied',
          project_id: projectId
        }
      });
      return;
    }

    // Add to project subscriptions
    connection.projectSubscriptions.add(projectId);
    
    if (!this.projectSubscriptions.has(projectId)) {
      this.projectSubscriptions.set(projectId, new Set());
    }
    this.projectSubscriptions.get(projectId)!.add(connectionId);

    logger.info("Subscribed to project", {
      connectionId,
      projectId,
      userId: connection.authContext.user_id
    });

    // Acknowledge subscription
    this.sendToConnection(connectionId, {
      type: 'event',
      project_id: projectId,
      data: {
        event_type: 'subscription_confirmed',
        project_id: projectId,
        timestamp: getCurrentTimestamp()
      }
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

    logger.debug("Unsubscribed from project", { connectionId, projectId });
  }

  /**
   * Broadcast event to all subscribers of a project
   */
  async broadcastToProject(
    projectId: string, 
    event: Omit<Event, 'id' | 'created_at'>,
    specHash?: string
  ): Promise<void> {
    const startTime = Date.now();
    const subscribers = this.projectSubscriptions.get(projectId);
    
    const message: WebSocketMessage = {
      type: 'event',
      project_id: projectId,
      data: {
        ...event,
        id: generateId(),
        created_at: getCurrentTimestamp()
      }
    };

    // Publish to NATS for external agents (async, non-blocking)
    // This happens regardless of WebSocket subscribers to ensure external agents get events
    this.nats.publishEvent(projectId, event, specHash).catch((error) => {
      // Already logged in NatsService, but ensure it doesn't affect WebSocket flow
      logger.debug("NATS publish completed with potential error", { projectId, eventType: event.event_type });
    });

    if (!subscribers || subscribers.size === 0) {
      logger.debug("No WebSocket subscribers for project", { projectId });
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Broadcast to all WebSocket subscribers
    const promises = Array.from(subscribers).map(async (connectionId) => {
      try {
        await this.sendToConnection(connectionId, message);
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error("Failed to send message to connection", error instanceof Error ? error : undefined, {
          connectionId,
          projectId
        });
      }
    });

    await Promise.all(promises);

    const duration = Date.now() - startTime;

    logger.info("Broadcasted event to project", {
      projectId,
      eventType: event.event_type,
      subscriberCount: subscribers.size,
      successCount,
      errorCount,
      duration
    });

    // Check if we meet the 100ms broadcast target
    if (duration > 100) {
      logger.warn("Broadcast exceeded target time", {
        projectId,
        duration,
        target: 100
      });
    }
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
          data: { timestamp: getCurrentTimestamp() }
        }).catch(() => {
          // Connection error, mark for removal
          staleConnections.push(connectionId);
        });
      }
    }

    // Clean up stale connections
    staleConnections.forEach(connectionId => {
      logger.info("Removing stale connection", { connectionId });
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
      nats: this.nats.getStats()
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

    logger.info("EventService cleanup completed");
  }
}