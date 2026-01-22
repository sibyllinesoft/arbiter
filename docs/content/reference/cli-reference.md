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
npm install -g @sibyllinesoft/arbiter-cli

# Via bun
bun install -g @sibyllinesoft/arbiter-cli

# Download standalone binary
curl -L https://github.com/arbiter-framework/arbiter/releases/latest/download/arbiter-cli > arbiter
chmod +x arbiter
```

### CUE runtime

The CLI now runs CUE through the bundled `cuelang-js` WASM runtime—no external
`cue` binary or `cue_binary_path` setting is required.

## Table of Contents

- [arbiter init](#arbiter-init-display-name)
- [arbiter surface](#arbiter-surface-language)
- [arbiter check](#arbiter-check-patterns)
- [arbiter list](#arbiter-list-type)
- [arbiter status](#arbiter-status)
- [arbiter diff](#arbiter-diff-old-file-new-file)
- [arbiter health](#arbiter-health)
- [arbiter add](#arbiter-add)
- [arbiter remove](#arbiter-remove)
- [arbiter generate](#arbiter-generate-spec-name)
- [arbiter docs](#arbiter-docs)
- [arbiter examples](#arbiter-examples-type)
- [arbiter execute](#arbiter-execute-group)
- [arbiter explain](#arbiter-explain)
- [arbiter rename](#arbiter-rename)
- [arbiter sync](#arbiter-sync)
- [arbiter import](#arbiter-import)
- [arbiter tests](#arbiter-tests)
- [arbiter auth](#arbiter-auth)

## Global Options

All commands support these global options:

- `-V, --version` - Display version number
- `-c, --config <path>` - Path to configuration file
- `--no-color` - Disable colored output
- `--api-url <url>` - Arbiter API server URL (overrides config)
- `--timeout <ms>` - Request timeout in milliseconds
- `--local` - Operate in offline mode using local CUE files only
- `-v, --verbose` - Enable verbose logging globally
- `-h, --help` - Display help for command

## Core Commands

### Project Management

#### `arbiter init [display-name]`

Initialize a new project from a hosted preset (API connection required).

**Usage:**

```bash
# Initialize with a preset and custom display name
arbiter init "My Application" --preset web-app

# See available presets
arbiter init --list-presets
```

**Options:**

- `--preset <id>` - Project preset (web-app, mobile-app, api-service, microservice)
- `--list-presets` - List available presets

**Examples:**

```bash
# Web application preset
arbiter init my-project --preset web-app

# API-focused project
arbiter init "User API" --preset api-service

# Show available presets
arbiter init --list-presets
```

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

# List all behaviors
arbiter list behaviors

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
arbiter add behavior cleanup-users
```

**Subcommands:**

- `arbiter add service <name>` - Add a service to the specification
- `arbiter add client <name>` - Add a client application
- `arbiter add contract <name>` - Add or update a contract workflow/event definition
- `arbiter add contract-operation <contract> <operation>` - Add operation to contract
- `arbiter add endpoint <path>` - Add API endpoint to a service
- `arbiter add route <path>` - Add UI route for frontend applications
- `arbiter add behavior <id>` - Add user behavior for testing and validation
- `arbiter add load-balancer` - Add load balancer with health check invariants
- `arbiter add database <name>` - Add database with automatic service attachment
- `arbiter add cache <name>` - Add cache service with automatic attachment
- `arbiter add locator <key>` - Add UI locator for testing
- `arbiter add schema <name>` - Add schema for API documentation
- `arbiter add package <name>` - Add reusable package/library
- `arbiter add component <name>` - Add UI component
- `arbiter add module <name>` - Add standalone module
- `arbiter add group` - Manage groups using sharded CUE storage
- `arbiter add task` - Manage tasks within groups

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

#### `arbiter execute <group>`

Execute Arbiter groups for deterministic, agent-first code generation.

**Usage:**

```bash
# Execute entire group
arbiter execute user-auth-group

# Execute with specific profile
arbiter execute user-auth-group --profile production

# Execute single task
arbiter execute user-auth-group --task auth-001
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
