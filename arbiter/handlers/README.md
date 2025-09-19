# Arbiter Webhook Handlers

This directory contains the webhook handler system for Arbiter, providing
automated processing of events from various Git hosting platforms including
GitHub, GitLab, and others.

## 📁 Directory Structure

```
handlers/
├── github/                 # GitHub-specific handlers
│   ├── push-handler.ts    # Handles push events with branch protection
│   └── pr-handler.ts      # Handles PR events with workflow validation
├── gitlab/                # GitLab-specific handlers
│   └── merge-request.ts   # Handles MR events with branch validation
├── shared/                # Shared utilities and types
│   └── utils.ts          # Common handler utilities and validation
├── config/               # Configuration files
│   └── handlers.json     # Handler settings and rules
└── README.md            # This documentation
```

## 🚀 Quick Start

### 1. Configuration

The handler system is configured via `config/handlers.json`. Key settings
include:

```json
{
  "handlers": {
    "github": {
      "push": {
        "enabled": true,
        "validateBranchNaming": true,
        "requireConventionalCommits": true
      }
    }
  }
}
```

### 2. Basic Handler Implementation

Each handler follows this pattern:

```typescript
import type { WebhookEvent, HandlerResponse } from '../shared/utils.js';

export async function handleEvent(
  event: WebhookEvent
): Promise<HandlerResponse> {
  // Validation logic
  // Business logic
  // Return standardized response
}
```

### 3. Handler Registration

Handlers are automatically discovered and registered based on the configuration
file structure.

## 🔧 Available Handlers

### GitHub Handlers

#### Push Handler (`github/push-handler.ts`)

- **Purpose**: Processes push events with branch protection and commit
  validation
- **Features**:
  - Branch naming convention validation
  - Conventional commit message checking
  - Protected branch enforcement
  - Commit count limits for protected branches

**Example Usage:**

```bash
# Webhook endpoint: POST /webhooks/github
# Event type: push
```

#### Pull Request Handler (`github/pr-handler.ts`)

- **Purpose**: Validates PR events and enforces workflow rules
- **Features**:
  - Branch naming validation (feature/, hotfix/)
  - PR title conventional commit format checking
  - Required description validation
  - Target branch validation
  - Workflow enforcement (feature → develop, hotfix → main)

**Example Usage:**

```bash
# Webhook endpoint: POST /webhooks/github
# Event type: pull_request
```

### GitLab Handlers

#### Merge Request Handler (`gitlab/merge-request.ts`)

- **Purpose**: Handles GitLab MR events with comprehensive validation
- **Features**:
  - Branch naming convention enforcement
  - MR title conventional format validation
  - Description requirement checking
  - Target branch validation
  - Merge conflict detection

**Example Usage:**

```bash
# Webhook endpoint: POST /webhooks/gitlab
# Event type: merge_request
```

## 📋 Branch Naming Conventions

The handlers enforce these branch naming patterns:

| Branch Type | Pattern                      | Example                 |
| ----------- | ---------------------------- | ----------------------- |
| Feature     | `feature/[a-z0-9-]+`         | `feature/user-auth`     |
| Hotfix      | `hotfix/[a-z0-9-]+`          | `hotfix/security-patch` |
| Bugfix      | `bugfix/[a-z0-9-]+`          | `bugfix/login-error`    |
| Release     | `release/v?\d+\.\d+(\.\d+)?` | `release/v1.2.0`        |

## 🎯 Conventional Commits

Handlers validate commit messages and PR/MR titles against conventional commit
format:

```
type(scope): description

Examples:
- feat(auth): add OAuth2 integration
- fix(ui): resolve button alignment issue
- docs(api): update authentication guide
```

**Supported Types:**

- `feat` - New features
- `fix` - Bug fixes
- `docs` - Documentation changes
- `style` - Code style changes
- `refactor` - Code refactoring
- `test` - Test additions/changes
- `chore` - Build/tooling changes
- `ci` - CI configuration changes
- `perf` - Performance improvements
- `revert` - Reverts previous commits

## 🛠️ Development Guide

### Creating a New Handler

1. **Create the handler file:**

```typescript
// handlers/provider/event-handler.ts
import type { WebhookEvent, HandlerResponse } from '../shared/utils.js';
import { logEvent, validatePayload, createResponse } from '../shared/utils.js';

export async function handleMyEvent(
  event: WebhookEvent
): Promise<HandlerResponse> {
  try {
    // Validate payload
    const validation = validatePayload(event.payload, ['required_field']);
    if (!validation.isValid) {
      return createResponse(
        false,
        `Validation failed: ${validation.errors.join(', ')}`
      );
    }

    // Process event
    await logEvent({
      type: 'provider.event',
      timestamp: new Date().toISOString(),
      // ... event data
    });

    // Return success
    return createResponse(true, 'Event processed successfully', {
      /* metadata */
    });
  } catch (error) {
    return createResponse(false, `Handler error: ${error.message}`);
  }
}

export const config = {
  name: 'my-handler',
  description: 'Handles my custom events',
  version: '1.0.0',
  events: ['my_event'],
  provider: 'my_provider',
  enabled: true,
};
```

2. **Update configuration:**

```json
{
  "handlers": {
    "my_provider": {
      "myEvent": {
        "enabled": true,
        "handler": "./provider/event-handler.ts",
        "config": {
          "events": ["my_event"]
        }
      }
    }
  }
}
```

### Testing Handlers

Create test files following this pattern:

```typescript
// handlers/__tests__/my-handler.test.ts
import { handleMyEvent } from '../provider/event-handler.js';
import type { WebhookEvent } from '../shared/utils.js';

describe('My Handler', () => {
  it('should process valid events', async () => {
    const event: WebhookEvent = {
      id: 'test-123',
      timestamp: new Date().toISOString(),
      provider: 'my_provider',
      eventType: 'my_event',
      payload: {
        /* test data */
      },
      headers: {},
    };

    const result = await handleMyEvent(event);
    expect(result.success).toBe(true);
  });
});
```

## 📊 Shared Utilities

### Core Functions

**`createResponse(success, message, metadata?)`**

- Creates standardized handler responses

**`validatePayload(payload, requiredFields)`**

- Validates webhook payload structure

**`logEvent(event)`**

- Logs events for debugging and auditing

**`validateBranchNaming(branchName)`**

- Validates branch naming conventions

**`validateConventionalCommit(message)`**

- Validates conventional commit format

### Validation Helpers

**`isProtectedBranch(branchName)`**

- Checks if branch is protected (main/master/develop)

**`extractRepositoryInfo(payload, provider)`**

- Extracts repository information from different providers

**`sanitizePayload(payload)`**

- Removes sensitive data from payloads before logging

## 🔐 Security Features

### Signature Validation

Handlers support webhook signature validation for security:

```typescript
import { validateSignature } from '../shared/utils.js';

const isValid = validateSignature(payloadString, signature, secret, provider);
```

### Rate Limiting

Built-in rate limiting prevents abuse:

```json
{
  "security": {
    "rateLimiting": {
      "windowMs": 900000,
      "maxRequests": 100
    }
  }
}
```

## 📝 Logging and Monitoring

### Event Logging

All events are logged to daily files:

```
logs/handlers/
├── 2024-01-01.log
├── 2024-01-02.log
└── ...
```

### Log Format

```json
{
  "type": "github.push",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "repository": "owner/repo",
  "branch": "feature/new-feature",
  "pusher": "developer",
  "commitCount": 3
}
```

### Health Monitoring

Health check endpoint provides system status:

```bash
GET /health
{
  "status": "healthy",
  "handlers": {
    "github": { "status": "active", "lastEvent": "2024-01-01T12:00:00Z" },
    "gitlab": { "status": "active", "lastEvent": "2024-01-01T11:30:00Z" }
  }
}
```

## 🚀 Integration Examples

### GitHub Webhook Setup

1. Go to repository Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/webhooks/github`
3. Select events: Push, Pull Request
4. Add secret token
5. Set content type to `application/json`

### GitLab Webhook Setup

1. Go to project Settings → Webhooks
2. Add webhook URL: `https://your-domain.com/webhooks/gitlab`
3. Select triggers: Push, Merge Request
4. Add secret token
5. Enable SSL verification

## 📚 API Reference

### WebhookEvent Interface

```typescript
interface WebhookEvent {
  id: string;
  timestamp: string;
  provider: 'github' | 'gitlab' | 'bitbucket' | 'azure-devops';
  eventType: string;
  payload: Record<string, any>;
  headers: Record<string, string>;
  signature?: string;
}
```

### HandlerResponse Interface

```typescript
interface HandlerResponse {
  success: boolean;
  message: string;
  metadata?: Record<string, any>;
  timestamp: string;
}
```

## ❗ Error Handling

Handlers use standardized error responses:

```typescript
// Validation errors
return createResponse(false, 'Invalid branch naming: feature/INVALID-NAME');

// System errors
return createResponse(false, 'Handler error: Database connection failed');

// Success with warnings
return createResponse(true, 'Processed with warnings', { warnings: [...] });
```

## 🔧 Configuration Reference

See `config/handlers.json` for full configuration options including:

- Handler enable/disable flags
- Branch naming rules and patterns
- Conventional commit type definitions
- Webhook endpoint configuration
- Security settings
- Monitoring configuration
- Notification settings

## 📈 Performance Considerations

- Handlers process events asynchronously
- Failed handlers are retried with exponential backoff
- Event logs are rotated daily to manage disk usage
- Rate limiting prevents system overload
- Handlers timeout after 30 seconds by default

## 🤝 Contributing

1. Follow the established handler patterns
2. Add comprehensive tests for new handlers
3. Update configuration documentation
4. Validate against security best practices
5. Include logging for debugging purposes

---

_For more information, see the main Arbiter documentation or contact the
development team._
