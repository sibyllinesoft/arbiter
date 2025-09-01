# Arbiter

**Real-time collaborative CUE editor with analysis and visualization**

Arbiter is a modern web-based editor for CUE (Configure, Unify, Execute) configurations with real-time collaboration, live analysis, and interactive visualization. Built with Bun for performance and TypeScript for reliability.

## ✨ Features

### 🚀 Live CUE Analysis
- **Real-time validation** as you type with 250ms debounce
- **Rich error reporting** with line and column information  
- **Syntax highlighting** with Monaco editor
- **750ms timeout protection** for analysis requests

### 👥 Real-time Collaboration  
- **Multi-user editing** with Y.js CRDT synchronization
- **Live cursor tracking** with color-coded user presence
- **Conflict-free merging** of simultaneous edits
- **WebSocket-based communication** for instant updates

### 📊 Interactive Visualization
- **Automatic graph generation** from CUE structure
- **Mermaid diagrams** for configuration relationships
- **Smart summarization** for large configurations (>200 nodes)
- **Type-based styling** (objects, arrays, values)

### 🛡️ Security & Performance
- **Rate limiting** (1 request/second per client)
- **Sandboxed execution** with temporary directories
- **64KB text limit** for analysis requests
- **No imports allowed** in v0 for security
- **Bounded concurrency** (4 simultaneous analyses)

### 🤖 Executable Contracts (Agent System)
- **Versioned resources** with automatic migration (v0 → v1)
- **Deterministic code generation** with idempotent operations
- **Full test pipelines** (static, property, golden, CLI tests)
- **ARBITER markers** for safe patching and re-application
- **Event emission** for CI/CD integration

## 🏗️ Architecture

**Bun-First Design:**
```
┌─────────────────┐    WebSocket    ┌─────────────────┐
│ React Frontend  │ ←──────────────→ │ Bun Server      │
│                 │                 │                 │
│ • Monaco Editor │                 │ • CUE Analysis  │
│ • Y.js CRDT     │                 │ • SQLite DB     │
│ • Mermaid       │                 │ • WebSockets    │
└─────────────────┘                 └─────────────────┘
```

**Tech Stack:**
- **Runtime:** Bun v1.x (single runtime everywhere)
- **Frontend:** React + Vite + Monaco + Y.js + Mermaid
- **Backend:** Bun.serve() (HTTP + WebSocket in one)  
- **Database:** bun:sqlite (built-in, no external setup)
- **Analysis:** CUE CLI via Bun.spawn() with timeout control
- **Collaboration:** Y.js + WebSocket provider
- **Types:** TypeScript strict mode with Zod validation

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) v1.0.0 or later
- [CUE](https://cuelang.org/docs/install/) CLI tool

### Installation & Development

1. **Install dependencies:**
   ```bash
   git clone <repository-url>
   cd arbiter
   bun install
   ```
   
   **Note**: Some CLI features may require additional dependencies. If you encounter missing package errors, install them in the specific package directories:
   ```bash
   cd packages/cli && bun install
   cd packages/agent && bun install
   ```

2. **Start development servers:**
   ```bash
   # Starts both API (port 3001) and Web (port 5173) 
   bun run dev
   ```

3. **Access the application:**
   - Web Interface: http://localhost:5173
   - API Server: http://localhost:3001
   - WebSocket: ws://localhost:3001

### Docker Deployment

```bash
# Build and start all services
docker compose up --build

# Access at http://localhost:5173
```

## 📖 Usage Guide

### Basic Workflow

1. **Create a new project** using the "New Project" button
2. **Start typing CUE** in the Monaco editor:
   ```cue
   package example
   
   name: "my-app"
   version: "1.0.0"
   
   config: {
       port: 8080
       debug: true
   }
   ```
3. **See live analysis** in the right panel with errors/warnings
4. **View configuration graph** generated automatically
5. **Save revisions** with Ctrl+S or the Save button

### Collaboration Features

- **Multiple users** can edit the same project simultaneously
- **Cursor positions** are shared with color-coded indicators  
- **Changes merge automatically** using conflict-free resolution
- **Analysis results** are broadcast to all connected users
- **Join/leave notifications** keep everyone informed

### Project Management

- **Projects list** shows all created projects
- **Revision history** with append-only storage
- **Auto-save** on idle or manual save
- **Project switching** preserves collaboration state

## 🧪 Development

### Project Structure

```
arbiter/
├── apps/
│   ├── api/                # Bun HTTP+WebSocket server
│   │   └── server.ts       # Main server implementation
│   └── web/                # React + Vite frontend
│       └── src/App.tsx     # Main application component
├── packages/
│   ├── shared/             # Shared types and schemas
│   ├── sdk/                # SDK for Arbiter API
│   ├── cli/                # Command-line interface
│   ├── agent/              # Agent system for CUE execution
│   ├── benchmarks/         # Performance benchmarking
│   ├── security/           # Security scanning tools  
│   └── agentic-ci/         # CI/CD integration
├── docs/                   # Documentation
│   ├── protocol.md         # WebSocket protocol spec
│   └── ADR-0001-runtime.md # Architecture decisions
├── examples/               # CUE example files
└── docker-compose.yml      # Container orchestration
```

### Running Tests

```bash
# Run curated test suite (recommended - avoids problematic tests)
./run-tests.sh

# Run with coverage reporting  
bun run test:coverage
# Alternative: ./run-coverage.sh

# Individual package tests (may have failures)
cd packages/shared && bun test
cd apps/api && bun test  
cd apps/web && bun test

# End-to-end tests (requires setup)
bun run test:e2e
```

### Build Commands

```bash
# Type checking across all packages (may show errors)
bun run typecheck

# Linting with Biome
bun run lint

# Format code with Biome
bun run format:write

# Check formatting
bun run format:check

# Production build
bun run build
```

### Development Scripts

```bash
# Start API server only
bun run --cwd apps/api dev

# Start web app only  
bun run --cwd apps/web dev

# Build specific package
bun run --cwd packages/shared build
```

## 🔧 Configuration

### Environment Variables

See `.env.example` for available environment variables:

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration as needed
# Common variables:
# PORT=3001                    # Server port  
# DB_PATH=./data/arbiter.db   # SQLite database path
# NODE_ENV=development        # Environment mode
```

### CUE Analysis Settings

Configured in `apps/api/server.ts`:
```typescript
const CONFIG = {
  maxConcurrency: 4,        // Parallel analyses
  timeout: 750,             // Analysis timeout (ms)  
  maxTextSize: 64 * 1024,   // 64KB limit
  rateLimit: 1,             // Requests per second
};
```

## 🤖 Agent System

The Arbiter Agent makes CUE files executable contracts with deterministic code generation. It operates within strict constraints while providing versioned, idempotent operations.

### Quick Start

```bash
# Build the agent (requires dependencies)
bun run agent:build

# Note: CLI commands require missing dependencies (inquirer, glob)
# Install missing packages first:
# cd packages/agent && bun install
# cd packages/cli && bun install

# Once dependencies are available:
bun run agent scan
bun run agent assemble
bun run agent execute <epic-file>
```

### Core Commands

**`scan`** - Repository discovery and assembly synthesis
- Discovers CUE packages and YAML trees
- Synthesizes `arbiter.assembly.json` if none exists
- Handles legacy format migration automatically

**`assemble`** - Project mapping and Arbiter integration  
- Computes deterministic file→project mappings
- Batch uploads respecting 64KB payload limits
- Rate-limited at 1 RPS as required by Arbiter

**`execute`** - Deterministic epic execution
- Versioned resource loading with automatic migration
- Guard-protected file generation and patching
- Full test pipeline: static → property → golden → CLI
- Idempotence assertions and event emission

### Example Epic Structure

```cue
package epic

// Versioned envelope structure
epic: {
  apiVersion: "arbiter.dev/v1"
  kind: "Epic"
  spec: {
    id: "EPIC-NEW-SERVICE-001"
    title: "Create new user service"
    owners: ["backend-team"]
    
    // Code generation targets
    generate: [{
      path: "services/users/handler.go"
      mode: "create"
      template: "templates/service.go.tmpl"
      data: {
        serviceName: "users"
        packageName: "main"
      }
      guards: ["package main"] // Prevents conflicts
    }]
    
    // Contracts and validation
    contracts: {
      types: ["#UserService"]
      invariants: ["len(handlers) > 0"]
    }
    
    // Test pipeline
    tests: {
      static: [{selector: "services/users/**/*.go"}]
      property: [{name: "handler_exists", cue: "handlers.users != _|_"}]  
      golden: [{input: "test/user.json", want: "test/user.golden"}]
      cli: [{cmd: "go test ./services/users", expectExit: 0}]
    }
  }
}
```

### ARBITER Markers for Safe Patching

```go
// ARBITER:BEGIN handlers
func setupUserHandlers() {
    // Generated code here - safe to regenerate
}
// ARBITER:END handlers
```

Markers enable idempotent operations by allowing selective updates to file sections.

### Features

- **Versioned Resources**: Automatic migration from v0 to v1 formats
- **Deterministic Execution**: Same inputs always produce identical results  
- **Guard Protection**: Prevents conflicts with existing code
- **Comprehensive Testing**: Four-stage test pipeline with detailed reporting
- **Event Integration**: Emits ProjectUpdated, EpicsChanged, TestReportReady events
- **Rate Limiting**: Respects Arbiter's 1 RPS, 64KB, 750ms constraints

For detailed documentation, see [`packages/agent/README.md`](packages/agent/README.md).

## 📚 API Reference

### REST Endpoints

- `GET /projects` - List all projects
- `POST /projects` - Create new project  
- `GET /projects/:id` - Get project details
- `POST /projects/:id/revisions` - Save revision
- `POST /analyze` - Analyze CUE text

### WebSocket Protocol  

See [docs/protocol.md](docs/protocol.md) for complete WebSocket message specification.

**Key Message Types:**
- `hello` - Connection handshake
- `join` - Join project session
- `cursor` - Share cursor position
- `sync` - Y.js document updates
- `analyze` - Request CUE analysis

## 🚢 Deployment

### Docker Production

```dockerfile
# Multi-stage build with Bun
FROM oven/bun:1 as base
WORKDIR /app
COPY . .
RUN bun install --production
RUN bun run build
EXPOSE 3001
CMD ["bun", "start"]
```

### Requirements

- **CUE CLI** must be available in production container
- **SQLite** database persisted via volume mount
- **WebSocket** connections require sticky sessions for scaling

## 🤝 Contributing

### Development Guidelines

1. **Bun-first approach** - use Bun APIs where possible
2. **TypeScript strict mode** - all code must type-check
3. **Zod validation** - all external input validated
4. **Security by design** - sandboxed execution, rate limiting
5. **Performance focus** - monitor analysis timing and memory

### Pull Request Process  

1. Fork repository and create feature branch
2. Run full test suite: `bun run test && bun run typecheck`
3. Test manually with `bun run dev`
4. Update documentation if needed
5. Submit PR with clear description

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🏆 Acknowledgments

- **CUE language** for powerful configuration validation
- **Y.js** for conflict-free collaborative editing  
- **Monaco Editor** for excellent code editing experience
- **Bun** for blazing fast TypeScript runtime
- **Mermaid** for beautiful diagram generation