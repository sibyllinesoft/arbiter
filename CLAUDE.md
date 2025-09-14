# CLAUDE.md - Arbiter Project Knowledge Base

**For AI Assistants working with the Arbiter codebase**

This document provides comprehensive context to help future AI assistants work effectively with the Arbiter project. It contains architecture insights, patterns, and practical guidance derived from deep analysis of the codebase.

---

## 🎯 PROJECT OVERVIEW

**Arbiter** is a CUE-based specification validation and management CLI tool with agent-first automation and comprehensive application modeling capabilities.

### Core Mission
- **Dual Schema Support**: Both v1 (infrastructure-focused) and v2 (app-centric) specifications
- **Agent-First Design**: CLI optimized for AI/automation consumption
- **Complete Lifecycle**: From specification to production deployment
- **Modern Toolchain**: Built with Bun, TypeScript, and modern web technologies
- **Webhook Integration**: Real-time GitHub/GitLab integration with custom handlers
- **AI-Enhanced**: Built-in AI agents for code review, analysis, and documentation

### Key Value Propositions
1. **Declarative Infrastructure**: Define complex systems in CUE and generate everything
2. **AI-Friendly**: Non-interactive commands, structured outputs, comprehensive APIs
3. **Full-Stack Generation**: From database schemas to UI components to CI/CD pipelines
4. **Validation-First**: Strong typing and validation throughout the development lifecycle
5. **Real-time Integration**: Webhook-driven automation with secure custom handlers
6. **AI-Augmented Workflows**: Built-in AI agents for code analysis and documentation

---

## 🏗️ REPOSITORY ARCHITECTURE

### Monorepo Structure
```
arbiter/
├── apps/                    # Deployable applications
│   ├── api/                # Bun + TypeScript API server (port 5050)
│   │   ├── src/webhooks.ts # Webhook processing and signature verification
│   │   ├── src/events.ts   # Real-time WebSocket event broadcasting
│   │   └── src/handlers/   # Custom handlers system implementation
│   │       ├── manager.ts  # Handler lifecycle management
│   │       ├── executor.ts # Sandboxed handler execution
│   │       ├── discovery.ts# Handler file discovery and loading
│   │       ├── api.ts      # Handler management API endpoints
│   │       └── types.ts    # Handler system type definitions
│   └── web/                # React + Vite frontend
├── packages/               # Shared libraries
│   ├── cli/                # Main CLI package (@arbiter/cli)
│   └── shared/             # Shared types and utilities
├── scripts/
│   └── cloudflare-tunnel.sh # Secure tunnel setup and management
├── arbiter/handlers/        # User-defined webhook handlers
│   ├── github/             # GitHub-specific event handlers
│   ├── gitlab/             # GitLab-specific event handlers
│   ├── shared/             # Shared handler utilities and types
│   └── examples/           # Example handler implementations
├── tests/                  # E2E and integration tests
├── examples/               # Example projects and specifications
├── docs/                   # Documentation and tutorials
└── scripts/                # Build and automation scripts
```

### Package Dependencies
- **Root**: Workspaces coordinator, contains standalone CLI binary (`arbiter-cli`)
- **packages/cli**: Core CLI implementation, depends on `packages/shared`
- **packages/shared**: Common types, utilities, CUE processing logic
- **apps/api**: Backend API server for spec management, validation, webhooks, and handlers
- **apps/web**: Web frontend for visual spec editing with handlers management (React + Vite)
- **arbiter/handlers**: User-defined webhook handlers (not in package.json, dynamically loaded)

### Technology Stack
- **Runtime**: Bun (primary), Node.js (compatibility)
- **Languages**: TypeScript (strict mode), CUE for specifications
- **CLI Framework**: Commander.js with chalk for styling
- **Testing**: Bun test, golden file testing, E2E with Docker Compose
- **Build**: Bun build, TypeScript compilation
- **Formatting**: Biome (linting, formatting)
- **Webhooks**: HMAC SHA-256 signature verification, real-time WebSocket events
- **Security**: Cloudflare tunnels, IP filtering, sandboxed handler execution
- **AI Integration**: Anthropic Claude, OpenAI GPT, Google Gemini APIs

---

## 🎮 CLI COMMAND STRUCTURE

### **IMPORTANT: CLI Simplification Status**
The CLI has been simplified for agent-friendliness. Many interactive commands have been removed or simplified:

#### ✅ Current Active Commands (Post-Simplification)
- `arbiter init` - Initialize new projects
- `arbiter add` - Compositional spec building (service, endpoint, route, etc.)
- `arbiter generate` - Generate code from specs
- `arbiter check` - Validate CUE files
- `arbiter checkout` - Simple revision management (placeholder)
- `arbiter watch` - File watching with live validation
- `arbiter surface` - Extract API surfaces from code
- `arbiter version` - Semver-aware version planning
- `arbiter sync` - Synchronize project manifests
- `arbiter integrate` - Generate CI/CD workflows
- `arbiter health` - Server health checking

#### 🔌 Webhook & Handler Commands (API-based)
- **Handler Management**: Via REST API and Web UI
- **Webhook Testing**: Direct API endpoints for testing webhook payloads
- **Tunnel Management**: Via `scripts/cloudflare-tunnel.sh` script
- **AI Agent Control**: Environment variables and API endpoints

#### ❌ Removed Commands (Agent-Unfriendly)
- `export` - Too complex, interactive prompts
- `templates` - Interactive template browsing
- `preview` - Interactive preview mode
- `server` - Server management (moved to npm scripts)
- `spec` - Complex spec fragment management
- `config` - Interactive configuration
- `ide` - IDE recommendations and setup
- `validate` - Redundant with check
- `create` - Redundant with init

### Command Design Principles
1. **Non-Interactive**: All commands work without user prompts
2. **Structured Output**: JSON/table formats for easy parsing
3. **Consistent Options**: `--dry-run`, `--force`, `--verbose` across commands
4. **Exit Codes**: Proper exit codes for automation (0=success, 1=error, 2=config error)
5. **Agent Mode**: `--agent-mode` and `--ndjson-output` for programmatic consumption

---

## 🔧 DEVELOPMENT WORKFLOWS

### Key Workflow Patterns

#### 1. **Monorepo Development**
```bash
# Root level - manages all packages
bun install                    # Install all dependencies
bun run build                  # Build all packages
bun run test                   # Test all packages
bun run build:standalone       # Create standalone CLI binary

# Package level - individual development
cd packages/cli
bun run dev                    # Watch mode development
bun run test                   # Run package tests
bun run build                  # Build package
```

#### 2. **CLI Development & Testing**
```bash
# Development
cd packages/cli
bun run dev                    # TypeScript watch mode
bun run test:golden           # Run golden file tests
bun test golden.test.ts       # Run specific test file

# Testing the built CLI
./arbiter-cli --help          # Test standalone binary
bun run cli:test              # Self-test command
bun run cli:demo              # Demo script
```

#### 3. **Server Development**
```bash
# Start API server (required for CLI operations)
bun run dev                   # Starts apps/api on port 5050
# OR
cd apps/api
bun run dev

# Health check
./arbiter-cli health          # Test server connectivity
```

#### 4. **Full Stack Development**
```bash
# Terminal 1: API Server with webhooks
WEBHOOKS_ENABLED=true bun run dev

# Terminal 2: CLI Development  
cd packages/cli
bun run dev

# Terminal 3: Frontend (if needed)
cd apps/web/frontend
bun run dev

# Terminal 4: Secure tunnel (for webhook testing)
./scripts/cloudflare-tunnel.sh start
```

#### 5. **Webhook & Handler Development**
```bash
# Development with webhook support
WEBHOOKS_ENABLED=true HANDLERS_ENABLED=true bun run dev

# Initialize handler directory structure
curl -X POST localhost:5050/api/handlers/init

# Test webhook processing
curl -X POST localhost:5050/webhooks/github \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: sha256=..." \
  -d @test-payload.json

# Monitor handler execution
curl localhost:5050/api/handlers/executions

# Test specific handler
curl -X POST localhost:5050/api/handlers/test-handler/execute \
  -d '{"test": true}'
```

#### 6. **Cloudflare Tunnel Development**
```bash
# Start secure tunnel (webhook-only mode)
TUNNEL_MODE=webhook-only ./scripts/cloudflare-tunnel.sh start

# Start development tunnel (all endpoints)  
TUNNEL_MODE=full-api ./scripts/cloudflare-tunnel.sh start

# Monitor tunnel logs
./scripts/cloudflare-tunnel.sh logs

# Check tunnel status
./scripts/cloudflare-tunnel.sh status

# Stop tunnel
./scripts/cloudflare-tunnel.sh stop
```

---

## 🚀 WEBHOOK & HANDLERS ARCHITECTURE

### Core Components

#### 1. **Webhook Service** (`apps/api/src/webhooks.ts`)
- **Purpose**: Processes incoming GitHub and GitLab webhook payloads
- **Features**: HMAC signature verification, payload parsing, event routing
- **Security**: IP filtering, rate limiting, secret validation
- **Integration**: Connects to custom handlers and broadcasts WebSocket events

```typescript
interface WebhookRequest {
  provider: "github" | "gitlab";
  event: string;
  signature: string | undefined;
  payload: WebhookPayload;
  timestamp: string;
}
```

#### 2. **Custom Handlers System** (`apps/api/src/handlers/`)
- **Manager** (`manager.ts`): Handler lifecycle, configuration, execution coordination
- **Executor** (`executor.ts`): Sandboxed handler execution with timeout and retry logic
- **Discovery** (`discovery.ts`): File system scanning and handler loading
- **API** (`api.ts`): REST endpoints for handler management
- **Services** (`services.ts`): HTTP client, notifications, database access for handlers

```typescript
interface HandlerModule {
  handler: WebhookHandler;
  config: HandlerConfig;
  metadata: HandlerMetadata;
}
```

#### 3. **Event Broadcasting** (`apps/api/src/events.ts`)
- **WebSocket Server**: Real-time event streaming to connected clients
- **Event Types**: Webhook received, handler executed, validation completed
- **Project Scoping**: Events filtered by project ID for multi-tenancy

#### 4. **Cloudflare Tunnel Integration** (`scripts/cloudflare-tunnel.sh`)
- **Security Modes**: webhook-only (secure), full-api (development), custom
- **Proxy Layer**: Node.js reverse proxy with IP filtering and path restrictions
- **Management**: Start, stop, status, logs, delete operations

### Handler Development Workflow

#### 1. **Handler Creation**
```bash
# Initialize handler directory structure
curl -X POST localhost:5050/api/handlers/init

# Create new handler file
./arbiter/handlers/github/custom-push.ts
```

#### 2. **Handler Structure**
```typescript
import type { HandlerModule, WebhookHandler } from '../types.js';

const handleEvent: WebhookHandler = async (payload, context) => {
  const { logger, services, projectId, config } = context;
  const { parsed } = payload;

  // Handler logic here
  return {
    success: true,
    message: 'Processed successfully',
    actions: ['action-taken'],
    data: { custom: 'result' }
  };
};

export default {
  handler: handleEvent,
  config: { enabled: true, timeout: 30000, retries: 2 },
  metadata: { name: 'Custom Handler', version: '1.0.0' }
} satisfies HandlerModule;
```

#### 3. **Handler Testing & Deployment**
```bash
# Validate handler syntax
POST /api/handlers/validate
{ "code": "handler-code-here" }

# Test handler execution
POST /api/handlers/test-handler/execute
{ "test_payload": true }

# Enable/disable handler
POST /api/handlers/handler-id/toggle

# Monitor execution
GET /api/handlers/executions?handlerId=handler-id
```

### Security Architecture

#### 1. **Webhook Security**
- **Signature Verification**: HMAC SHA-256 for GitHub/GitLab
- **IP Filtering**: Automatic GitHub/GitLab IP range validation
- **Rate Limiting**: Per-endpoint and per-IP protection
- **Payload Sanitization**: Input validation and XSS prevention

#### 2. **Handler Sandboxing**
- **Code Validation**: AST analysis to prevent dangerous patterns
- **Module Restrictions**: Only allowed Node.js modules accessible
- **Environment Isolation**: Handler secrets separated from system environment
- **Resource Limits**: Timeout, memory, and CPU constraints

#### 3. **Tunnel Security**
- **webhook-only Mode**: Only `/webhooks/*` and `/health` endpoints exposed
- **IP Whitelisting**: GitHub (140.82.112.0/20) and GitLab (34.74.90.64/28) ranges
- **Path Filtering**: Reverse proxy blocks unauthorized paths
- **TLS Termination**: Cloudflare handles SSL/TLS certificates

### API Endpoints Reference

#### Handler Management
```bash
GET    /api/handlers                    # List all handlers
GET    /api/handlers/:id               # Get specific handler
PUT    /api/handlers/:id               # Update handler config
DELETE /api/handlers/:id               # Remove handler
POST   /api/handlers/:id/toggle        # Enable/disable handler
POST   /api/handlers/:id/reload        # Reload from filesystem
```

#### Handler Operations  
```bash
POST /api/handlers/init                # Initialize directory structure
POST /api/handlers/validate            # Validate handler code
GET  /api/handlers/stats              # System statistics
GET  /api/handlers/executions         # Execution history
```

#### Webhook Processing
```bash
POST /webhooks/github                 # GitHub webhook endpoint
POST /webhooks/gitlab                 # GitLab webhook endpoint
GET  /health                          # System health check
```

#### Real-time Events
```bash
WebSocket: /events                    # Real-time event stream
```

### Environment Configuration

#### Required Variables
```bash
# Webhook System
WEBHOOKS_ENABLED=true
WEBHOOK_SECRET=your-webhook-secret
GITHUB_WEBHOOK_SECRET=github-specific-secret
GITLAB_WEBHOOK_SECRET=gitlab-specific-secret

# Handler System  
HANDLERS_ENABLED=true
HANDLERS_DIR=./arbiter/handlers
HANDLERS_MAX_CONCURRENT=10
HANDLERS_DEFAULT_TIMEOUT=30000

# Security
TUNNEL_MODE=webhook-only
RATE_LIMIT_ENABLED=true
IP_FILTERING_ENABLED=true

# AI Agents (optional)
AI_AGENTS_ENABLED=false
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

### Debugging & Monitoring

#### Log Files
- **Tunnel Logs**: `/tmp/cloudflare-tunnel.log`
- **Proxy Logs**: `/tmp/webhook-proxy.log`
- **Handler Execution**: API endpoint `/api/handlers/executions`

#### Health Checks
```bash
# API server health
curl localhost:5050/health

# Tunnel status  
./scripts/cloudflare-tunnel.sh status

# Handler system status
curl localhost:5050/api/handlers/stats
```

#### WebSocket Monitoring
```javascript
const ws = new WebSocket('ws://localhost:5050/events');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time event:', data);
};
```

## 🧪 TESTING ARCHITECTURE

### Testing Strategy
The project uses a comprehensive testing approach:

#### 1. **Golden File Testing** (`golden.test.ts`)
- **Purpose**: Regression testing of CLI output
- **Pattern**: Capture CLI output, compare with stored golden files
- **Files**: `src/__tests__/golden/` directory
- **Usage**: Ensures CLI output consistency across changes
- **Commands**: `bun test golden.test.ts`

**Key Golden Files**:
- `help.txt` - Main help output
- `checkout-help.txt` - Checkout command help
- `check-no-files.txt` - Check command with no files
- `unknown-command.txt` - Error handling

#### 2. **Ecosystem Testing** (`ecosystem.test.ts`)
- **Purpose**: Integration testing of core workflows
- **Pattern**: Real filesystem operations in temp directories
- **Coverage**: Sync, integrate, and other ecosystem commands
- **Validation**: File generation, manifest updates, CI/CD workflows

#### 3. **Unit Testing**
- **Framework**: Bun test
- **Coverage**: Individual functions, API clients, utilities
- **Location**: `src/__tests__/*.test.ts`

#### 4. **E2E Testing**
- **Framework**: Docker Compose + custom test harness
- **Location**: `tests/e2e-docker-compose/`
- **Purpose**: Full system integration testing

#### 5. **Webhook & Handler Testing**
- **Framework**: Bun test + mock webhook payloads
- **Coverage**: Signature verification, handler execution, event broadcasting
- **Location**: `apps/api/src/__tests__/webhooks.test.ts`
- **Validation**: HMAC verification, IP filtering, rate limiting

### Testing Commands
```bash
# Core test commands
bun test                      # All tests
bun test packages/            # Package tests only
bun test:cli                  # CLI tests only
bun test:e2e                  # E2E tests

# Specific test types
bun test golden.test.ts       # Golden file tests
bun test ecosystem.test.ts    # Ecosystem integration tests
bun test webhooks.test.ts     # Webhook system tests
bun test handlers.test.ts     # Handler execution tests

# Webhook testing
curl -X POST localhost:5050/webhooks/github \
  -H "X-GitHub-Event: push" \
  -d '{"test": "payload"}'

# Handler validation testing
curl -X POST localhost:5050/api/handlers/validate \
  -d '{"code": "export default { handler: async () => ({success: true}) };"}'
```

### Testing Best Practices
1. **Isolated Tests**: Each test uses temporary directories
2. **Cleanup**: Automatic cleanup after test completion
3. **Real Operations**: Tests use actual file system operations
4. **Golden Updates**: Use `UPDATE_GOLDEN=1 bun test` to update golden files
5. **Cross-Platform**: Tests work on Linux, macOS, and Windows

---

## 🏛️ CODE ARCHITECTURE

### Key Architectural Patterns

#### 1. **Command Pattern**
Each CLI command follows a consistent structure:
```typescript
// commands/example.ts
export async function exampleCommand(
  options: ExampleOptions,
  config: CLIConfig
): Promise<number> {
  try {
    // Command logic
    return 0; // Success
  } catch (error) {
    console.error(chalk.red("Error:"), error.message);
    return 1; // Error
  }
}
```

#### 2. **Configuration Management**
- **File**: `src/config.ts`
- **Format**: JSON (`.arbiter.json`)
- **Pattern**: Global config with command-line overrides
- **Schema**: Zod validation for type safety

```typescript
interface CLIConfig {
  apiUrl: string;
  timeout: number;
  format: "table" | "json" | "yaml";
  color: boolean;
  projectDir: string;
}
```

#### 3. **API Client Pattern**
- **File**: `src/api-client.ts`
- **Purpose**: Centralized API communication
- **Features**: Automatic retries, rate limiting, error handling
- **Usage**: All commands use ApiClient for server communication

#### 4. **Progress & Output Utilities**
- **File**: `src/utils/progress.ts` and `src/utils/formatting.ts`
- **Purpose**: Consistent CLI experience
- **Features**: Spinners, progress bars, colored output, tables

### Directory Structure Patterns
```
packages/cli/src/
├── commands/           # Individual command implementations
├── utils/             # Shared utilities (formatting, progress)
├── __tests__/         # Test files and golden files
├── cli.ts            # Main CLI entry point
├── index.ts          # Programmatic API exports
├── config.ts         # Configuration management
├── api-client.ts     # API communication
└── types.ts          # TypeScript type definitions
```

---

## 🔑 CRITICAL PATTERNS & CONVENTIONS

### 1. **Error Handling**
```typescript
// Consistent error pattern
try {
  const result = await operation();
  if (!result.success) {
    console.error(chalk.red("Error:"), result.error);
    return 1;
  }
  return 0;
} catch (error) {
  console.error(chalk.red("Command failed:"), error.message);
  return 2; // Configuration or system error
}
```

### 2. **Output Formatting**
```typescript
// Table output for human consumption
if (options.format === "table") {
  console.log(formatValidationTable(results));
}
// JSON output for programmatic consumption  
else if (options.format === "json") {
  console.log(formatJson(results));
}
```

### 3. **File Operations**
```typescript
// Always use fs-extra for robust file operations
import fs from "fs-extra";

// Ensure directories exist
await fs.ensureDir(outputDir);

// Safe JSON operations
const data = await fs.readJson(filePath);
await fs.writeJson(filePath, data, { spaces: 2 });
```

### 4. **Progress Indication**
```typescript
// Use progress utilities for long operations
import { withProgress } from "../utils/progress.js";

await withProgress(
  "Processing files...",
  async () => {
    // Long running operation
  }
);
```

---

## 📚 DOMAIN KNOWLEDGE

### CUE Integration
- **Purpose**: CUE is used for specification definition and validation
- **Pattern**: CUE files → API validation → Generated artifacts
- **Location**: Specifications typically in `arbiter.assembly.cue`
- **Processing**: Server-side validation via API endpoints

### Schema Versions
- **v1**: Infrastructure-focused (legacy)
  - Focus: Services, deployment, containers
  - Files: `arbiter.assembly.cue`
- **v2**: App-centric (recommended)
  - Focus: Complete application modeling
  - Features: UI routes, flows, locators, comprehensive testing

### Generation Pipeline
1. **Specification**: CUE files define system architecture
2. **Validation**: Server validates CUE against schemas
3. **Generation**: Templates generate code, configs, CI/CD
4. **Testing**: Generated tests validate the system

---

## 🚨 IMPORTANT CONSTRAINTS & GOTCHAS

### 1. **API Server Dependency**
- **Critical**: Most CLI commands require the API server running on port 5050
- **Start Command**: `bun run dev` (from root or `apps/api`)
- **Health Check**: `arbiter health` to verify connectivity
- **Timeout**: Default 5000ms, configurable via `--timeout`

### 2. **Build System**
- **Runtime**: Primary target is Bun, but Node.js compatibility maintained
- **Compilation**: Complex Bun build process with external dependencies
- **Binary**: Standalone binary created with `bun run build:standalone`
- **Watch Mode**: Use `bun run dev` in packages/cli for development

### 3. **Testing Dependencies**
- **Golden Tests**: Require exact output matching (whitespace sensitive)
- **Ecosystem Tests**: Create temporary directories, require cleanup
- **Server Tests**: Some tests need API server running
- **Cross-Platform**: Path handling, line endings differences

### 4. **Command Simplification History**
- **Context**: CLI was simplified to remove interactive commands
- **Deleted Commands**: export, templates, preview, server, spec, config, ide, validate, create
- **Golden Files**: Updated to reflect simplified command structure
- **Tests**: Cleaned up to remove references to deleted commands

---

## 🛠️ COMMON TASKS

### Adding a New Command
1. Create `src/commands/new-command.ts`
2. Follow command pattern (options, config, return number)
3. Add to `src/cli.ts` command registration
4. Export from `src/index.ts` if needed programmatically
5. Add tests in `src/__tests__/`
6. Update golden files if help output changes

### Creating a Custom Webhook Handler
1. **Initialize handler structure** (if not done):
   ```bash
   curl -X POST localhost:5050/api/handlers/init
   ```

2. **Create handler file** in appropriate directory:
   ```bash
   # For GitHub events
   touch ./arbiter/handlers/github/my-handler.ts
   
   # For GitLab events  
   touch ./arbiter/handlers/gitlab/my-handler.ts
   ```

3. **Implement handler using the standard structure**:
   ```typescript
   import type { HandlerModule, WebhookHandler } from '../types.js';
   
   const handleEvent: WebhookHandler = async (payload, context) => {
     // Implementation here
     return { success: true, message: 'Processed' };
   };
   
   export default {
     handler: handleEvent,
     config: { enabled: true, timeout: 30000 },
     metadata: { name: 'My Handler', version: '1.0.0' }
   } satisfies HandlerModule;
   ```

4. **Test and validate**:
   ```bash
   # Validate syntax
   POST /api/handlers/validate
   
   # Test execution
   POST /api/handlers/my-handler/execute
   
   # Monitor execution
   GET /api/handlers/executions
   ```

### Setting Up Webhook Integration
1. **Configure environment**:
   ```bash
   export WEBHOOKS_ENABLED=true
   export WEBHOOK_SECRET=your-secure-secret
   export GITHUB_WEBHOOK_SECRET=github-specific-secret
   ```

2. **Start secure tunnel**:
   ```bash
   TUNNEL_MODE=webhook-only ./scripts/cloudflare-tunnel.sh start
   ```

3. **Configure repository webhook**:
   - **URL**: `https://your-tunnel.cfargotunnel.com/webhooks/github`
   - **Content-Type**: `application/json`
   - **Events**: `push`, `pull_request`
   - **Secret**: Use your `WEBHOOK_SECRET`

4. **Test webhook reception**:
   ```bash
   # Check webhook logs
   tail -f /tmp/cloudflare-tunnel.log
   
   # Monitor handler execution
   curl localhost:5050/api/handlers/executions
   ```

### Debugging Webhook Issues
1. **Check webhook configuration**:
   ```bash
   echo $WEBHOOKS_ENABLED
   echo $WEBHOOK_SECRET
   ./scripts/cloudflare-tunnel.sh status
   ```

2. **Test webhook endpoint directly**:
   ```bash
   curl -X POST https://your-tunnel.cfargotunnel.com/webhooks/github \
     -H "Content-Type: application/json" \
     -H "X-GitHub-Event: push" \
     -d '{"test": true}'
   ```

3. **Check signature verification**:
   ```bash
   # Generate test signature
   echo -n '{"test":true}' | openssl dgst -sha256 -hmac "your-secret"
   
   # Test with signature
   curl -X POST localhost:5050/webhooks/github \
     -H "X-Hub-Signature-256: sha256=generated-signature" \
     -d '{"test": true}'
   ```

4. **Monitor real-time events**:
   ```javascript
   const ws = new WebSocket('ws://localhost:5050/events');
   ws.onmessage = (event) => console.log(JSON.parse(event.data));
   ```

### Updating Golden Tests
```bash
# Update all golden files
UPDATE_GOLDEN=1 bun test golden.test.ts

# Run tests to verify
bun test golden.test.ts
```

### Building & Testing
```bash
# Full build and test cycle
bun run build:all
bun test
bun run validate    # Runs format, lint, typecheck, test

# Test the standalone binary
./arbiter-cli --help
./arbiter-cli health
```

### Debugging Common Issues
1. **"No CUE files found"**: Check working directory and file patterns
2. **Server connection errors**: Verify API server is running (`bun run dev`)
3. **Golden test failures**: Check for whitespace/output format changes
4. **Build errors**: Check external dependencies are properly excluded

---

## 🎯 WORKING EFFECTIVELY

### For AI Assistants
1. **Start with API Server**: Always ensure `bun run dev` is running
2. **Use Health Checks**: Verify connectivity with `arbiter health`
3. **Follow Patterns**: Stick to established command and error patterns
4. **Test Golden Files**: Update golden files when changing command output
5. **Cleanup Tests**: Remove references to deleted commands from tests
6. **Respect Simplification**: Don't re-add interactive commands without discussion

### For Human Developers
1. **Development Setup**: Run API server in one terminal, CLI dev in another
2. **Testing Strategy**: Run golden tests frequently during CLI changes
3. **Code Style**: Use Biome (`bun run format`, `bun run lint`)
4. **Type Safety**: Maintain strict TypeScript configuration
5. **Documentation**: Update CLAUDE.md when making architectural changes

---

## 📋 QUICK REFERENCE

### Essential Commands
```bash
# Development
bun run dev                   # Start API server
cd packages/cli && bun run dev # CLI development mode

# Building
bun run build:all            # Build everything
bun run build:standalone     # Create arbiter-cli binary

# Testing  
bun test                     # All tests
bun test golden.test.ts      # Golden tests
bun test ecosystem.test.ts   # Integration tests
UPDATE_GOLDEN=1 bun test     # Update golden files

# CLI Usage
./arbiter-cli health         # Server health
./arbiter-cli check          # Validate CUE files
./arbiter-cli --help         # Command help
```

### Key Files to Understand
- `packages/cli/src/cli.ts` - Main CLI structure
- `packages/cli/src/types.ts` - Type definitions
- `packages/cli/src/api-client.ts` - API communication
- `packages/cli/src/__tests__/golden.test.ts` - Golden file testing
- `packages/cli/src/__tests__/ecosystem.test.ts` - Integration testing
- `apps/api/src/server.ts` - API server implementation
- `apps/api/src/webhooks.ts` - Webhook processing and signature verification
- `apps/api/src/events.ts` - Real-time WebSocket event broadcasting  
- `apps/api/src/handlers/manager.ts` - Custom handlers system management
- `apps/api/src/handlers/executor.ts` - Sandboxed handler execution engine
- `scripts/cloudflare-tunnel.sh` - Secure tunnel setup and management
- `arbiter/handlers/examples/` - Example handler implementations

### Exit Codes
- `0` - Success
- `1` - Command error (validation failure, file not found, etc.)
- `2` - Configuration error (server unreachable, config invalid)

---

*Last Updated: 2025-09-14*  
*This document reflects the current state of the Arbiter project including the comprehensive webhook integration, custom handlers system, secure Cloudflare tunnel, and AI agent capabilities.*