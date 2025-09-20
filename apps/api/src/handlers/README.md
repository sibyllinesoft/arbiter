# Custom Webhook Handlers System

A comprehensive system for creating, managing, and executing custom webhook
handlers in Arbiter. This system allows you to extend webhook processing with
custom JavaScript/TypeScript code that runs securely in a sandboxed environment.

## Architecture Overview

The custom handlers system consists of several key components:

- **Handler Discovery**: Automatically discovers and loads handler files from
  the filesystem
- **Handler Execution**: Executes handlers with timeout, retry logic, and error
  handling
- **Handler Management**: Provides APIs for managing handler lifecycle and
  configuration
- **Security Layer**: Sandboxes handler execution with rate limiting and domain
  restrictions
- **Web UI Integration**: RESTful APIs for frontend management interfaces

## Directory Structure

```
./packages/arbiter-core/src/handlers/
├── github/                      # GitHub event handlers
│   ├── push.ts                  # Handle push events
│   ├── pull_request.ts          # Handle PR events
│   ├── issues.ts                # Handle issue events
│   └── release.ts               # Handle release events
├── gitlab/                      # GitLab event handlers
│   ├── push.ts                  # Handle push hooks
│   ├── merge_request.ts         # Handle MR hooks
│   ├── pipeline.ts              # Handle pipeline hooks
│   └── tag.ts                   # Handle tag hooks
├── shared/                      # Shared utilities
│   ├── utils.ts                 # Common handler utilities
│   ├── validators.ts            # Input validation helpers
│   └── types.ts                 # Custom handler types
├── examples/                    # Example handlers
│   ├── slack-notification.ts    # Example Slack integration
│   ├── jira-integration.ts      # Example JIRA integration
│   └── spec-validator.ts        # Example spec validation
└── .handlers-config.json        # Handler configuration
```

## Handler API

### Basic Handler Structure

```typescript
import type { HandlerModule, WebhookHandler } from '../types.js';

const handleEvent: WebhookHandler = async (payload, context) => {
  const { logger, services, projectId, config } = context;
  const { parsed } = payload;

  try {
    // Your handler logic here
    logger.info('Processing event', {
      event: parsed.eventType,
      repository: parsed.repository.fullName,
    });

    // Use services for external integrations
    await services.notifications.sendSlack(config.secrets['SLACK_WEBHOOK'], {
      text: `Event received: ${parsed.eventType}`,
    });

    return {
      success: true,
      message: 'Event processed successfully',
      actions: ['Sent notification'],
      data: { processedAt: new Date().toISOString() },
    };
  } catch (error) {
    logger.error('Handler failed', error as Error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      errors: [
        {
          code: 'HANDLER_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      ],
    };
  }
};

const handlerModule: HandlerModule = {
  handler: handleEvent,
  config: {
    enabled: true,
    timeout: 30000,
    retries: 2,
    environment: {},
    secrets: {},
  },
  metadata: {
    name: 'My Custom Handler',
    description: 'Handles webhook events with custom logic',
    version: '1.0.0',
    supportedEvents: ['push', 'pull_request'],
    requiredPermissions: ['notifications:send'],
  },
};

export default handlerModule;
```

### Handler Context

The handler receives a context object with the following services:

```typescript
interface HandlerContext {
  projectId: string; // Current project ID
  config: HandlerConfig; // Handler configuration
  logger: Logger; // Scoped logger
  services: HandlerServices; // Available services
  metadata: HandlerMetadata; // Execution metadata
}
```

### Available Services

#### HTTP Client

```typescript
// Secure HTTP client with domain restrictions and rate limiting
await services.http.get('https://api.github.com/user');
await services.http.post('https://api.example.com/webhook', { data: 'value' });
```

#### Notifications

```typescript
// Send Slack notifications
await services.notifications.sendSlack(webhookUrl, {
  text: 'Notification message',
  blocks: [...] // Slack block kit format
});

// Send generic webhooks
await services.notifications.sendWebhook(url, payload);

// Send email notifications (requires HANDLER_EMAIL_* configuration)
await services.notifications.sendEmail('owner@example.com', 'Handler alert', 'Details');
```

Email delivery is disabled by default. Enable or change behaviour via
environment variables:

```
HANDLER_EMAIL_MODE=log            # log-only mode for development (no external calls)
HANDLER_EMAIL_MODE=smtp           # enable SMTP delivery (requires the vars below)
HANDLER_EMAIL_FROM=arbiter@example.com
HANDLER_EMAIL_SMTP_HOST=smtp.example.com
HANDLER_EMAIL_SMTP_PORT=587       # optional, defaults to 587
HANDLER_EMAIL_SMTP_SECURE=false   # optional, set true for SMTPS/465
HANDLER_EMAIL_SMTP_USER=apikey
HANDLER_EMAIL_SMTP_PASS=secret
```

When `HANDLER_EMAIL_MODE=log`, the API records the attempted email without
contacting an SMTP server—useful for tests and sandboxes. When set to `smtp`,
the notification service will send messages using the configured credentials and
propagate any delivery failures back to the handler.

#### Events

```typescript
// Broadcast events to project subscribers
await services.events.broadcastToProject(projectId, {
  project_id: projectId,
  event_type: 'custom_event',
  data: { message: 'Custom event data' },
});
```

#### Database

```typescript
// Access project database
const projects = await services.db.listProjects();
const fragments = await services.db.listFragments(projectId);
```

### Enhanced Payload

Handlers receive an enhanced payload with parsed event data:

```typescript
interface EnhancedWebhookPayload {
  // Original webhook payload
  repository: { full_name: string /* ... */ };
  commits?: Array<{
    /* ... */
  }>;
  // ... other original fields

  // Parsed and normalized data
  parsed: {
    eventType: string;
    action?: string;
    author: {
      name: string;
      email?: string;
      username?: string;
    };
    repository: {
      name: string;
      fullName: string;
      owner: string;
      url: string;
      defaultBranch: string;
      isPrivate: boolean;
    };
    commits?: Array<{
      sha: string;
      message: string;
      author: string;
      url: string;
      timestamp: string;
      added: string[];
      modified: string[];
      removed: string[];
    }>;
    pullRequest?: {
      /* ... */
    };
    issue?: {
      /* ... */
    };
  };
}
```

## API Endpoints

### Handler Management

- `GET /api/handlers` - List all handlers
- `GET /api/handlers/:id` - Get specific handler
- `PUT /api/handlers/:id` - Update handler configuration
- `DELETE /api/handlers/:id` - Remove handler
- `POST /api/handlers/:id/toggle` - Enable/disable handler
- `POST /api/handlers/:id/reload` - Reload handler from file

### Handler Operations

- `POST /api/handlers/init` - Initialize handler directory structure
- `POST /api/handlers/validate` - Validate handler code
- `GET /api/handlers/stats` - Get system statistics
- `GET /api/handlers/executions` - Get execution history

### Query Parameters

#### List Handlers (`GET /api/handlers`)

- `provider` - Filter by provider (github/gitlab)
- `event` - Filter by event type
- `enabled` - Filter by enabled status

#### Execution History (`GET /api/handlers/executions`)

- `handlerId` - Filter by handler ID
- `projectId` - Filter by project ID
- `provider` - Filter by provider
- `event` - Filter by event type
- `limit` - Limit results (default: 100)
- `offset` - Offset for pagination

## Configuration

### Handler Configuration (`.handlers-config.json`)

```json
{
  "$schema": "./handler-config.schema.json",
  "defaults": {
    "timeout": 30000,
    "retries": 2,
    "enabled": true
  },
  "handlers": {
    "github/push": {
      "enabled": true,
      "timeout": 15000,
      "environment": {
        "NODE_ENV": "production"
      },
      "secrets": {
        "SLACK_WEBHOOK": "${HANDLER_SLACK_WEBHOOK}",
        "JIRA_TOKEN": "${HANDLER_JIRA_TOKEN}"
      }
    }
  }
}
```

### Server Configuration

Add to your server configuration:

```typescript
{
  handlers: {
    enableAutoReload: false,
    maxConcurrentExecutions: 10,
    defaultTimeout: 30000,
    defaultRetries: 2,
    sandboxEnabled: true,
    allowedModules: [
      'node:crypto', 'node:util', 'node:url', 'node:path'
    ],
    enableMetrics: true
  }
}
```

## Security Features

### Sandboxing

- Code validation prevents dangerous patterns (`eval`, `require`, etc.)
- Environment variable sanitization (only `HANDLER_*` prefixed variables
  allowed)
- Module import restrictions
- File system access prevention

### Network Security

- HTTP client domain whitelist
- HTTPS enforcement (except localhost)
- Rate limiting (60 requests per minute per handler)
- SSRF protection

### Resource Limits

- Execution timeout enforcement
- Concurrent execution limits
- Memory usage monitoring
- Error rate tracking

## Best Practices

### Handler Development

1. **Error Handling**: Always wrap handler logic in try/catch blocks
2. **Logging**: Use `context.logger` for consistent logging with correlation IDs
3. **Idempotency**: Design handlers to handle duplicate events gracefully
4. **Resource Cleanup**: Ensure handlers don't leak resources or connections
5. **Testing**: Test handlers with various payload scenarios

### Configuration Management

1. **Secrets**: Store sensitive data in handler secrets, not environment
   variables
2. **Timeouts**: Set appropriate timeouts based on handler complexity
3. **Retries**: Configure retries for network-dependent operations
4. **Environment**: Use environment variables for configuration, secrets for
   credentials

### Performance Optimization

1. **Async Operations**: Use async/await for all I/O operations
2. **Batch Operations**: Group multiple API calls when possible
3. **Caching**: Cache expensive computations or API responses
4. **Early Returns**: Return early from handlers when conditions aren't met

## Monitoring and Debugging

### Metrics

- Handler execution count and success rate
- Average execution time and error rate
- Active execution monitoring
- Resource usage tracking

### Logging

- Structured JSON logging with correlation IDs
- Handler-specific log namespacing
- Execution lifecycle logging
- Error stack traces and context

### Debugging

- Handler validation before execution
- Execution history with full context
- Error reporting with detailed stack traces
- Performance profiling data

## Examples

See the `examples/` directory for complete handler implementations:

- [`push-handler.ts`](examples/push-handler.ts) - Basic push event handling
- [`slack-notification.ts`](examples/slack-notification.ts) - Slack integration
- [`spec-validator.ts`](examples/spec-validator.ts) - CUE spec validation

## Frontend Integration

The system provides a complete REST API for building management interfaces:

### Handler List View

```typescript
// Fetch all handlers
const response = await fetch('/api/handlers');
const { handlers } = await response.json();
```

### Handler Editor

```typescript
// Get handler details
const handler = await fetch(`/api/handlers/${id}`).then(r => r.json());

// Update handler configuration
await fetch(`/api/handlers/${id}`, {
  method: 'PUT',
  body: JSON.stringify({ config: updatedConfig }),
});
```

### Execution Monitoring

```typescript
// Get execution history
const executions = await fetch('/api/handlers/executions?limit=50').then(r =>
  r.json()
);

// Get real-time statistics
const stats = await fetch('/api/handlers/stats').then(r => r.json());
```

## Migration and Deployment

### Initial Setup

1. Initialize handler directory structure: `POST /api/handlers/init`
2. Create your first handler files in the appropriate directories
3. Configure secrets and environment variables
4. Test handlers with validation endpoint
5. Enable handlers through the API

### Production Deployment

1. Disable auto-reload in production
2. Set appropriate resource limits
3. Configure monitoring and alerting
4. Implement handler backup and recovery
5. Set up log aggregation and analysis

This system provides a powerful, secure, and extensible way to customize webhook
processing in Arbiter while maintaining safety and observability.
