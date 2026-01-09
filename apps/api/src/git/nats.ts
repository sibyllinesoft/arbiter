/**
 * NATS integration service for external agent communication
 * Publishes spec events to NATS topics for external AI agents to consume
 */
import { type ConnectionOptions, type NatsConnection, connect } from "nats";
import { getCurrentTimestamp, logger } from "../io/utils";
import type { Event, NatsConfig, NatsSpecEvent } from "../util/types";

export class NatsService {
  private connection: NatsConnection | null = null;
  private config: NatsConfig;
  private isConnected = false;
  private reconnectAttempts = 0;
  private eventSequence = 0;
  private reconnectTimer?: Timer;
  private autoConnect = true;

  constructor(config?: NatsConfig) {
    const { autoConnect = true, ...configOverrides } = config ?? {};

    this.config = {
      url: process.env.NATS_URL || "nats://localhost:4222",
      enabled: !!process.env.NATS_URL || false,
      reconnectTimeWait: 2000, // Start with 2 seconds
      maxReconnectAttempts: 10,
      topicPrefix: "spec",
      ...configOverrides,
      autoConnect,
    };
    this.autoConnect = autoConnect;

    if (this.config.enabled && this.autoConnect) {
      this.initialize();
    } else {
      logger.info("NATS integration disabled - no NATS_URL configured");
    }
  }

  /**
   * Initialize NATS connection
   */
  private async initialize(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      const connectionOptions: ConnectionOptions = {
        servers: [this.config.url!],
        reconnectTimeWait: this.config.reconnectTimeWait,
        maxReconnectAttempts: this.config.maxReconnectAttempts,
        pingInterval: 60000, // 60 seconds
        maxPingOut: 2,
      };

      logger.info("Connecting to NATS server", {
        url: this.config.url,
        options: connectionOptions,
      });

      this.connection = await connect(connectionOptions);
      this.isConnected = true;
      this.reconnectAttempts = 0;

      logger.info("Successfully connected to NATS server", {
        server: this.connection.getServer(),
      });

      // Set up event listeners
      this.setupConnectionListeners();
    } catch (error) {
      this.isConnected = false;

      logger.error("Failed to connect to NATS server", error instanceof Error ? error : undefined, {
        url: this.config.url,
        attempts: this.reconnectAttempts,
      });

      this.scheduleReconnect();
    }
  }

  /**
   * Setup connection event listeners
   */
  private setupConnectionListeners(): void {
    if (!this.connection) return;

    // Monitor connection state
    this.connection.closed().then((error) => {
      this.isConnected = false;

      if (error) {
        logger.error(
          "NATS connection closed with error",
          error instanceof Error ? error : undefined,
        );
        this.scheduleReconnect();
      } else {
        logger.info("NATS connection closed normally");
      }
    });
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error("Max NATS reconnect attempts reached, giving up", undefined, {
        maxAttempts: this.config.maxReconnectAttempts,
      });
      return;
    }
    if (!this.autoConnect) {
      return;
    }

    const delay = Math.min(
      this.config.reconnectTimeWait * 2 ** this.reconnectAttempts,
      30000, // Max 30 seconds
    );

    this.reconnectAttempts++;

    logger.info("Scheduling NATS reconnect", {
      attempt: this.reconnectAttempts,
      delay,
      maxAttempts: this.config.maxReconnectAttempts,
    });

    this.reconnectTimer = setTimeout(() => {
      this.initialize();
    }, delay);
  }

  /** Check if NATS publishing is available */
  private canPublish(): boolean {
    return Boolean(this.config.enabled && this.connection && this.isConnected);
  }

  /** Build topic string for event */
  private buildTopic(projectId: string, eventType: string): string {
    const topicSuffix = this.getTopicSuffix(eventType);
    return `${this.config.topicPrefix}.${projectId}.${topicSuffix}.updated`;
  }

  /** Build NATS event payload */
  private buildNatsEvent(
    topic: string,
    projectId: string,
    event: Omit<Event, "id" | "created_at" | "is_active" | "reverted_at">,
    specHash?: string,
  ): NatsSpecEvent {
    return {
      topic,
      projectId,
      event,
      metadata: {
        timestamp: getCurrentTimestamp(),
        specHash,
        sequence: ++this.eventSequence,
      },
    };
  }

  /**
   * Publish event to NATS topic for external agents
   */
  async publishEvent(
    projectId: string,
    event: Omit<Event, "id" | "created_at" | "is_active" | "reverted_at">,
    specHash?: string,
  ): Promise<void> {
    if (!this.canPublish()) return;

    try {
      const topic = this.buildTopic(projectId, event.event_type);
      const natsEvent = this.buildNatsEvent(topic, projectId, event, specHash);

      this.connection!.publish(topic, JSON.stringify(natsEvent));

      logger.debug("Published event to NATS", {
        topic,
        projectId,
        eventType: event.event_type,
        sequence: this.eventSequence,
      });
    } catch (error) {
      logger.error("Failed to publish event to NATS", error instanceof Error ? error : undefined, {
        projectId,
        eventType: event.event_type,
      });
    }
  }

  /** Event type to topic suffix mapping */
  private static readonly TOPIC_SUFFIX_MAP: Record<string, string> = {
    fragment_created: "fragment",
    fragment_updated: "fragment",
    fragment_deleted: "fragment",
    validation_started: "validation",
    validation_completed: "validation",
    validation_failed: "validation",
    version_frozen: "version",
  };

  /** Map event types to NATS topic suffixes */
  private getTopicSuffix(eventType: string): string {
    return NatsService.TOPIC_SUFFIX_MAP[eventType] ?? "general";
  }

  /**
   * Health check for NATS connection
   */
  getHealthStatus(): {
    enabled: boolean;
    connected: boolean;
    server?: string;
    reconnectAttempts: number;
    eventsPublished: number;
  } {
    return {
      enabled: this.config.enabled,
      connected: this.isConnected,
      server: this.connection?.getServer(),
      reconnectAttempts: this.reconnectAttempts,
      eventsPublished: this.eventSequence,
    };
  }

  /**
   * Get connection statistics
   */
  getStats(): {
    enabled: boolean;
    connected: boolean;
    eventsPublished: number;
    config: NatsConfig;
  } {
    return {
      enabled: this.config.enabled,
      connected: this.isConnected,
      eventsPublished: this.eventSequence,
      config: this.config,
    };
  }

  /**
   * Manually trigger reconnection (for testing/admin)
   */
  async reconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.reconnectAttempts = 0;
    await this.initialize();
  }

  /**
   * Close NATS connection and cleanup
   */
  async cleanup(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.connection) {
      try {
        await this.connection.close();
        logger.info("NATS connection closed successfully");
      } catch (error) {
        logger.error("Error closing NATS connection", error instanceof Error ? error : undefined);
      }

      this.connection = null;
      this.isConnected = false;
    }
  }
}
