# Changelog

All notable changes to the Arbiter project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-11-21

### 🎉 Initial Release

Arbiter v1.0.0 is the first production-ready release of the specification-driven development platform. This release brings together a comprehensive CLI, API server, web client, and code generation system for building and managing applications from declarative CUE specifications.

### ✨ Features

#### Core Platform
- **Specification-Driven Architecture** - Define applications declaratively in CUE with full validation
- **Code Generation System** - Generate production-ready code for multiple languages (Go, Python, Rust, TypeScript)
- **Template System** - Extensible Handlebars-based templating with language-specific resolvers
- **Monorepo Architecture** - Well-structured workspace with CLI, API, client, and shared packages
- **Agent-First Design** - Non-interactive commands optimized for AI/automation consumption

#### CLI (`packages/cli`)
- `arbiter init` - Initialize new projects with opinionated structure
- `arbiter add` - Compositional spec building (services, endpoints, routes, models)
- `arbiter generate` - Code generation from CUE specifications with language plugin support
- `arbiter check` - CUE validation and type checking
- `arbiter watch` - File watching with live validation and hot reload
- `arbiter surface` - Extract API surfaces from existing code
- `arbiter version` - Semantic version planning and management
- `arbiter sync` - Project manifest synchronization
- `arbiter integrate` - CI/CD workflow generation
- `arbiter health` - Server connectivity and health checking
- **Structured Output** - JSON/table/YAML formats for programmatic consumption
- **Exit Codes** - Proper exit codes for automation (0=success, 1=error, 2=config error)

#### API Server (`apps/api`)
- **REST API** - Comprehensive endpoints for spec management and validation
- **WebSocket Events** - Real-time event broadcasting for live updates
- **Spec Resolution Engine** - Advanced CUE processing with import resolution
- **OAuth Integration** - GitHub OAuth support with dev mode
- **Health Monitoring** - Database and service health checks
- **Drizzle ORM** - Type-safe database operations with SQLite

#### Web Client (`apps/client`)
- **React + Vite** - Modern frontend with TypeScript
- **Monaco Editor** - Advanced code editing with CUE syntax support
- **Architecture Diagrams** - Visual representation of service dependencies
- **Project Browser** - Navigate and manage specifications
- **GitHub Integration** - Import projects directly from GitHub
- **Real-time Updates** - WebSocket integration for live spec changes

#### Code Generation
- **Go Generator** - Main/config/handlers/middleware/routes/services/models
- **Python Generator** - FastAPI/Pydantic with routers/services/models/schemas
- **Rust Generator** - Axum framework with handlers/routes/services/models
- **TypeScript Generator** - Express/NestJS scaffolding
- **Docker Assets** - Dockerfile and docker-compose.yml generation
- **CI/CD Pipelines** - GitHub Actions workflow generation
- **Database Migrations** - Schema generation for multiple databases

#### Import System (`packages/importer`)
- **GitHub Importer** - Scan and import existing GitHub repositories
- **Brownfield Detection** - Analyze existing codebases to generate specifications
- **Plugin Architecture** - Extensible importer system for custom sources

### 🔄 Breaking Changes

#### API Schema Changes (`packages/shared-types`)

**Enhanced Dependency System**
- Added `DependencyKind` type union for categorizing dependencies
- Enhanced `ServiceDependencySpec` interface with new optional fields:
  - `name?: string` - Unique dependency identifier within artifact
  - `type?: DependencyKind` - Dependency categorization (service, database, cache, etc.)
  - `target?: string` - Target identifier (service key, resource name, external handle)
- Added `DependencyGroups` type (`Record<string, ServiceDependencySpec[]>`) for grouped dependencies
- Updated `ServiceConfig.dependencies` to support grouped dependencies while maintaining backward compatibility

**Deployment Configuration**
- Changed `AssemblyConfig.deployment` (singular) to `deployments` (plural, optional)
  - **Migration**: Rename `deployment` to `deployments` and wrap in a keyed object if using custom deployment configs
  - **Example**:
    ```cue
    // Before
    deployment: {
      target: "kubernetes"
      namespace: "production"
    }

    // After
    deployments: {
      production: {
        target: "kubernetes"
        namespace: "production"
      }
    }
    ```

**Backward Compatibility**
- Legacy `service` field in `ServiceDependencySpec` maintained for compatibility
- Legacy dependency formats (string arrays and keyed objects) still supported

### 🐛 Bug Fixes
- Fixed TypeScript compilation issues with Monaco editor typings (packages/client)
- Fixed formatting violations in EntityCatalog and CLI E2E tests
- Resolved CUE binary path discovery issues in CLI
- Fixed WebSocket connection handling in client

### 📚 Documentation
- Comprehensive `CLAUDE.md` for AI assistants working with the codebase
- Updated CUE authoring guide with enhanced examples
- Simplified and consolidated generation best practices
- Added template development guide
- CLI reference documentation with command examples
- Server monitoring and health check documentation

### 🧪 Testing
- 1,143 total tests across 82 test files
- Golden file testing for CLI output regression
- E2E tests for full workflow validation
- Integration tests for API endpoints
- Playwright E2E tests for client UI

### 🏗️ Infrastructure
- **Build System** - Bun-based monorepo with TypeScript compilation
- **CI/CD** - 9 GitHub Actions workflows (CI, release, pre-release, docs, performance, version bumps, dependencies)
- **Code Quality** - Biome linting and formatting, Prettier integration
- **Type Safety** - Strict TypeScript in most packages
- **Docker Support** - docker-compose.yml for local development
- **MkDocs** - Documentation site with GitHub Pages deployment

### 📦 Dependencies
- **Runtime**: Bun >= 1.0.0
- **CUE Binary**: v0.9.x or newer (required on PATH)
- **Node.js**: Compatible with Node.js for deployment flexibility

### 🔒 License
- **Sibylline Business License (SBL) v1.0** - Source-available license prohibiting competing SaaS offerings
- See LICENSE file for full terms

### 🙏 Acknowledgments
- Built with Bun, TypeScript, React, CUE, and modern web technologies
- Inspired by specification-driven development and infrastructure-as-code principles

---

## Release Notes

### What's Included
- ✅ Standalone CLI binary (`arbiter-cli`)
- ✅ API server (port 5050)
- ✅ Web client (Vite dev server)
- ✅ Full source code with monorepo structure
- ✅ Comprehensive documentation
- ✅ GitHub Actions CI/CD templates

### Getting Started
```bash
# Install dependencies
bun install

# Build all packages
bun run build:all

# Start API server
bun run dev

# Use CLI
./arbiter-cli --help

# Start full stack (API + client)
bun run dev:full
```

### System Requirements
- Bun 1.0.0 or higher
- CUE binary (v0.9.x or newer) on PATH
- 8GB RAM recommended
- Linux, macOS, or Windows (WSL2)

### Known Issues
- Client tests require DOM environment setup (happy-dom/jsdom)
- Some client components use `@ts-nocheck` due to Monaco editor typing complexities
- CLI package uses relaxed TypeScript strictness for development ergonomics
- Playwright E2E tests require additional configuration

### Support
- GitHub Issues: https://github.com/your-org/arbiter/issues
- Documentation: https://your-org.github.io/arbiter
- License: Contact nathan.alexander.rice@gmail.com for commercial licensing

---

[1.0.0]: https://github.com/your-org/arbiter/releases/tag/v1.0.0
