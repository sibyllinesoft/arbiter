# CLI Reference

**Complete command documentation for the Arbiter CLI**

The Arbiter CLI is designed to be **agent-first**, with non-interactive
commands, structured outputs, and comprehensive APIs that make it ideal for both
human developers and AI automation.

Need the internal architecture, template lifecycle, or DI notes?
- High-level architecture: [`CLI Architecture`](./cli/architecture.md)
- Template engines, GitHub templates, language plugins:
  [`Generation Architecture`](./cli/generation-architecture.md)

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

## Global Options

All commands support these global options:

- `-v, --version` - Display version number
- `-c, --config <path>` - Path to configuration file
- `--no-color` - Disable colored output
- `--api-url <url>` - API server URL (default: http://localhost:5050)
- `--timeout <ms>` - Request timeout in milliseconds
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

#### `arbiter onboard [project-path]`

Intelligently onboard existing projects to Arbiter by analyzing the codebase and
generating appropriate specifications.

**Usage:**

```bash
# Onboard current directory
arbiter onboard

# Onboard specific project
arbiter onboard /path/to/project

# Dry run to see what would be generated
arbiter onboard --dry-run
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
arbiter add endpoint POST /users

# Add a database model
arbiter add model User

# Add a background job
arbiter add job cleanup-users --schedule "0 2 * * *"
```

**Subcommands:**

- `arbiter add service <name>` - Add a new service
- `arbiter add endpoint <method> <path>` - Add API endpoint
- `arbiter add model <name>` - Add domain model
- `arbiter add job <name>` - Add scheduled job
- `arbiter add event <name>` - Add domain event
- `arbiter add flow <name>` - Add business process flow

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

Endpoint assertion tests honour per-language settings in `.arbiter/config`. Add
your preferences under `generator.testing` to choose frameworks or override
output directories:

```json
{
  "generator": {
    "testing": {
      "master": { "type": "make", "output": "Makefile" },
      "typescript": { "framework": "jest" },
      "javascript": { "framework": "vitest" },
      "python": { "framework": "pytest", "outputDir": "tests/api/assertions" },
      "rust": { "outputDir": "tests/api/assertions" },
      "go": { "outputDir": "tests/api/assertions" }
    }
  }
}
```

When omitted, Arbiter falls back to sensible defaults: Vitest for TypeScript,
Jest for JavaScript, Pytest for Python, Rust's built-in test harness, and Go's
standard `testing` package.

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

#### `arbiter validate <files...>`

Validate CUE files with explicit schema and configuration.

**Usage:**

```bash
# Validate against default schema
arbiter validate spec.cue

# Validate against custom schema
arbiter validate --schema ./schemas/v2.cue spec.cue

# Validate multiple files
arbiter validate user.cue order.cue product.cue
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

---

### Development Workflow

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

#### `arbiter diff <old-file> <new-file>`

Compare two CUE schema versions and analyze changes.

**Usage:**

```bash
# Compare schema versions
arbiter diff schema-v1.cue schema-v2.cue

# Output in different formats
arbiter diff --format json old.cue new.cue

# Show only breaking changes
arbiter diff --breaking-only v1.cue v2.cue
```

#### `arbiter migrate [patterns...]`

Automatically migrate CUE schemas to latest format.

**Usage:**

```bash
# Migrate all CUE files
arbiter migrate

# Migrate specific files
arbiter migrate user.cue order.cue

# Dry run migration
arbiter migrate --dry-run
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

### Epic & Task Management

#### `arbiter epic`

Manage epics and their tasks using sharded CUE storage.

**Usage:**

```bash
# List all epics
arbiter epic list

# Create new epic
arbiter epic create "User Authentication"

# Show epic status
arbiter epic status auth-epic

# Execute epic
arbiter epic run auth-epic
```

#### `arbiter task`

Manage tasks within epics.

**Usage:**

```bash
# List tasks in current epic
arbiter task list

# Add task to epic
arbiter task add "Implement login endpoint" --epic auth

# Mark task complete
arbiter task complete auth-001

# Show task details
arbiter task show auth-001
```

#### `arbiter execute <epic>`

Execute Epic v2 for deterministic, agent-first code generation.

**Usage:**

```bash
# Execute entire epic
arbiter execute user-auth-epic

# Execute with specific profile
arbiter execute user-auth-epic --profile production

# Execute single task
arbiter execute user-auth-epic --task auth-001
```

---

### Code Generation & Templates

#### `arbiter export <files...>`

Export CUE configurations to various formats.

**Usage:**

```bash
# Export to JSON
arbiter export spec.cue --format json

# Export to YAML
arbiter export spec.cue --format yaml

# Export to multiple formats
arbiter export spec.cue --format json,yaml,toml
```

#### `arbiter template`

Manage and use CUE schema templates.

**Usage:**

```bash
# List available templates
arbiter template list

# Apply template
arbiter template apply microservice

# Create custom template
arbiter template create my-template --from ./template-dir
```

#### `arbiter templates`

Manage template aliases for code generation.

**Usage:**

```bash
# List template aliases
arbiter templates list

# Add template alias
arbiter templates add api-service ./templates/api

# Remove template alias
arbiter templates remove api-service
```

#### `arbiter create <type>`

Create new schemas and configurations interactively.

**Usage:**

```bash
# Create new service schema
arbiter create service

# Create API specification
arbiter create api

# Create deployment configuration
arbiter create deployment
```

---

### Documentation & Analysis

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

#### `arbiter preview`

Show what would be generated without creating files (deterministic output).

**Usage:**

```bash
# Preview all generation
arbiter preview

# Preview specific targets
arbiter preview --target typescript,docker

# Preview with detailed output
arbiter preview --detailed
```

---

### Testing & Quality

#### `arbiter tests`

Test management, scaffolding, and coverage analysis.

**Usage:**

```bash
# Generate test scaffolds
arbiter tests scaffold

# Run specification tests
arbiter tests run

# Analyze test coverage
arbiter tests coverage

# Generate test reports
arbiter tests report --format html
```

---

### System Management

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

#### `arbiter server [options]`

Start local Arbiter server (development).

**Usage:**

```bash
# Start development server
arbiter server

# Start on specific port
arbiter server --port 8080

# Start with debug mode
arbiter server --debug

# Start in production mode
arbiter server --prod
```

#### `arbiter config`

Manage CLI configuration.

**Usage:**

```bash
# Show current configuration
arbiter config show

# Set configuration value
arbiter config set api.url http://localhost:3000

# Reset to defaults
arbiter config reset
```

---

### Import & Package Management

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
```

---

### Utility Commands

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

#### `arbiter spec-import [file]`

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
- `--remote-path <path>` – Logical fragment path stored in Arbiter (defaults to the file’s relative path)
- `--skip-validate` – Skip local `cue` validation before upload
- `--author <name>` – Revision author metadata
- `--message <message>` – Revision message metadata

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
arbiter validate user.cue order.cue product.cue

# Chain commands
arbiter generate && arbiter check && arbiter tests run
```

---

## Configuration

### Configuration File

Create `.arbiter.json` in your project root:

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
