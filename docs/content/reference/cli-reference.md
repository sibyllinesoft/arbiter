# CLI Reference

**Complete command documentation for the Arbiter CLI**

The Arbiter CLI is designed to be **agent-first**, with non-interactive
commands, structured outputs, and comprehensive APIs that make it ideal for both
human developers and AI automation.

Need the internal architecture, template lifecycle, or DI notes?
- High-level architecture: [`CLI Architecture`](./cli/architecture.md)
- Template engines, GitHub templates, language plugins:
  [`Generation Architecture`](../guides/code-generation-architecture.md)

## Installation

```bash
# Via npm
npm install -g @arbiter/cli

# Via bun
bun install -g @arbiter/cli

# Download standalone binary
curl -L https://github.com/arbiter-framework/arbiter/releases/latest/download/arbiter-cli > arbiter
chmod +x arbiter
```

### CUE dependency

Arbiter shells out to the official [`cue`](https://cuelang.org/docs/install/)
binary for every command that reads or writes `.cue` files. Install CUE v0.9 or
newer and keep it on your `PATH`:

- macOS: `brew install cue-lang/tap/cue`
- Linux: download the release tarball from GitHub or
  `go install cuelang.org/go/cmd/cue@latest`
- Windows: `winget install cue-lang.cue` or `choco install cue`

Confirm your environment with `cue version`. When the binary lives outside the
default `PATH`, expose it via a wrapper script before running `arbiter`
commands.

## Table of Contents

- [arbiter init](#arbiter-init-display-name)
- [arbiter watch](#arbiter-watch-path)
- [arbiter surface](#arbiter-surface-language)
- [arbiter spec-import](#arbiter-spec-import-cue-file)
- [arbiter check](#arbiter-check-patterns)
- [arbiter list](#arbiter-list-type)
- [arbiter status](#arbiter-status)
- [arbiter diff](#arbiter-diff-old-file-new-file)
- [arbiter health](#arbiter-health)
- [arbiter add](#arbiter-add)
- [arbiter remove](#arbiter-remove)
- [arbiter version](#arbiter-version)
- [arbiter generate](#arbiter-generate-spec-name)
- [arbiter docs](#arbiter-docs)
- [arbiter examples](#arbiter-examples-type)
- [arbiter execute](#arbiter-execute-epic)
- [arbiter explain](#arbiter-explain)
- [arbiter rename](#arbiter-rename)
- [arbiter sync](#arbiter-sync)
- [arbiter integrate](#arbiter-integrate)
- [arbiter github-templates](#arbiter-github-templates)
- [arbiter import](#arbiter-import)
- [arbiter tests](#arbiter-tests)
- [arbiter auth](#arbiter-auth)

## Global Options

All commands support these global options:

- `-V, --version` - Display version number
- `-c, --config <path>` - Path to configuration file
- `--no-color` - Disable colored output
- `--api-url <url>` - API server URL (default: http://localhost:5050)
- `--arbiter-url <url>` - Arbiter server URL (alias for --api-url)
- `--timeout <ms>` - Request timeout in milliseconds
- `--local` - Operate in offline mode using local CUE files only
- `-v, --verbose` - Enable verbose logging globally
- `-h, --help` - Display help for command

## Core Commands

### Project Management

#### `arbiter init [display-name]`

Initialize a new CUE project with templates in the current directory.

**Usage:**

```bash
# Initialize with directory name
arbiter init

# Initialize with custom display name
arbiter init "My Application"

# Use specific template
arbiter init "API Service" --template api

# Force overwrite existing files
arbiter init --force
```

**Options:**

- `-t, --template <name>` - Project template (basic, kubernetes, api)
- `-f, --force` - Overwrite existing files
- `--list-templates` - List available templates

**Examples:**

```bash
# Quick start
mkdir my-project && cd my-project
arbiter init

# API-focused project
arbiter init "User API" --template api

# See available templates
arbiter init --list-templates
```

#### `arbiter watch [path]`

Cross-platform file watcher with live validation and planning.

**Usage:**

```bash
# Watch current directory
arbiter watch

# Watch specific directory
arbiter watch ./src

# Watch with custom patterns
arbiter watch --pattern "**/*.cue"

# Auto-generate on changes
arbiter watch --auto-generate
```

**Options:**

- `--pattern <glob>` - File patterns to watch
- `--auto-generate` - Automatically run generate on changes
- `--debounce <ms>` - Debounce delay for file changes

#### `arbiter surface <language>`

Extract API surface from source code and generate project-specific surface
files.

**Usage:**

```bash
# Extract TypeScript API surface
arbiter surface typescript

# Extract from specific directory
arbiter surface python --source ./src

# Generate surface documentation
arbiter surface go --docs
```

**Supported Languages:** typescript, javascript, python, go, rust, java

#### `arbiter spec-import [cue-file]`

Import a local CUE specification fragment into the Arbiter service.

**Usage:**

```bash
# Import the default .arbiter/assembly.cue for the configured project
arbiter spec-import

# Import a custom file and store it at an explicit fragment path
arbiter spec-import specs/catalog.cue --remote-path assembly.cue

# Import into a specific project without running local validation
arbiter spec-import --project proj_123 --skip-validate
```

**Options:**

- `--project <id>` – Target project id (defaults to the configured projectId or `cli-project`)
- `--remote-path <path>` – Logical fragment path stored in Arbiter (defaults to the file's relative path)
- `--skip-validate` – Skip local `cue` validation before upload
- `--author <name>` – Revision author metadata
- `--message <message>` – Revision message metadata

---

### Validation & Analysis

#### `arbiter check [patterns...]`

Validate CUE files in the current directory.

**Usage:**

```bash
# Check all CUE files
arbiter check

# Check specific files
arbiter check user.cue order.cue

# Check with pattern
arbiter check "**/*.cue"

# Output as JSON
arbiter check --format json
```

**Options:**

- `--format <format>` - Output format (table, json, yaml)
- `--strict` - Enable strict validation mode
- `--schema <path>` - Validate against specific schema

#### `arbiter list <type>`

List components of a specific type in the project.

**Usage:**

```bash
# List all services
arbiter list services

# List all flows
arbiter list flows

# List with JSON output
arbiter list services --format json
```

#### `arbiter status`

Show project status overview.

**Usage:**

```bash
# Show status
arbiter status

# JSON output
arbiter status --format json
```

#### `arbiter diff <old-file> <new-file>`

Compare two CUE schemas and analyze changes.

**Usage:**

```bash
# Compare schema definitions
arbiter diff schema-old.cue schema-new.cue

# Output in different formats
arbiter diff --format json old.cue new.cue

# Show only breaking changes
arbiter diff --breaking-only old.cue new.cue
```

#### `arbiter health`

Comprehensive Arbiter server health check.

**Usage:**

```bash
# Basic health check
arbiter health

# Detailed health report
arbiter health --detailed

# Check specific components
arbiter health --components api,database

# JSON output for monitoring
arbiter health --format json
```

---

### Specification Building

#### `arbiter add`

Incrementally build CUE specifications with modular generators. This is the
primary way to build complex systems piece by piece.

**Usage:**

```bash
# Add a new service
arbiter add service user-service

# Add an API endpoint
arbiter add endpoint /api/users

# Add a database model
arbiter add schema User

# Add a background job
arbiter add flow cleanup-users
```

**Subcommands:**

- `arbiter add service <name>` - Add a service to the specification
- `arbiter add client <name>` - Add a client application
- `arbiter add contract <name>` - Add or update a contract workflow/event definition
- `arbiter add contract-operation <contract> <operation>` - Add operation to contract
- `arbiter add endpoint <path>` - Add API endpoint to a service
- `arbiter add route <path>` - Add UI route for frontend applications
- `arbiter add flow <id>` - Add user flow for testing and validation
- `arbiter add load-balancer` - Add load balancer with health check invariants
- `arbiter add database <name>` - Add database with automatic service attachment
- `arbiter add cache <name>` - Add cache service with automatic attachment
- `arbiter add locator <key>` - Add UI locator for testing
- `arbiter add schema <name>` - Add schema for API documentation
- `arbiter add package <name>` - Add reusable package/library
- `arbiter add component <name>` - Add UI component
- `arbiter add module <name>` - Add standalone module
- `arbiter add epic` - Manage epics using sharded CUE storage
- `arbiter add task` - Manage tasks within epics

#### `arbiter remove`

Remove components from the project specification.

**Usage:**

```bash
# Remove a service
arbiter remove service user-service

# Remove an endpoint
arbiter remove endpoint /api/users

# Remove a database
arbiter remove database postgres
```

**Subcommands:** Mirrors the `add` subcommands for removing components.

#### `arbiter version`

Semver-aware version planning and release management.

**Usage:**

```bash
# Show current version info
arbiter version

# Plan next version
arbiter version plan --type minor

# Create version bump
arbiter version bump --to 2.1.0
```

---

### Code Generation

#### `arbiter generate [spec-name]`

Generate project files from stored specifications.

**Usage:**

```bash
# Generate all files from default spec
arbiter generate

# Generate from specific spec
arbiter generate user-service

# Dry run to preview changes
arbiter generate --dry-run

# Generate only specific targets
arbiter generate --target typescript,docker
```

**Options:**

- `--dry-run` - Preview what would be generated
- `--target <targets>` - Comma-separated list of targets
- `--force` - Overwrite existing files
- `--clean` - Remove files not in specification

##### Configuring endpoint assertion generation

Endpoint assertion tests honour per-language settings in `.arbiter/config.json`.
Set frameworks/output paths under `generator.plugins.<language>.testing` and keep the
cross-language runner under `generator.testing.master`:

```json
{
  "generator": {
    "testing": {
      "master": { "type": "make", "output": "Makefile" }
    },
    "plugins": {
      "typescript": { "testing": { "framework": "jest" } },
      "python": { "testing": { "framework": "pytest", "outputDir": "tests/api/assertions" } },
      "go": { "testing": { "outputDir": "tests/api/assertions" } }
    }
  }
}
```

When omitted, Arbiter falls back to sensible defaults: Vitest for TypeScript,
Jest for JavaScript, Pytest for Python, Rust's built-in test harness, and Go's
standard `testing` package.

#### `arbiter docs`

Generate documentation from CUE schemas and API surfaces.

**Usage:**

```bash
# Generate all documentation
arbiter docs

# Generate API docs only
arbiter docs --type api

# Generate in specific format
arbiter docs --format markdown

# Output to directory
arbiter docs --output ./docs
```

#### `arbiter examples <type>`

Generate example projects by profile or language type.

**Usage:**

```bash
# List available examples
arbiter examples list

# Generate basic web app example
arbiter examples basic-web-app

# Generate microservice example
arbiter examples microservice --language typescript
```

#### `arbiter execute <epic>`

Execute Arbiter epics for deterministic, agent-first code generation.

**Usage:**

```bash
# Execute entire epic
arbiter execute user-auth-epic

# Execute with specific profile
arbiter execute user-auth-epic --profile production

# Execute single task
arbiter execute user-auth-epic --task auth-001
```

#### `arbiter explain`

Generate plain-English summary of project specifications.

**Usage:**

```bash
# Explain current specification
arbiter explain

# Explain specific component
arbiter explain user-service

# Generate detailed explanation
arbiter explain --detailed

# Output as markdown
arbiter explain --format markdown
```

#### `arbiter rename`

Migrate existing files to project-specific naming conventions.

**Usage:**

```bash
# Rename all files to match conventions
arbiter rename

# Preview rename operations
arbiter rename --dry-run

# Rename specific file types
arbiter rename --types cue,typescript
```

---

### Project Integration

#### `arbiter sync`

Synchronize project manifests (package.json, pyproject.toml, etc.) with Arbiter
specifications.

**Usage:**

```bash
# Sync all manifests
arbiter sync

# Sync specific manifest types
arbiter sync --types package.json,docker-compose.yml

# Preview sync changes
arbiter sync --dry-run
```

#### `arbiter integrate`

Generate CI/CD workflows with contract coverage and quality gates.

**Usage:**

```bash
# Generate GitHub Actions workflows
arbiter integrate --platform github

# Generate GitLab CI/CD
arbiter integrate --platform gitlab

# Generate Jenkins pipeline
arbiter integrate --platform jenkins
```

**Supported Platforms:** github, gitlab, jenkins, circleci, azure-devops

#### `arbiter github-templates`

Manage GitHub issue templates configuration.

**Usage:**

```bash
# Generate GitHub templates
arbiter github-templates generate

# Update existing templates
arbiter github-templates update

# List available templates
arbiter github-templates list
```

---

### Import & Testing

#### `arbiter import`

Manage trusted import registry for CUE files.

**Usage:**

```bash
# Initialize import registry
arbiter import init

# Add trusted import
arbiter import add github.com/example/schemas

# List imports
arbiter import list

# Update imports
arbiter import update

# Validate imports in CUE files
arbiter import validate <files...>
```

**Subcommands:**

- `arbiter import validate <files...>` - Validate imports in CUE files against registry
  - Options: `-g, --global` - Use global registry

#### `arbiter tests`

Test management, scaffolding, and coverage analysis.

**Usage:**

```bash
# Generate test scaffolds
arbiter tests scaffold

# Run specification tests
arbiter tests run

# Analyze test coverage
arbiter tests cover

# Generate test reports
arbiter tests report --format html
```

**Subcommands:**

- `arbiter tests scaffold` - Generate test scaffolds
- `arbiter tests cover` - Analyze test coverage

---

### Authentication

#### `arbiter auth`

Authenticate the Arbiter CLI using OAuth.

**Usage:**

```bash
# Start OAuth authentication flow
arbiter auth

# Check authentication status
arbiter auth status

# Logout
arbiter auth logout
```

---

## Agent-Friendly Features

The Arbiter CLI is specifically designed for AI agents and automation:

### Structured Output

```bash
# All commands support --format json
arbiter check --format json
arbiter health --format json
arbiter version --format json
```

### Exit Codes

- `0` - Success
- `1` - Command error (validation failure, file not found)
- `2` - Configuration error (server unreachable, invalid config)

### Non-Interactive Operation

All commands work without user prompts and support:

- `--force` - Override confirmations
- `--dry-run` - Preview operations
- `--quiet` - Minimal output
- `--verbose` - Detailed logging

### Batch Operations

```bash
# Process multiple files
arbiter check *.cue
arbiter import validate user.cue order.cue product.cue

# Chain commands
arbiter generate && arbiter check && arbiter tests run
```

---

## Configuration

### Configuration File

Create `.arbiter/config.json` in your project root:

```json
{
  "apiUrl": "http://localhost:5050",
  "timeout": 30000,
  "format": "table",
  "color": true,
  "projectDir": ".",
  "templates": {
    "default": "basic"
  }
}
```

### Environment Variables

```bash
ARBITER_API_URL=http://localhost:5050
ARBITER_TIMEOUT=30000
ARBITER_FORMAT=json
ARBITER_NO_COLOR=true
```

---

## Troubleshooting

### Common Issues

1. **Server Connection Errors**

   ```bash
   # Check server status
   arbiter health

   # Start development server
   bun run dev
   ```

2. **CUE Validation Errors**

   ```bash
   # Check syntax
   arbiter check --strict

   # Show detailed error information
   arbiter check --verbose
   ```

3. **Generation Failures**

   ```bash
   # Preview generation
   arbiter generate --dry-run

   # Force overwrite conflicts
   arbiter generate --force
   ```

### Getting Help

```bash
# Command-specific help
arbiter init --help
arbiter generate --help

# Show all commands
arbiter --help

# Check CLI version
arbiter --version
```

---

_The Arbiter CLI provides a comprehensive toolkit for specification-driven
development, designed to work seamlessly with both human developers and AI
automation systems._
