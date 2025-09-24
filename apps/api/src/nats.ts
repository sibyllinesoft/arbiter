/**
 * NATS integration service for external agent communication
 * Publishes spec events to NATS topics for external AI agents to consume
 */
import { type ConnectionOptions, type NatsConnection, connect } from 'nats';
import type { Event, NatsConfig, NatsSpecEvent } from './types';
import { getCurrentTimestamp, logger } from './utils';

export class NatsService {
  private connection: NatsConnection | null = null;
  private config: NatsConfig;
  private isConnected = false;
  private reconnectAttempts = 0;
  private eventSequence = 0;
  private reconnectTimer?: Timer;

  constructor(config?: NatsConfig) {
    this.config = {
      url: process.env.NATS_URL || 'nats://localhost:4222',
      enabled: !!process.env.NATS_URL || false,
      reconnectTimeWait: 2000, // Start with 2 seconds
      maxReconnectAttempts: 10,
      topicPrefix: 'spec',
      ...config,
    };

    if (this.config.enabled) {
      this.initialize();
    } else {
      logger.info('NATS integration disabled - no NATS_URL configured');
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

      logger.info('Connecting to NATS server', {
        url: this.config.url,
        options: connectionOptions,
      });

      this.connection = await connect(connectionOptions);
      this.isConnected = true;
      this.reconnectAttempts = 0;

      logger.info('Successfully connected to NATS server', {
        server: this.connection.getServer(),
      });

      // Set up event listeners
      this.setupConnectionListeners();
    } catch (error) {
      this.isConnected = false;

      logger.error('Failed to connect to NATS server', error instanceof Error ? error : undefined, {
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
    this.connection.closed().then(error => {
      this.isConnected = false;

      if (error) {
        logger.error(
          'NATS connection closed with error',
          error instanceof Error ? error : undefined
        );
        this.scheduleReconnect();
      } else {
        logger.info('NATS connection closed normally');
      }
    });
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      logger.error('Max NATS reconnect attempts reached, giving up', undefined, {
        maxAttempts: this.config.maxReconnectAttempts,
      });
      return;
    }

    const delay = Math.min(
      this.config.reconnectTimeWait * 2 ** this.reconnectAttempts,
      30000 // Max 30 seconds
    );

    this.reconnectAttempts++;

    logger.info('Scheduling NATS reconnect', {
      attempt: this.reconnectAttempts,
      delay,
      maxAttempts: this.config.maxReconnectAttempts,
    });

    this.reconnectTimer = setTimeout(() => {
      this.initialize();
    }, delay);
  }

  /**
   * Publish event to NATS topic for external agents
   */
  async publishEvent(
    projectId: string,
    event: Omit<Event, 'id' | 'created_at'>,
    specHash?: string
  ): Promise<void> {
    // Always return early if NATS is disabled - no impact on core functionality
    if (!this.config.enabled || !this.connection || !this.isConnected) {
      return;
    }

    try {
      // Map event type to topic suffix
      const topicSuffix = this.getTopicSuffix(event.event_type);
      const topic = `${this.config.topicPrefix}.${projectId}.${topicSuffix}.updated`;

      const natsEvent: NatsSpecEvent = {
        topic,
        projectId,
        event,
        metadata: {
          timestamp: getCurrentTimestamp(),
          specHash,
          sequence: ++this.eventSequence,
        },
      };

      // Publish to NATS (fire and forget for performance)
      this.connection.publish(topic, JSON.stringify(natsEvent));

      logger.debug('Published event to NATS', {
        topic,
        projectId,
        eventType: event.event_type,
        sequence: this.eventSequence,
      });
    } catch (error) {
      // Log error but don't throw - NATS failures should never break core functionality
      logger.error('Failed to publish event to NATS', error instanceof Error ? error : undefined, {
        projectId,
        eventType: event.event_type,
      });
    }
  }

  /**
   * Map event types to NATS topic suffixes
   */
  private getTopicSuffix(eventType: string): string {
    switch (eventType) {
      case 'fragment_created':
      case 'fragment_updated':
      case 'fragment_deleted':
        return 'fragment';

      case 'validation_started':
      case 'validation_completed':
      case 'validation_failed':
        return 'validation';

      case 'version_frozen':
        return 'version';

      default:
        return 'general';
    }
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
        logger.info('NATS connection closed successfully');
      } catch (error) {
        logger.error('Error closing NATS connection', error instanceof Error ? error : undefined);
      }

      this.connection = null;
      this.isConnected = false;
    }
  }
}
