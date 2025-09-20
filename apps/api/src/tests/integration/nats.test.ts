/**
 * NATS integration tests
 */
import { type NatsConnection, connect } from 'nats';
import { NatsService } from '../../nats.ts';
import type { Event, NatsConfig } from '../../types.ts';

describe('NATS Integration', () => {
  let natsService: NatsService;
  let testConnection: NatsConnection | null = null;
  let natsAvailable = false;
  const TEST_NATS_URL = 'nats://localhost:4222';

  beforeAll(async () => {
    // Skip tests if no NATS server available
    try {
      testConnection = await connect({
        servers: [TEST_NATS_URL],
        timeout: 2000,
      });
      natsAvailable = true;
    } catch (_error) {
      console.warn('NATS server not available, skipping NATS tests');
      return;
    }
  });

  afterAll(async () => {
    if (testConnection) {
      await testConnection.close();
    }
    if (natsService) {
      await natsService.cleanup();
    }
  });

  describe('NatsService', () => {
    it('should initialize with NATS disabled by default', () => {
      const service = new NatsService();
      const stats = service.getStats();

      expect(stats.enabled).toBe(false);
      expect(stats.connected).toBe(false);
    });

    it('should enable NATS when URL is provided', () => {
      if (!natsAvailable) return;

      const config: NatsConfig = {
        url: TEST_NATS_URL,
        enabled: true,
        reconnectTimeWait: 1000,
        maxReconnectAttempts: 3,
        topicPrefix: 'test-spec',
      };

      natsService = new NatsService(config);
      const stats = natsService.getStats();

      expect(stats.enabled).toBe(true);
      expect(stats.config.topicPrefix).toBe('test-spec');
    });

    it('should publish events to NATS topics', async () => {
      if (!natsAvailable || !testConnection) return;

      const config: NatsConfig = {
        url: TEST_NATS_URL,
        enabled: true,
        reconnectTimeWait: 1000,
        maxReconnectAttempts: 3,
        topicPrefix: 'test-spec',
      };

      natsService = new NatsService(config);

      // Give service time to connect
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Subscribe to test topic
      const subscription = testConnection.subscribe('test-spec.project123.fragment.updated');
      const messagePromise = new Promise(resolve => {
        subscription.then(async sub => {
          for await (const message of sub) {
            const event = JSON.parse(message.data.toString());
            resolve(event);
            break;
          }
        });
      });

      // Publish test event
      const testEvent: Omit<Event, 'id' | 'created_at'> = {
        project_id: 'project123',
        event_type: 'fragment_updated',
        data: {
          path: 'test.cue',
          content: 'package test\n\nvalue: 42',
        },
      };

      await natsService.publishEvent('project123', testEvent, 'testhash123');

      // Wait for message
      const receivedEvent = (await Promise.race([
        messagePromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000)),
      ])) as any;

      expect(receivedEvent.topic).toBe('test-spec.project123.fragment.updated');
      expect(receivedEvent.projectId).toBe('project123');
      expect(receivedEvent.event.event_type).toBe('fragment_updated');
      expect(receivedEvent.event.project_id).toBe('project123');
      expect(receivedEvent.metadata.specHash).toBe('testhash123');
      expect(receivedEvent.metadata.sequence).toBeGreaterThan(0);
    });

    it('should handle NATS unavailability gracefully', async () => {
      const config: NatsConfig = {
        url: 'nats://nonexistent:4222',
        enabled: true,
        reconnectTimeWait: 100,
        maxReconnectAttempts: 1,
        topicPrefix: 'test-spec',
      };

      const service = new NatsService(config);

      // Publishing should not throw even if NATS is unavailable
      const testEvent: Omit<Event, 'id' | 'created_at'> = {
        project_id: 'project123',
        event_type: 'fragment_updated',
        data: { test: true },
      };

      await expect(service.publishEvent('project123', testEvent)).resolves.toBeUndefined();

      const stats = service.getStats();
      expect(stats.enabled).toBe(true);
      expect(stats.connected).toBe(false);

      await service.cleanup();
    });
  });

  describe('Event Topic Mapping', () => {
    it('should map fragment events correctly', () => {
      if (!natsAvailable) return;

      const config: NatsConfig = {
        url: TEST_NATS_URL,
        enabled: true,
        reconnectTimeWait: 1000,
        maxReconnectAttempts: 3,
        topicPrefix: 'spec',
      };

      const service = new NatsService(config);

      // Test topic mapping via reflection (accessing private method for testing)
      const getTopicSuffix = (service as any).getTopicSuffix.bind(service);

      expect(getTopicSuffix('fragment_created')).toBe('fragment');
      expect(getTopicSuffix('fragment_updated')).toBe('fragment');
      expect(getTopicSuffix('fragment_deleted')).toBe('fragment');
      expect(getTopicSuffix('validation_started')).toBe('validation');
      expect(getTopicSuffix('validation_completed')).toBe('validation');
      expect(getTopicSuffix('validation_failed')).toBe('validation');
      expect(getTopicSuffix('version_frozen')).toBe('version');
      expect(getTopicSuffix('unknown_event')).toBe('general');
    });
  });
});
