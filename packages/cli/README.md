# @sibyllinesoft/arbiter-cli

> CUE-based specification validation and management CLI with agent-first automation

[![npm version](https://badge.fury.io/js/%40sibyllinesoft%2Farbiter-cli.svg)](https://www.npmjs.com/package/@sibyllinesoft/arbiter-cli)
[![License](https://img.shields.io/badge/license-SPL--1.0-blue.svg)](LICENSE)

## Features

- 🎯 **Declarative Infrastructure** - Define complex systems in CUE and generate everything
- 🤖 **Agent-First Design** - CLI optimized for AI/automation consumption
- 📦 **Full-Stack Generation** - From database schemas to UI components to CI/CD pipelines
- ✅ **Validation-First** - Strong typing and validation throughout the development lifecycle
- 🚀 **Pre-built Presets** - Quick start with web-app, mobile-app, api-service, and microservice templates

## Installation

### Via npm

```bash
npm install -g @sibyllinesoft/arbiter-cli
```

### Via yarn

```bash
yarn global add @sibyllinesoft/arbiter-cli
```

### Via pnpm

```bash
pnpm add -g @sibyllinesoft/arbiter-cli
```

### Via bun

```bash
bun add -g @sibyllinesoft/arbiter-cli
```

## Quick Start

### 1. Initialize a New Project

**From a preset (recommended):**

```bash
# Create a full-stack web application
arbiter init my-app --preset web-app

# Create a mobile app
arbiter init my-mobile-app --preset mobile-app

# Create an API service
arbiter init my-api --preset api-service

# Create a microservice
arbiter init my-service --preset microservice
```

**From a template:**

```bash
# Create a basic CUE project
arbiter init my-project --template basic

# Create a Kubernetes configuration project
arbiter init k8s-config --template kubernetes

# Create an API schema project
arbiter init api-schema --template api
```

### 2. Add Components to Your Specification

```bash
# Add a service
arbiter add service api --language typescript --port 3000

# Add a database
arbiter add database postgres --engine postgresql

# Add an endpoint
arbiter add endpoint /users --method GET --service api

# Add a frontend route
arbiter add route /dashboard --component Dashboard
```

### 3. Generate Code from Specification

```bash
# Generate all artifacts
arbiter generate

# Validate your CUE files
arbiter check

# Watch for changes
arbiter watch
```

## CLI Essentials (1-minute version)

- Global config path: `~/.arbiter/config.json`
- Project config: `.arbiter/config.json` at repo root
- Precedence: CLI flags > env vars > project config > global config
- Auth (if API protected): `arbiter auth login --url https://api.example.com`
- Dry runs: many commands accept `--dry-run` to preview changes
- JSON output (for automation): add `--format json`

### Common Flags and Environment Variables

| Purpose              | Flag                            | Env Var                    | Notes                               |
|----------------------|---------------------------------|----------------------------|-------------------------------------|
| API base URL         | `--api-url https://...`         | `ARBITER_URL` or `ARBITER_API_URL` | Defaults to `http://localhost:5050` |
| Auth token           | `--token <jwt>`                 | `ARBITER_TOKEN`            | Stored in `~/.arbiter/auth.json`    |
| Verbose logging      | `--verbose`                     | `ARBITER_VERBOSE=1`        | Shows request/response bodies       |
| Fetch debug traces   | `--fetch-debug`                 | `ARBITER_FETCH_DEBUG=1`    | Helpful for HTTP troubleshooting    |
| Non-interactive use  | `--ci`                          | `CI=1`                     | Suppresses prompts                  |
| Output format        | `--format json|table|yaml`      | `ARBITER_FORMAT`           | Defaults to `table`                 |

### Fast Command Cheat Sheet

```bash
# Discover an API server (tries common ports)
arbiter health

# Initialize from GitHub or local path (brownfield import)
arbiter init --github-url https://github.com/org/service
arbiter init --local-path ../existing-repo

# Generate everything from CUE spec
arbiter generate

# Validate CUE and surface structured errors
arbiter check

# Plan and design flows (records decisions as spec data)
arbiter plan
arbiter design

# Manage entities
arbiter add service api --language typescript --port 3000
arbiter add endpoint /users --method GET --service api
arbiter list service

# CI/CD workflow generation
arbiter integrate

# Inspect or update fragments through the API
arbiter surface typescript
arbiter diff path/to/a.cue path/to/b.cue
```

## Workflows

Arbiter supports three main workflows for creating and managing specifications, each suited to different use cases and levels of planning:

### 1. Quick Start: Preset + Customize

**Best for:** Rapid prototyping, standard application patterns, getting started quickly

The fastest way to get productive is to start with a preset and customize it using `arbiter add`:

```bash
# Initialize with a preset
arbiter init my-app --preset web-app

# Customize by adding components
arbiter add service api --language typescript --port 3000
arbiter add database postgres --engine postgresql
arbiter add endpoint /users --method GET
arbiter add route /dashboard --component Dashboard

# Generate code
arbiter generate
```

**Pros:**
- Fastest time to working code
- Pre-configured best practices
- Immediate code generation
- Great for standard architectures

**Cons:**
- Less upfront planning
- May include components you don't need
- Requires understanding the preset structure

### 2. Structured Planning: plan/design Workflow

**Best for:** New features, team collaboration, AI-assisted development, architectural clarity

For more structured development with clear planning phases, use the `plan` and `design` commands:

```bash
# Step 1: Define WHAT to build (feature intent)
arbiter plan
# Follow the interactive prompts to capture:
# - Problem/motivation
# - Target users
# - Desired outcomes
# - Scope (in/out)
# - Key user flows
# - Success criteria

# Step 2: Define HOW to build (technical design)
arbiter design
# Follow the interactive prompts to capture:
# - Existing stack and constraints
# - Overall approach
# - Components and responsibilities
# - Data model changes
# - Integrations
# - Non-functional requirements
# - Rollout strategy

# The design phase uses `arbiter add` to record decisions:
arbiter add design.approach "New API endpoint on service X..."
arbiter add design.component "Name: OrderValidator; Responsibility: ..."
arbiter add design.data_model "orders table: add column status..."

# Step 3: Generate implementation
arbiter generate
```

**Pros:**
- Clear separation of WHAT vs HOW
- Better documentation of decisions
- AI-friendly prompts for assistant collaboration
- Incremental decision capture
- Easier team review and alignment

**Cons:**
- More upfront time investment
- Requires discipline to follow process
- May feel heavyweight for simple changes

### 3. Brownfield Import

**Best for:** Existing codebases, legacy system documentation, detailed external specifications

Arbiter has built-in static analysis to introspect existing projects, or you can use external tools for heavyweight specification processes.

**Option A: Built-in Static Analysis (Recommended)**

```bash
# Import existing project through GitHub
arbiter init --github-url https://github.com/org/my-project

# Or import local directory
arbiter init --local-path ../my-existing-project

# Arbiter's importer detects:
# - Services with manifests (package.json, Cargo.toml, go.mod, pyproject.toml)
# - Dependencies and frameworks
# - Build tools and binaries
# - Docker configurations

# Customize the imported spec
arbiter add endpoint /new-api --service api --method POST
arbiter generate
```

**Pros:**
- Automatic service and dependency detection
- No external tools required
- Supports Node.js, Rust, Python, Go, Docker, Kubernetes
- Fast brownfield onboarding

**Cons:**
- Limited to what static analysis can detect
- May miss complex architectural patterns

**Option B: External Tool Integration**

For heavyweight specification processes with extensive deliberation, use tools like speckit or bmad:

```bash
# Create comprehensive spec with external tool
speckit analyze ./my-project --deep-analysis > spec.json

# Review and translate to arbiter add commands (with AI assistance)
cat spec.json
arbiter init my-project
arbiter add service api --language typescript --port 3000
# ... translate remaining spec decisions

arbiter generate
```

**Pros:**
- Captures detailed architectural decisions
- Incorporates team deliberation and design choices
- Can combine multiple analysis sources

**Cons:**
- Requires external tool setup
- Manual translation needed
- More time-intensive process

**Note:** Use built-in import for quick brownfield onboarding. Use external tools when you need heavyweight specs after extensive team deliberation.

### Brownfield Import Tips

- Prefer `--github-url` when the repo is accessible; it provides branch metadata and avoids local path resolution issues.
- Use `--local-path` when working offline or with private code you have locally.
- Exclude heavy directories for speed: `--ignore "**/node_modules/**" --ignore "**/dist/**"`.
- Enable deeper heuristics when you need schema, infra, and test detection: `arbiter init --deep-analysis ...`.
- After import, rerun `arbiter generate` to materialize code and `arbiter check` to validate edits.

### Choosing a Workflow

| Workflow | Time Investment | Planning | Best For |
|----------|----------------|----------|----------|
| Preset + Customize | Low | Minimal | Prototypes, standard patterns |
| plan/design | Medium | Structured | New features, team projects |
| Brownfield Import | Low-Variable | Introspection or Translation | Existing codebases, migrations |

**Tip:** You can mix workflows! Start with a preset for greenfield projects, use `plan`/`design` for new features, import brownfield codebases with static analysis, or translate heavyweight external specs.

## Available Commands

### Planning & Design

- \`arbiter plan\` - Interactive feature planning assistant (WHAT to build)
- \`arbiter design\` - Interactive technical design assistant (HOW to build)

### Project Management

- \`arbiter init [name]\` - Initialize a new project
- \`arbiter add <type> <name>\` - Add components to your specification
- \`arbiter list <type>\` - List components by type
- \`arbiter status\` - Show project status

### Development

- \`arbiter generate\` - Generate code from specifications
- \`arbiter check [patterns...]\` - Validate CUE files
- \`arbiter watch [path]\` - Watch files with live validation
- \`arbiter diff <old> <new>\` - Compare CUE schemas

### Integration

- \`arbiter integrate\` - Generate CI/CD workflows
- \`arbiter sync\` - Synchronize project manifests
- \`arbiter surface <language>\` - Extract API surface from code

### Utilities

- \`arbiter health\` - Check server health
- \`arbiter version\` - Show version information

## Entity Types

The CLI supports 26+ entity types:

**Services & Infrastructure:**
- \`service\` - Microservices
- \`client\` - Client applications
- \`database\` - Databases
- \`cache\` - Cache services
- \`load-balancer\` - Load balancers
- \`infrastructure\` - Infrastructure components

**API & Communication:**
- \`endpoint\` - API endpoints
- \`route\` - UI routes
- \`view\` - UI views
- \`contract\` - Workflow contracts
- \`schema\` - API schemas

**Business Logic:**
- \`flow\` - User flows
- \`module\` - Modules
- \`component\` - UI components
- \`package\` - Packages
- \`capability\` - Business capabilities

**Project Management:**
- \`epic\` - Project epics
- \`task\` - Tasks
- \`tool\` - Developer tools

And more...

## Command Reference (practical defaults)

### `arbiter add`
- Purpose: add or update entities (service, endpoint, route, database, cache, client, flow, module, component, etc.).
- Templates: `--template <alias>` to bind an entity to a template alias (see `TEMPLATE_SYSTEM.md`).
- Common flags: `--language`, `--port`, `--method`, `--service`, `--path`, `--capabilities`, `--attach-to <service>` (for databases/caches), `--template`, `--force`.
- Idempotency: merges into existing fragments; use `--force` when you intend to overwrite conflicts.
- Examples:
  - `arbiter add service api --language typescript --port 3000 --template bun-hono`
  - `arbiter add endpoint /users --method GET --service api`
  - `arbiter add database main --engine postgres --attach-to api`

### `arbiter generate`
- Purpose: render code, infra, and workflows from the current spec.
- Dry run: `--dry-run` shows the plan without writing files.
- Scope control: `--types=api,client,infra,docs` to limit generators.
- Overwrites: `--force` permits overwriting changed files; defaults to fail-fast to protect edits.
- Hooks & overrides: honors `generator.hooks` and `templateOverrides` in `.arbiter/config.json` (details in `TEMPLATE_SYSTEM.md`).
- Caching: uses `.arbiter/.cache` to skip unchanged outputs where possible.
- Examples:
  - `arbiter generate --types=api,client --dry-run`
  - `arbiter generate --types=infra --force`

### Template System Quick Links
- Template aliases, implementors, overrides, and hooks are documented in `TEMPLATE_SYSTEM.md`.
- GitHub template config specifics live in `GITHUB_TEMPLATES_CONFIG.md`.

## Configuration

Create an \`.arbiter/config.json\` in your project:

```json
{
  "apiUrl": "http://localhost:5050",
  "format": "table",
  "color": true,
  "timeout": 10000
}
```

Override any of these per command with flags, or globally via `~/.arbiter/config.json`.
Auth tokens are cached in `~/.arbiter/auth.json`.

## Examples

### List Available Presets

```bash
arbiter init --list-presets
```

Output:
```
Available presets (require API server):

web-app         Full-stack web application with React frontend and Node.js backend
mobile-app      Cross-platform mobile app with React Native
api-service     RESTful API service with database integration
microservice    Containerized microservice with monitoring
```

### List All Services in Project

```bash
arbiter list service
```

### Generate CI/CD Workflows

```bash
arbiter integrate
```

### Extract API Surface from TypeScript Code

```bash
arbiter surface typescript
```

## Requirements

- Node.js >= 18.0.0
- CUE (for local validation)
- Arbiter API server (for preset-based initialization and advanced features)

## Development

```bash
# Clone the repository
git clone https://github.com/sibyllinesoft/arbiter.git
cd arbiter/packages/cli

# Install dependencies
bun install

# Build the CLI
bun run build

# Run tests
bun test

# Run in development mode
bun run dev
```

## Documentation

For comprehensive documentation, visit [https://github.com/sibyllinesoft/arbiter](https://github.com/sibyllinesoft/arbiter)

## License

LicenseRef-SPL-1.0

## Author

Nathan Rice

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## Support

- 🐛 [Report Issues](https://github.com/sibyllinesoft/arbiter/issues)
- 💬 [Discussions](https://github.com/sibyllinesoft/arbiter/discussions)
- 📖 [Documentation](https://github.com/sibyllinesoft/arbiter#readme)
