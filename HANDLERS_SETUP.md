# Arbiter Webhook Handlers Setup Guide

## Overview

Arbiter includes a powerful webhook handler system that allows you to create
custom handlers for GitHub and GitLab webhook events. These handlers can perform
actions like code review, notifications, deployments, and more.

## Setup Instructions

### 1. Enable Handlers in Your Environment

Start the Arbiter development server with handlers enabled:

```bash
WEBHOOKS_ENABLED=true HANDLERS_ENABLED=true bun run dev
```

For AI-powered handlers (code review, documentation), also add:

```bash
AI_AGENTS_ENABLED=true ANTHROPIC_API_KEY=your-key OPENAI_API_KEY=your-key
```

### 2. Initialize Handler Directory Structure

The handler system looks for handlers in `./arbiter/handlers/` directory.
Initialize it:

```bash
curl -X POST http://localhost:5050/api/handlers/init
```

This creates the following structure:

```
arbiter/handlers/
├── github/           # GitHub event handlers
├── gitlab/           # GitLab event handlers
├── shared/           # Shared utilities
├── examples/         # Example handlers
└── types.ts          # Type definitions
```

### 3. Create Your First Handler

Here's a simple example handler for GitHub push events:

```typescript
// arbiter/handlers/github/my-push-handler.ts
import type { HandlerModule, WebhookHandler } from '../types';

const handlePushEvent: WebhookHandler = async (payload, context) => {
  const { logger, projectId } = context;
  const { parsed } = payload;

  logger.info('Processing push event', {
    repository: parsed.repository?.full_name,
    branch: parsed.ref?.replace('refs/heads/', ''),
    commits: parsed.commits?.length || 0,
  });

  // Your custom logic here
  // - Send notifications
  // - Trigger builds
  // - Update databases
  // - Call APIs

  return {
    success: true,
    message: 'Push processed successfully',
    actions: ['notification_sent', 'build_triggered'],
  };
};

export default {
  handler: handlePushEvent,
  config: {
    enabled: true,
    events: ['push'],
    timeout: 30000,
    retries: 2,
  },
  metadata: {
    id: 'my-push-handler',
    name: 'My Push Handler',
    description: 'Handles GitHub push events',
    version: '1.0.0',
  },
} satisfies HandlerModule;
```

### 4. Check Available Handlers

List all loaded handlers:

```bash
curl http://localhost:5050/api/handlers | jq '.'
```

### 5. Test Your Handler

#### Option A: Using the Test Endpoint

```bash
curl -X POST http://localhost:5050/api/handlers/my-push-handler/test \
  -H "Content-Type: application/json" \
  -d '{
    "repository": {"full_name": "user/repo"},
    "ref": "refs/heads/main",
    "commits": [{"message": "Test commit"}]
  }'
```

#### Option B: Using Real Webhooks

1. Set up a Cloudflare tunnel:

```bash
./scripts/cloudflare-tunnel.sh start
```

2. Configure webhook in GitHub:
   - URL: `https://your-tunnel.cfargotunnel.com/webhooks/github`
   - Content type: `application/json`
   - Secret: Your webhook secret
   - Events: Select the events your handler processes

3. Trigger the event (e.g., push code to the repository)

### 6. View Handler Executions

Check handler execution history:

```bash
curl http://localhost:5050/api/handlers/executions | jq '.'
```

## Handler Types

### Basic Event Handlers

- **Push Handler**: Triggered on code pushes
- **PR Handler**: Triggered on pull request events
- **Issue Handler**: Triggered on issue events
- **Release Handler**: Triggered on release events

### AI-Powered Handlers (requires API keys)

- **Code Review Agent**: Automated code review on PRs
- **Documentation Agent**: Auto-generates documentation
- **Security Agent**: Security vulnerability scanning
- **Issue Analysis Agent**: Analyzes and labels issues

## Handler Configuration

Handlers can be configured with:

- **events**: Which webhook events to handle
- **timeout**: Maximum execution time
- **retries**: Number of retry attempts
- **filters**: Branch, author, or path filters

## Using Handler Services

Handlers have access to services:

```typescript
const { http, notifications, git, db, events } = context.services;

// Make HTTP requests
await http.post('https://api.example.com', { data });

// Send notifications
await notifications.email({
  to: 'user@example.com',
  subject: 'Build Complete',
  body: 'Your build has completed',
});

// Access git operations
const diff = await git.getDiff(commitSha);

// Database operations
await db.saveExecution(handlerResult);

// Emit events
await events.emit('handler.executed', result);
```

## Troubleshooting

### Handlers not loading?

1. Check that `HANDLERS_ENABLED=true` is set
2. Verify handler files are in `./arbiter/handlers/` directory
3. Check server logs for loading errors
4. Ensure handler exports match the `HandlerModule` interface

### Handler not executing?

1. Verify handler is enabled in config
2. Check event type matches webhook event
3. Review handler logs in server output
4. Check execution history for errors

### Testing locally without tunnel?

Use the test endpoint to simulate webhook payloads:

```bash
curl -X POST http://localhost:5050/api/handlers/[handler-id]/test \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

## Web UI Access

Unfortunately, the web UI for handler management is not yet fully integrated.
For now, use the API endpoints directly:

- List handlers: `GET /api/handlers`
- Get handler details: `GET /api/handlers/:id`
- Toggle handler: `POST /api/handlers/:id/toggle`
- View executions: `GET /api/handlers/executions`
- Test handler: `POST /api/handlers/:id/test`

## Next Steps

1. Copy built-in handlers from `packages/arbiter-core/src/handlers/` for
   examples
2. Create custom handlers for your specific workflows
3. Set up webhook endpoints in your repositories
4. Monitor handler executions and adjust as needed

For more advanced handler development, see the built-in AI agents in:

- `packages/arbiter-core/src/handlers/ai/agents/`
- `packages/arbiter-core/src/handlers/ai/adapters/`
