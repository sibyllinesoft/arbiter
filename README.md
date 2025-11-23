# Arbiter Platform

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/sibyllinesoft/arbiter/releases)
[![License](https://img.shields.io/badge/license-SPL--1.0-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/bun-%3E%3D1.0.0-black)](https://bun.sh)

**Arbiter** is a production-ready, CUE-based specification platform that transforms declarative system definitions into complete, validated codebases. From API services to infrastructure manifests, Arbiter generates consistent, type-safe artifacts across your entire stack.

## 🎯 What is Arbiter?

Arbiter turns a single CUE specification into everything you need to run a modern application:

- **API Services** - Go, Python, Rust, TypeScript backends with full OpenAPI specs
- **Frontend Applications** - React components, routing, and state management
- **Infrastructure** - Kubernetes manifests, Docker configs, CI/CD workflows
- **Documentation** - Architecture diagrams, API docs, deployment guides
- **Database Schemas** - Type-safe migrations and ORM configs

**All from one source of truth.** No duplication. No drift. Always in sync.

## 🚀 Version 1.0.0 Released

We're excited to announce Arbiter 1.0.0, featuring:

- ✅ Production-ready code generation for 4 languages (Go, Python, Rust, TypeScript)
- ✅ Agent-first CLI designed for AI/automation workflows
- ✅ Real-time collaboration with WebSocket event system
- ✅ Brownfield import system for existing codebases
- ✅ GitHub OAuth integration
- ✅ Comprehensive web UI with Monaco editor and architecture diagrams
- ✅ Full CI/CD workflow generation

## 🎁 Key Features

### Specification Driven
Define your architecture once in CUE and keep generated code, documentation, and workflows in perfect lockstep. Changes to your spec automatically propagate through your entire stack.

### Brownfield Friendly
Don't start from scratch. Arbiter's importer plugins scan existing repositories, detect services, analyze APIs, and bootstrap specifications from real projects—complete with confidence scoring and provenance tracking.

### Agent-First Design
Built for automation. Every CLI command is non-interactive with structured output (JSON/NDJSON/table), proper exit codes, and comprehensive flags. Perfect for AI assistants, CI/CD pipelines, and programmatic workflows.

### Production Awareness
Not just scaffolding—Arbiter generates production-ready code with:
- Health checks and monitoring
- Structured logging
- Metrics collection
- Security best practices
- Resource limits and scaling configs
- Database migrations

### Multi-Language Support
Generate idiomatic code in your language of choice:
- **Go** - Clean architecture with interfaces and dependency injection
- **Python** - FastAPI services with Pydantic models
- **Rust** - Type-safe services with Actix/Axum
- **TypeScript** - Express/Fastify APIs with full type coverage

### Real-Time Collaboration
WebSocket-based event system keeps teams in sync. See spec changes, validation results, and generation progress in real-time across the web UI and CLI.

## 🏗️ Architecture

Arbiter is a TypeScript monorepo built with Bun, consisting of:

### Applications

#### API Server (`apps/api`)
- **Framework**: Hono (Express-compatible)
- **Database**: SQLite with Drizzle ORM
- **Auth**: OAuth 2.0 with GitHub integration
- **WebSocket**: Real-time event broadcasting

**Key Features**:
- Project CRUD and management
- CUE spec validation and processing
- Code generation endpoints
- GitHub repository import
- OAuth authentication flow
- Real-time event streaming

#### Web Client (`apps/client`)
- **Framework**: React 18 + Vite
- **Editor**: Monaco with CUE syntax support
- **Diagrams**: D3.js + Mermaid for visualizations
- **State**: Zustand + React Query

**Key Features**:
- Interactive CUE editor with autocomplete
- Architecture diagram visualization
- Project browser and workspace
- Real-time spec validation
- GitHub OAuth integration
- Service and endpoint management

### Packages

#### CLI (`packages/cli`)
- **Commands**: 50+ across 7 command groups
- **Design**: Modular, composable, agent-friendly

**Command Groups**:
- **Project Management**: `init`, `list`, status, health
- **Spec Building**: `add` (26+ entity types: services, endpoints, databases, components)
- **Epic & Tasks**: Project planning and task management
- **Code Generation**: Multi-language code generation from specs
- **Validation**: `check`, `watch`, live validation
- **Integration**: CI/CD workflow generation, manifest sync
- **Utilities**: Version management, API surface extraction, auth

**Key Features**:
- Preset-based initialization (web-app, mobile-app, api-service, microservice)
- Template system with Handlebars
- Structured output formats (JSON, NDJSON, table)
- Non-interactive operation
- Proper exit codes (0=success, 1=error, 2=config error)

#### Shared (`packages/shared`)
CUE processing utilities, type definitions, validation schemas, and shared business logic used across the platform.

#### Shared Types (`packages/shared-types`)
Centralized TypeScript type definitions ensuring consistency between API, CLI, and client.

#### API Types (`packages/api-types`)
Hono-specific API types for request/response handling.

#### CUE Runner (`packages/cue-runner`)
Wrapper for CUE binary invocation with structured diagnostics parsing. Handles `cue vet`, `cue export`, and `cue fmt` operations.

#### Importer (`packages/importer`)
Plugin-based brownfield codebase analyzer:
- GitHub repository scanning
- Service classification and detection
- React component analysis
- Artifact manifest generation
- Confidence scoring and provenance tracking

## 🎯 Why CUE Over YAML/JSON?

**"Why not just write Terraform or OpenAPI specs directly?"**

Traditional formats like YAML and JSON are verbose, error-prone, and require separate validation tooling. CUE solves this:

### 1. Type Safety & Validation

**YAML/JSON:**
```yaml
# 1000 lines of Kubernetes manifests...
replicas: "3"  # String instead of number - runtime error!
memory: 512    # Missing unit - deployment fails
```

**CUE:**
```cue
#Service: {
    replicas: int & >0  // Type-checked at authoring time
    memory: =~"^[0-9]+[MGT]i$"  // Regex validation built-in
}

// Catches errors before deployment
service: #Service & {
    replicas: "3"  // Error: cannot use value "3" (type string) as int
}
```

### 2. DRY (Don't Repeat Yourself)

**Before (YAML):**
```yaml
# k8s-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
# ... 50 lines ...

# openapi.yaml
openapi: 3.0.0
info:
  title: api-service
# ... another 50 lines duplicating service info ...

# terraform.tf
resource "aws_ecs_service" "api" {
  name = "api-service"
# ... yet another 50 lines ...
```

**After (CUE):**
```cue
// Define once
services: api: {
    name: "api-service"
    image: "myapp:v1.2.3"
    port: 8080
    replicas: 3
}

// Generate everything from one source of truth:
// - Kubernetes manifests
// - OpenAPI specs
// - Terraform configs
// - Architecture diagrams
// All stay in perfect sync automatically
```

### 3. Composition & Reusability

CUE's constraint-based approach means you can layer configurations without duplication:

```cue
// Base service definition
#BaseService: {
    replicas: int | *1
    resources: {
        cpu: string | *"100m"
        memory: string | *"128Mi"
    }
}

// Production overlay
#ProdService: #BaseService & {
    replicas: int & >=3
    resources: memory: string & =~"[0-9]+Gi"
}

// Your actual services inherit these constraints
services: {
    api: #ProdService & {
        replicas: 5
        resources: memory: "2Gi"
    }
}
```

**The Result:** Type 1000 lines of YAML error-free, or use CUE to catch typos, type mismatches, and constraint violations before they reach production.

## 📦 Repository Layout

```
arbiter/
├── apps/
│   ├── api/          # Bun + Hono API server (port 5050)
│   └── client/       # React + Vite web UI
├── packages/
│   ├── cli/          # Main CLI package
│   ├── shared/       # Shared utilities and types
│   ├── shared-types/ # Centralized TypeScript types
│   ├── api-types/    # API-specific types
│   ├── cue-runner/   # CUE binary wrapper
│   └── importer/     # Brownfield codebase analysis
├── scripts/          # Dev, docs, and build automation
├── docs/             # MkDocs-based documentation
├── examples/         # Sample projects and specs
└── tests/            # E2E and integration tests
```

Each package includes its own README with detailed documentation and TSDoc-annotated sources for IDE discovery.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
bun install
```

### 2. Build the Workspace

```bash
bun run build:all
```

This builds all packages in dependency order:
- shared-types → shared → importer → cue-runner → api-types → cli → api

### 3. Launch the Development Stack

```bash
# Full stack (API + Client + TypeCheck)
bun run dev:full

# Or individually:
bun run dev        # API server only
bun run dev:workbench  # Client only
```

The API starts on `http://localhost:5050` and the client on `http://localhost:5173`.

### 4. Try the CLI

```bash
# View help
./arbiter-cli --help

# Check server health
./arbiter-cli health

# Initialize a new project from preset
./arbiter-cli init my-app --preset web-app

# List available presets
./arbiter-cli init --list-presets
```

### 5. Install CLI Globally (Optional)

```bash
npm install -g @sibyllinesoft/arbiter-cli
```

## 📋 Prerequisites

### Required

- **Bun** >= 1.0.0 - Primary runtime ([install](https://bun.sh))
- **Node.js** >= 18.0.0 - For standalone CLI
- **CUE** v0.9.x or newer - For validation and generation ([install](https://cuelang.org/docs/install/))

### Installation Methods for CUE

- **macOS**: `brew install cue-lang/tap/cue`
- **Linux**: Download from [GitHub releases](https://github.com/cue-lang/cue/releases) or `go install cuelang.org/go/cmd/cue@latest`
- **Windows**: `winget install cue-lang.cue` or `choco install cue`

Verify installation:
```bash
cue version
# cue version v0.9.x
```

**Important**: The `cue` binary must be on your `PATH`. Commands like `arbiter add`, `arbiter generate`, and `arbiter check` will fail with "cue binary not found" otherwise.

## 📚 Documentation

### Viewing Documentation

```bash
# Preview docs with live reload
bun run docs:site:dev

# Generate API reference from TSDoc
bun run docs:tsdoc

# Build static site
bun run docs:site:build
```

### Documentation Structure

- `docs/content/overview/` - Core concepts and architecture
- `docs/content/guides/` - Generation guides, CUE authoring, best practices
- `docs/content/reference/` - CLI reference, CUE schema, API documentation
- `docs/content/tutorials/` - Hands-on labs and playbooks

Production docs are automatically deployed to GitHub Pages from the `main` branch.

## 🔐 OAuth Setup & Testing

### 1. Launch the Full OAuth Stack

```bash
bun run dev:full:oauth
```

This runs four processes simultaneously:
- Type-checker in watch mode
- Local OAuth server on `http://localhost:4571`
- API with OAuth enabled (auth required)
- Web client

### 2. Configure CLI Authentication

```bash
# Create config (if not exists)
mkdir -p .arbiter
echo '{"arbiter_url": "http://localhost:5050"}' > .arbiter/config.json

# Authenticate
arbiter auth
```

Steps:
1. CLI prints authorization URL
2. Open URL in browser and approve
3. Copy the code
4. Paste into CLI prompt

Tokens are cached in `~/.arbiter/auth.json`. Use `arbiter auth --logout` to clear.

### 3. Environment Variables

- `ARBITER_URL` / `VITE_API_URL` - API endpoint
- `ARBITER_CONFIG_PATH` - Custom config file path
- `OAUTH_DEV_*` - OAuth server configuration

## 🛠️ Development Workflow

### Common Commands

```bash
# Development
bun run dev                   # Start API server
bun run dev:full             # API + Client + TypeCheck
bun run dev:full:oauth       # Full stack with OAuth

# Building
bun run build:all            # Build all packages
bun run build:standalone     # Create arbiter-cli binary

# Testing
bun test                     # All tests
bun run test:cli             # CLI tests only
bun run test:api             # API tests only
bun run test:playwright      # E2E tests

# Code Quality
bun run format               # Format with Biome + Prettier
bun run lint                 # Run linters
bun run typecheck            # TypeScript compilation
bun run validate             # Full check (format + lint + typecheck + test)

# Documentation
bun run docs:site:dev        # Docs with live reload
bun run docs:tsdoc           # Generate API docs
bun run docs:generate        # Run doc generators
```

### Testing

Arbiter uses multiple testing strategies:

- **Golden File Tests** (`golden.test.ts`) - CLI output regression testing
- **Ecosystem Tests** (`ecosystem.test.ts`) - Integration testing of workflows
- **Unit Tests** - Individual component and utility tests
- **E2E Tests** - Full-stack Playwright tests
- **API Tests** - Route handler and database tests

## 🎨 CLI Features

### Preset-Based Initialization

```bash
# Web application
arbiter init my-app --preset web-app

# Mobile application
arbiter init mobile --preset mobile-app

# API service
arbiter init api --preset api-service

# Microservice
arbiter init service --preset microservice
```

### Entity Types (26+)

Add components to your specification:

```bash
# Infrastructure
arbiter add service api --language typescript
arbiter add database postgres --engine postgresql
arbiter add cache redis

# API & Routes
arbiter add endpoint /users --method GET
arbiter add route /dashboard --component Dashboard

# Business Logic
arbiter add flow checkout --states pending,complete
arbiter add module auth --type capability

# And many more: components, packages, schemas, etc.
```

### List Command

```bash
# List all services
arbiter list service

# List endpoints in JSON
arbiter list endpoint --format json

# List with verbose details
arbiter list route --verbose
```

### Generation

```bash
# Generate all artifacts
arbiter generate

# Validate CUE files
arbiter check

# Watch for changes
arbiter watch
```

## 🔧 API Endpoints

The API server exposes comprehensive REST endpoints:

- `/api/auth/*` - OAuth authentication
- `/api/projects/*` - Project CRUD
- `/api/specs/*` - Spec management
- `/api/import/*` - GitHub import
- `/api/github/*` - GitHub integration
- `/api/cli/*` - CLI-specific operations
- `/api/events` - WebSocket events

## 🌟 Examples

Check the `examples/` directory for:

- `app-spec-example.cue` - Complete application spec
- `sample.cue` - Basic CUE usage
- `external-agent.ts` - Agent integration
- `epic-task-workflow.md` - Project planning workflow

## 📊 Technology Stack

### Backend
- **Runtime**: Bun
- **Framework**: Hono
- **Database**: SQLite + Drizzle ORM
- **Auth**: OAuth4WebAPI + Jose (JWT)
- **WebSocket**: Native WebSocket support
- **Validation**: Zod

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Editor**: Monaco
- **Diagrams**: D3.js + Mermaid
- **State**: Zustand + React Query
- **Router**: React Router

### CLI
- **Framework**: Commander.js
- **UI**: Chalk + Ora + Inquirer
- **Formatting**: cli-table3
- **Validation**: Zod

### Code Quality
- **Linting**: Biome
- **Formatting**: Biome + Prettier
- **Testing**: Bun test + Vitest + Playwright
- **Types**: TypeScript strict mode

## 🤝 Contributing

1. Fork and clone the repository
2. Create a feature branch
3. Make changes with comprehensive tests
4. Run `bun run validate` (format + lint + typecheck + test)
5. Submit a pull request with:
   - Problem description
   - Implementation approach
   - Validation steps
   - Breaking changes (if any)

## 📝 License

This project is released under the **SPL-1.0** License. See `LICENSE` for details.

## 🔗 Links

- **Documentation**: https://sibylline.dev/arbiter/
- **GitHub**: https://github.com/sibyllinesoft/arbiter
- **Issues**: https://github.com/sibyllinesoft/arbiter/issues
- **NPM Package**: [@sibyllinesoft/arbiter-cli](https://www.npmjs.com/package/@sibyllinesoft/arbiter-cli)
- **CUE Language**: https://cuelang.org

## 🙏 Acknowledgments

Built with ❤️ using [CUE](https://cuelang.org), [Bun](https://bun.sh), [React](https://react.dev), and the amazing open-source community.

---

**Version 1.0.0** - Production Ready • Agent-First • Brownfield Friendly
