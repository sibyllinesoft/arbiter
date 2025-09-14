# Arbiter

**The agent-first framework for generating reliable, full-stack applications from a single CUE specification.**

[![License](https://img.shields.io/badge/license-LicenseRef--SPL--1.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![CUE](https://img.shields.io/badge/CUE-configuration-green)](https://cuelang.org/)
[![Bun](https://img.shields.io/badge/Bun-000000?logo=bun&logoColor=white)](https://bun.sh/)

> **Agent-First Design**: Built from the ground up to work seamlessly with AI agents and automated workflows. Non-interactive commands, structured outputs, and comprehensive APIs make Arbiter the ideal choice for AI-driven development.

## What is Arbiter?

Arbiter is a sophisticated specification validation and code generation framework that transforms a single CUE specification into complete, production-ready applications. Unlike traditional code generators, Arbiter follows a **Domain → Contracts → Capabilities → Execution** architecture that ensures consistency, maintainability, and reliability across your entire stack.

### Key Features

🤖 **Agent-First Architecture**: Designed for AI and automation with non-interactive commands and structured outputs  
📝 **CUE-Powered**: Leverage CUE's type safety and validation for bulletproof specifications  
🏗️ **Full-Stack Generation**: From database schemas to UI components to CI/CD pipelines  
🔄 **Live Validation**: Real-time specification checking with instant feedback  
🎯 **Deterministic Output**: Same specification always generates identical code  
🌐 **Modern Tech Stack**: Built with Bun, TypeScript, React, and cutting-edge tools  
🚀 **Webhook Integration**: GitHub and GitLab webhook support with secure custom handlers  
🔒 **Secure Tunneling**: Cloudflare tunnel integration with IP filtering and path restrictions  
🤖 **AI Agents**: Built-in AI agents for code review, issue analysis, and documentation  

## Quick Start

### Installation

```bash
# Via Bun (recommended)
bun install -g arbiter-cli

# Via NPM
npm install -g arbiter-cli

# Or download the standalone binary from releases
curl -L https://github.com/arbiter-framework/arbiter/releases/latest/download/arbiter-cli > arbiter
chmod +x arbiter
```

### Create Your First Project

```bash
# Initialize a new project in the current directory
mkdir my-app && cd my-app
arbiter init "My Application"

# Add your first component
arbiter add service user-service
arbiter add endpoint POST /users

# Generate the complete application
arbiter generate

# Validate everything is correct
arbiter check
```

### Architecture Overview

Arbiter follows a layered specification approach:

```
Domain Models     ← Pure business logic and data structures
     ↓
Contracts        ← APIs, interfaces, and communication patterns  
     ↓
Capabilities     ← Features, services, and system behaviors
     ↓
Execution        ← Deployment, infrastructure, and runtime
```

This ensures that changes cascade predictably and your generated applications maintain architectural consistency.

## What Gets Generated?

From a single specification, Arbiter can generate:

- **Backend Services**: APIs, database schemas, authentication, authorization
- **Frontend Applications**: React components, pages, routing, state management  
- **Infrastructure**: Docker configs, Kubernetes manifests, CI/CD pipelines
- **Documentation**: API docs, architectural diagrams, runbooks
- **Tests**: Unit, integration, and end-to-end test suites

## Web Interface

Arbiter includes a sophisticated web interface for visual specification editing:

- **Interactive Diagrams**: Visualize your system architecture
- **Real-time Validation**: Instant feedback as you edit specifications
- **Component Browser**: Explore and manage your system components
- **Generation Preview**: See what will be generated before creating files

```bash
# Start the development server
bun run dev

# Open http://localhost:5173 to access the web interface
```

## 🚀 Webhook Integration & Custom Handlers

Arbiter includes a comprehensive webhook system that enables real-time integration with GitHub and GitLab, complete with custom handlers and secure tunneling.

### Quick Webhook Setup

```bash
# 1. Enable webhooks in your environment
export WEBHOOKS_ENABLED=true
export WEBHOOK_SECRET=your-secure-webhook-secret

# 2. Set up secure Cloudflare tunnel (recommended)
./scripts/cloudflare-tunnel.sh start

# 3. Configure webhooks in your repository:
#    GitHub: Settings → Webhooks → Add webhook
#    GitLab: Settings → Webhooks → Add webhook
#    URL: https://your-tunnel.cfargotunnel.com/webhooks/github
#    Content-Type: application/json
#    Events: push, pull_request
```

### 🔒 Secure Cloudflare Tunnel

Arbiter includes a comprehensive tunnel script with multiple security modes:

```bash
# Secure mode (default) - only webhook endpoints exposed
TUNNEL_MODE=webhook-only ./scripts/cloudflare-tunnel.sh start

# Development mode - all API endpoints exposed (use with caution)
TUNNEL_MODE=full-api ./scripts/cloudflare-tunnel.sh start

# Check tunnel status
./scripts/cloudflare-tunnel.sh status

# View real-time logs
./scripts/cloudflare-tunnel.sh logs

# Stop the tunnel
./scripts/cloudflare-tunnel.sh stop
```

**Security Features:**
- **IP Filtering**: Only GitHub/GitLab IP ranges allowed for webhook endpoints
- **Path Restrictions**: Webhook-only mode exposes only `/webhooks/*` and `/health` paths
- **HMAC Verification**: SHA-256 signature validation for all webhook payloads
- **Rate Limiting**: Built-in protection against webhook spam

### 🛠️ Custom Webhook Handlers

Create powerful custom handlers to extend webhook processing:

```typescript
// ./arbiter/handlers/github/custom-handler.ts
import type { HandlerModule, WebhookHandler } from '../types.js';

const handleEvent: WebhookHandler = async (payload, context) => {
  const { logger, services, projectId } = context;
  const { parsed } = payload;

  // Access parsed webhook data
  logger.info('Processing custom event', {
    event: parsed.eventType,
    repository: parsed.repository.fullName,
    commits: parsed.commits?.length || 0
  });

  // Send notifications
  await services.notifications.sendSlack(
    process.env.SLACK_WEBHOOK_URL,
    { text: `New push to ${parsed.repository.name}` }
  );

  // Trigger custom workflows
  if (parsed.eventType === 'push' && parsed.commits?.length > 0) {
    // Custom processing logic here
    await services.events.broadcastToProject(projectId, {
      project_id: projectId,
      event_type: 'custom_workflow_triggered',
      data: { commits: parsed.commits.length }
    });
  }

  return {
    success: true,
    message: 'Custom handler processed successfully',
    actions: ['sent-notification', 'triggered-workflow']
  };
};

export default {
  handler: handleEvent,
  config: { enabled: true, timeout: 30000 },
  metadata: {
    name: 'Custom Push Handler',
    supportedEvents: ['push'],
    version: '1.0.0'
  }
} satisfies HandlerModule;
```

### 🎮 Handler Management API

**Web Interface**: The web UI includes a dedicated "Handlers" tab for visual management.

**API Endpoints**:
```bash
# List all handlers
GET /api/handlers

# Get specific handler
GET /api/handlers/:id

# Update handler configuration
PUT /api/handlers/:id

# Toggle handler enabled state
POST /api/handlers/:id/toggle

# View execution history
GET /api/handlers/executions

# System statistics
GET /api/handlers/stats
```

### 🤖 AI Agent Integration

Arbiter includes demo AI agents that can be triggered by webhook events:

**Available Agents** (disabled by default):
- **Code Review Agent**: Analyzes pull requests and provides feedback
- **Issue Analysis Agent**: Categorizes and prioritizes issues
- **Documentation Agent**: Updates documentation based on code changes
- **Security Agent**: Scans for security vulnerabilities

**Configuration**:
```bash
# Enable AI agents (requires API keys)
export AI_AGENTS_ENABLED=false  # Set to true to enable
export ANTHROPIC_API_KEY=your-claude-key
export OPENAI_API_KEY=your-gpt-key
export GOOGLE_API_KEY=your-gemini-key

# Configure specific agents
export CODE_REVIEW_AGENT_ENABLED=true
export DOCUMENTATION_AGENT_ENABLED=true
```

**Usage**: AI agents respond to `/command` syntax in PR comments:
```
/review          # Trigger code review
/analyze         # Analyze issue or PR
/document        # Update documentation
/security        # Security scan
```

### 📊 Monitoring & Observability

**Real-time WebSocket Events**: Subscribe to live webhook and handler events:
```javascript
const ws = new WebSocket('ws://localhost:5050/events');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Webhook processed:', data);
};
```

**Handler Metrics**:
- Execution success/failure rates
- Average processing times
- Active handler monitoring
- Error tracking and alerting

**Security Logs**:
- Failed signature verifications
- Blocked IP attempts
- Rate limiting triggers
- Suspicious webhook patterns

### 🔧 Environment Configuration

**Required Environment Variables**:
```bash
# Webhook System
WEBHOOKS_ENABLED=true
WEBHOOK_SECRET=your-webhook-secret
GITHUB_WEBHOOK_SECRET=specific-github-secret  # Optional
GITLAB_WEBHOOK_SECRET=specific-gitlab-secret  # Optional

# Handler System
HANDLERS_ENABLED=true
HANDLERS_DIR=./arbiter/handlers
HANDLERS_MAX_TIMEOUT=60000

# AI Agents (optional)
AI_AGENTS_ENABLED=false
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...

# Security
TUNNEL_MODE=webhook-only  # webhook-only | full-api | custom
ALLOWED_WEBHOOK_IPS=auto  # auto | custom-list
RATE_LIMIT_ENABLED=true
```

## Project Structure

```
arbiter/
├── apps/
│   ├── api/                 # Backend API server (Bun + TypeScript)
│   │   ├── src/handlers/    # Custom webhook handlers system
│   │   ├── src/webhooks.ts  # Webhook processing logic
│   │   └── src/events.ts    # Real-time event broadcasting
│   └── web/                 # React frontend with Vite
├── packages/
│   ├── cli/                 # Main CLI package
│   └── shared/              # Shared utilities and types
├── scripts/
│   └── cloudflare-tunnel.sh # Secure tunnel setup script
├── arbiter/handlers/        # User-defined webhook handlers
│   ├── github/              # GitHub event handlers
│   ├── gitlab/              # GitLab event handlers
│   ├── shared/              # Shared handler utilities
│   └── examples/            # Example handler implementations
├── examples/                # Example specifications and projects
├── docs/                    # Documentation and guides
└── arbiter-cli              # Standalone CLI binary
```

## Documentation

- **[Getting Started Guide](docs/getting-started.md)** - Complete walkthrough for new users
- **[Core Concepts](docs/core-concepts.md)** - Understanding Arbiter's architecture
- **[CLI Reference](docs/CLI_REFERENCE.md)** - Complete command documentation with all 40+ commands
- **[Kubernetes Tutorial](doc/tutorial/kubernetes/README.md)** - Deploy applications to Kubernetes
- **[API Documentation](docs/api.md)** - REST API reference

## Examples

Explore real-world examples in the [`examples/`](examples/) directory:

- **[Basic Web App](examples/basic-web-app/)** - Simple CRUD application
- **[Microservices](examples/microservices/)** - Multi-service architecture
- **[Kubernetes Deployment](examples/kubernetes/)** - Cloud-native application
- **[Webhook Handlers](arbiter/handlers/examples/)** - Custom webhook processing examples

## 🔧 Troubleshooting

### Webhook Issues

**Webhooks not being received:**
```bash
# Check if webhooks are enabled
echo $WEBHOOKS_ENABLED

# Verify tunnel is running and accessible
./scripts/cloudflare-tunnel.sh status
curl https://your-tunnel.cfargotunnel.com/health

# Check webhook endpoint directly
curl -X POST https://your-tunnel.cfargotunnel.com/webhooks/github \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

**Signature verification failures:**
```bash
# Verify webhook secrets are configured
echo $WEBHOOK_SECRET
echo $GITHUB_WEBHOOK_SECRET

# Check signature in webhook logs
tail -f /tmp/cloudflare-tunnel.log
```

**Handler execution errors:**
```bash
# Check handler logs
GET /api/handlers/executions?limit=10

# Validate handler syntax
POST /api/handlers/validate
{
  "code": "your-handler-code-here"
}

# Test handler manually
curl -X POST localhost:5050/api/handlers/test-handler/execute \
  -d '{"test_payload": true}'
```

### Tunnel Issues

**Cloudflare tunnel not starting:**
```bash
# Check if cloudflared is installed and logged in
cloudflared --version
cloudflared tunnel list

# Login to Cloudflare
cloudflared tunnel login

# Check tunnel logs
tail -f /tmp/cloudflare-tunnel.log
```

**IP filtering blocking legitimate requests:**
```bash
# Check proxy logs for blocked IPs
tail -f /tmp/webhook-proxy.log

# Temporarily disable IP filtering for testing
TUNNEL_MODE=full-api ./scripts/cloudflare-tunnel.sh restart
```

### AI Agent Issues

**Agents not responding:**
```bash
# Verify AI agents are enabled
echo $AI_AGENTS_ENABLED

# Check API keys are configured
echo $ANTHROPIC_API_KEY | head -c 10

# Test agent directly
curl -X POST localhost:5050/api/ai/agents/code-review/execute \
  -H "Content-Type: application/json" \
  -d '{"text": "test code", "context": "pull_request"}'
```

**Rate limiting or API errors:**
```bash
# Check agent execution logs
GET /api/handlers/executions?handlerId=ai-agent-*

# Monitor rate limiting
GET /api/handlers/stats
```

### General Debugging

**Enable debug logging:**
```bash
export DEBUG=arbiter:*
export LOG_LEVEL=debug
bun run dev
```

**Check system health:**
```bash
# API server health
curl localhost:5050/health

# Database connectivity
curl localhost:5050/api/projects

# WebSocket events
wscat -c ws://localhost:5050/events
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone the repository
git clone https://github.com/arbiter-framework/arbiter.git
cd arbiter

# Install dependencies
bun install

# Start the development server
bun run dev

# Start with webhooks enabled
WEBHOOKS_ENABLED=true bun run dev

# Build the CLI
bun run build:standalone

# Run tests (including webhook tests)
bun test

# Test webhook system
curl -X POST localhost:5050/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -d '{"repository": {"full_name": "test/repo"}}'

# Initialize handler directory structure
curl -X POST localhost:5050/api/handlers/init
```

## License

This project is licensed under the [LicenseRef-SPL-1.0](LICENSE).

---

**Built with ❤️ for the future of AI-driven development**

*Arbiter is designed to work seamlessly with AI agents, automation workflows, and human developers alike. Experience the next generation of specification-driven development.*