# Arbiter CLI Reference

**Complete command reference for the Arbiter CUE-based specification validation
and management CLI.**

This document provides comprehensive documentation for all Arbiter CLI commands,
options, and usage patterns. The Arbiter CLI is designed with agent-first
principles, offering non-interactive commands, structured outputs, and
comprehensive APIs for AI-driven development workflows.

## Table of Contents

- [Installation](#installation)
- [Global Options](#global-options)
- [Command Categories](#command-categories)
  - [Project Management](#project-management)
  - [Specification Building](#specification-building)
  - [Epic & Task Management](#epic--task-management)
  - [Code Generation & Execution](#code-generation--execution)
  - [Validation & Testing](#validation--testing)
  - [Version Management](#version-management)
  - [Template Management](#template-management)
  - [Development Tools](#development-tools)
  - [Integration & Deployment](#integration--deployment)
  - [Configuration & Health](#configuration--health)
- [Agent-Friendly Features](#agent-friendly-features)
- [Output Formats](#output-formats)
- [Examples](#examples)

## Installation

### Package Managers

```bash
# Via Bun (recommended)
bun install -g arbiter-cli

# Via NPM
npm install -g arbiter-cli
```

### Standalone Binary

```bash
# Download from releases
curl -L https://github.com/arbiter-framework/arbiter/releases/latest/download/arbiter-cli > arbiter
chmod +x arbiter

# Use the project's binary
./arbiter-cli --help
```

### Development Setup

```bash
# Clone and build from source
git clone https://github.com/arbiter-framework/arbiter.git
cd arbiter
bun install
bun run build:standalone
```

## Global Options

Available for all commands:

| Option                | Description                                     |
| --------------------- | ----------------------------------------------- |
| `-v, --version`       | Display version number                          |
| `-c, --config <path>` | Path to configuration file                      |
| `--no-color`          | Disable colored output                          |
| `--api-url <url>`     | API server URL (default: http://localhost:5050) |
| `--timeout <ms>`      | Request timeout in milliseconds                 |
| `-h, --help`          | Display help for command                        |

## Command Categories

### Project Management

#### `arbiter init [display-name]`

Initialize a new CUE project with templates in current directory.

**Options:**

- `-t, --template <name>` - Project template (basic, kubernetes, api)
- `-f, --force` - Overwrite existing files
- `--list-templates` - List available templates

**Examples:**

```bash
arbiter init "My Application"
arbiter init --template kubernetes "K8s Service"
arbiter init --list-templates
```

#### `arbiter onboard [project-path]`

Intelligently onboard existing projects to Arbiter.

**Options:**

- `--dry-run` - Preview changes without applying
- `-f, --force` - Force onboarding even if .arbiter directory exists
- `-v, --verbose` - Verbose output with detailed analysis
- `--skip-analysis` - Skip project analysis and use defaults
- `--non-interactive` - Run without prompting for confirmation

**Examples:**

```bash
arbiter onboard ./existing-project
arbiter onboard --dry-run
```

### Specification Building

#### `arbiter add`

Incrementally build CUE specifications with modular generators.

All add commands support common options:

- `--dry-run` - Preview changes without applying
- `--force` - Overwrite existing configuration
- `-v, --verbose` - Verbose output with detailed changes

##### `arbiter add service <name>`

Add a service to the specification.

**Options:**

- `--template <alias>` - Use template alias for service generation
- `--language <lang>` - Programming language (typescript, python, rust, go)
- `--port <port>` - Service port number
- `--image <image>` - Prebuilt container image
- `--directory <dir>` - Source directory path
- `--platform <platform>` - Target platform (cloudflare, vercel, supabase,
  kubernetes)
- `--service-type <type>` - Platform-specific service type

**Examples:**

```bash
arbiter add service user-service --language typescript --port 3000
arbiter add service api --platform kubernetes
```

##### `arbiter add endpoint <path>`

Add an API endpoint to a service.

**Options:**

- `--service <name>` - Target service name (default: "api")
- `--method <method>` - HTTP method (default: "GET")
- `--returns <schema>` - Response schema reference
- `--accepts <schema>` - Request body schema reference

**Examples:**

```bash
arbiter add endpoint POST /users --service user-service
arbiter add endpoint GET /health --returns HealthSchema
```

##### `arbiter add route <path>`

Add a UI route for frontend applications.

**Options:**

- `--id <id>` - Route identifier (auto-generated if not specified)
- `--capabilities <caps>` - Comma-separated capabilities (view, edit, admin)
- `--components <comps>` - Comma-separated component names

**Examples:**

```bash
arbiter add route /dashboard --capabilities view,edit
arbiter add route /admin --id admin-panel
```

##### `arbiter add flow <id>`

Add a user flow for testing and validation.

**Options:**

- `--from <route>` - Starting route for navigation flow
- `--to <route>` - Target route for navigation flow
- `--endpoint <path>` - API endpoint for health check flow
- `--expect <status>` - Expected HTTP status code (default: "200")
- `--steps <json>` - Custom flow steps as JSON array

**Examples:**

```bash
arbiter add flow user-login --from / --to /dashboard
arbiter add flow health-check --endpoint /health --expect 200
```

##### `arbiter add load-balancer`

Add a load balancer with health check invariants.

**Options:**

- `--target <service>` - Target service to load balance (required)
- `--health-check <path>` - Health check endpoint path (default: "/health")

**Examples:**

```bash
arbiter add load-balancer --target user-service
```

##### `arbiter add database <name>`

Add a database with automatic service attachment.

**Options:**

- `--template <alias>` - Use template alias
- `--attach-to <service>` - Service to attach database connection to
- `--image <image>` - Database container image (default: "postgres:15")
- `--port <port>` - Database port (default: 5432)
- `--platform <platform>` - Target platform
- `--service-type <type>` - Platform-specific database type

**Examples:**

```bash
arbiter add database userdb --attach-to user-service
arbiter add database maindb --platform kubernetes
```

##### `arbiter add cache <name>`

Add a cache service with automatic attachment.

**Options:**

- `--attach-to <service>` - Service to attach cache connection to
- `--image <image>` - Cache container image (default: "redis:7-alpine")
- `--port <port>` - Cache port (default: 6379)
- `--platform <platform>` - Target platform
- `--service-type <type>` - Platform-specific cache type

**Examples:**

```bash
arbiter add cache session-cache --attach-to user-service
arbiter add cache --platform cloudflare --service-type cloudflare_kv
```

##### `arbiter add locator <key>`

Add a UI locator for testing.

**Options:**

- `--selector <selector>` - CSS selector or test-id (required)

**Examples:**

```bash
arbiter add locator login-button --selector "#login-btn"
arbiter add locator user-menu --selector "[data-testid=user-menu]"
```

##### `arbiter add schema <name>`

Add a schema for API documentation.

**Options:**

- `--example <json>` - Example data as JSON
- `--rules <json>` - Validation rules as JSON

**Examples:**

```bash
arbiter add schema UserSchema --example '{"name":"John","age":30}'
```

##### `arbiter add package <name>`

Add a reusable package/library.

**Options:**

- `--language <lang>` - Programming language (default: "typescript")
- `--directory <dir>` - Source directory path
- `--exports <exports>` - Comma-separated list of main exports
- `--version <version>` - Initial version (default: "0.1.0")

**Examples:**

```bash
arbiter add package design-system --exports Button,Input,Card
arbiter add package utils --language python --exports helper,validator
```

##### `arbiter add component <name>`

Add a UI component.

**Options:**

- `--framework <framework>` - UI framework (react, vue, angular, svelte)
- `--directory <dir>` - Source directory path
- `--props <props>` - Comma-separated list of component props
- `--stories` - Generate Storybook stories

**Examples:**

```bash
arbiter add component LoginForm --framework react --props email,password --stories
arbiter add component Button --props variant,size,disabled
```

##### `arbiter add module <name>`

Add a standalone module.

**Options:**

- `--language <lang>` - Programming language (default: "typescript")
- `--directory <dir>` - Source directory path
- `--functions <functions>` - Comma-separated list of main functions
- `--types <types>` - Comma-separated list of exported types

**Examples:**

```bash
arbiter add module auth-utils --functions login,logout,validate
arbiter add module types --types User,Session,Config
```

### Epic & Task Management

#### `arbiter epic`

Manage epics and their ordered tasks using sharded CUE storage.

##### `arbiter epic list`

List all epics.

**Options:**

- `-s, --status <status>` - Filter by status (planning, in_progress, completed,
  cancelled)
- `-p, --priority <priority>` - Filter by priority (critical, high, medium, low)
- `-a, --assignee <assignee>` - Filter by assignee
- `-f, --format <format>` - Output format (table, json)
- `-v, --verbose` - Verbose output with additional details

**Examples:**

```bash
arbiter epic list --status in_progress
arbiter epic list --format json --priority high
```

##### `arbiter epic show <epic-id>`

Show detailed epic information.

**Options:**

- `-f, --format <format>` - Output format (table, json)
- `-v, --verbose` - Verbose output

**Examples:**

```bash
arbiter epic show EPIC-001
arbiter epic show EPIC-001 --format json
```

##### `arbiter epic create`

Create a new epic.

**Options:**

- `-n, --name <name>` - Epic name
- `-d, --description <description>` - Epic description
- `-p, --priority <priority>` - Priority (critical, high, medium, low)
- `-o, --owner <owner>` - Epic owner
- `-a, --assignee <assignee>` - Epic assignee
- `--start-date <date>` - Start date (YYYY-MM-DD)
- `--due-date <date>` - Due date (YYYY-MM-DD)
- `--labels <labels>` - Comma-separated labels
- `--tags <tags>` - Comma-separated tags
- `--allow-parallel-tasks` - Allow tasks to run in parallel
- `--no-auto-progress` - Disable automatic task progression
- `--no-require-all-tasks` - Don't require all tasks to complete epic
- `-v, --verbose` - Verbose output

**Examples:**

```bash
arbiter epic create --name "User Authentication" --priority high
arbiter epic create -n "API Migration" -d "Migrate to v2 API" --due-date 2024-12-31
```

##### `arbiter epic update <epic-id>`

Update an existing epic.

**Options:** Same as create command

- `--status <status>` - Update status

**Examples:**

```bash
arbiter epic update EPIC-001 --status in_progress
arbiter epic update EPIC-001 --assignee john.doe --priority critical
```

##### `arbiter epic stats`

Show sharded storage statistics.

**Options:**

- `-v, --verbose` - Detailed statistics

#### `arbiter task`

Manage ordered tasks within epics.

##### `arbiter task list`

List all tasks across epics.

**Options:**

- `-e, --epic <epic-id>` - Filter by epic
- `-s, --status <status>` - Filter by status (todo, in_progress, completed,
  cancelled)
- `-a, --assignee <assignee>` - Filter by assignee
- `-f, --format <format>` - Output format (table, json)
- `-v, --verbose` - Verbose output

**Examples:**

```bash
arbiter task list --epic EPIC-001
arbiter task list --status todo --assignee john.doe
```

##### `arbiter task show <task-id>`

Show detailed task information.

**Options:**

- `-f, --format <format>` - Output format (table, json)
- `-v, --verbose` - Verbose output

##### `arbiter task create`

Create a new task in an epic.

**Options:**

- `-e, --epic <epic-id>` - Epic ID to add task to
- `-n, --name <name>` - Task name
- `-d, --description <description>` - Task description
- `-t, --type <type>` - Task type (feature, bug, refactor, test, docs, devops,
  research)
- `-p, --priority <priority>` - Priority (critical, high, medium, low)
- `-a, --assignee <assignee>` - Task assignee
- `-r, --reviewer <reviewer>` - Task reviewer
- `--depends-on <tasks>` - Comma-separated list of task IDs this depends on
- `--acceptance-criteria <criteria>` - Comma-separated acceptance criteria
- `--can-run-in-parallel` - Task can run in parallel
- `--no-requires-review` - Task doesn't require code review
- `--no-requires-testing` - Task doesn't require testing
- `--blocks-other-tasks` - Task blocks subsequent tasks
- `-v, --verbose` - Verbose output

**Examples:**

```bash
arbiter task create --epic EPIC-001 --name "Setup authentication" --type feature
arbiter task create -e EPIC-001 -n "Fix login bug" -t bug --depends-on TASK-001,TASK-002
```

##### `arbiter task batch`

Batch create tasks from JSON.

**Options:**

- `-e, --epic <epic-id>` - Epic ID to add tasks to
- `--json <json>` - JSON array of task objects
- `--file <file>` - JSON file containing task array
- `-v, --verbose` - Verbose output

**Examples:**

```bash
arbiter task batch --epic EPIC-001 --file tasks.json
```

##### `arbiter task update <task-id>`

Update an existing task.

**Options:** Same as create command

- `--status <status>` - Update status

##### `arbiter task complete <task-id>`

Mark a task as completed.

**Options:**

- `--completion-notes <notes>` - Completion notes
- `-v, --verbose` - Verbose output

### Code Generation & Execution

#### `arbiter generate [spec-name]`

Generate project files from stored specifications.

**Options:**

- `--output-dir <dir>` - Output directory (default: ".")
- `--include-ci` - Include CI/CD workflow files
- `--force` - Overwrite existing files
- `--dry-run` - Show what would be generated without creating files
- `--verbose` - Verbose output with detailed progress
- `--format <type>` - Output format (auto, json, yaml, typescript, python, rust,
  go, shell)
- `--sync-github` - Sync epics and tasks to GitHub after generation
- `--github-dry-run` - Preview GitHub sync changes
- `--use-config` - Use configuration file repository info
- `--use-git-remote` - Use Git remote repository info

**Examples:**

```bash
arbiter generate --dry-run
arbiter generate user-service --output-dir ./generated
arbiter generate --format typescript --include-ci
```

#### `arbiter execute <epic>`

Execute Epic v2 for deterministic, agent-first code generation.

**Options:**

- `--dry-run` - Show planned changes without applying
- `-w, --workspace <path>` - Workspace directory
- `-t, --timeout <ms>` - Test timeout in milliseconds (default: 30000)
- `--junit <file>` - Write JUnit XML report to file
- `-v, --verbose` - Verbose output with detailed diffs
- `--agent-mode` - Output NDJSON events for agent consumption
- `--ndjson-output <file>` - Write NDJSON events to file

**Examples:**

```bash
arbiter execute EPIC-001 --dry-run
arbiter execute EPIC-001 --agent-mode --ndjson-output results.ndjson
```

#### `arbiter surface <language>`

Extract API surface from source code and generate project-specific surface file.

**Options:**

- `-o, --output <file>` - Explicit output file path
- `--output-dir <dir>` - Output directory for generated file
- `--project-name <name>` - Project name for file naming
- `--generic-names` - Use generic names like 'surface.json'
- `--diff` - Compare against existing spec and show changes
- `--include-private` - Include private/internal APIs
- `-v, --verbose` - Verbose output with detailed analysis
- `--agent-mode` - Output NDJSON events for agent consumption
- `--ndjson-output <file>` - Write NDJSON events to file

**Examples:**

```bash
arbiter surface typescript --output-dir ./docs
arbiter surface python --diff --include-private
```

### Validation & Testing

#### `arbiter check [patterns...]`

Validate CUE files in the current directory.

**Options:**

- `-r, --recursive` - Recursively search for CUE files (default: true)
- `-w, --watch` - Watch for file changes (deprecated: use `arbiter watch`)
- `-f, --format <type>` - Output format (table, json)
- `-v, --verbose` - Verbose output with detailed errors
- `--fail-fast` - Stop on first validation error
- `--no-recursive` - Disable recursive search

**Examples:**

```bash
arbiter check
arbiter check *.cue --format json
arbiter check --verbose --fail-fast
```

#### `arbiter validate <files...>`

Validate CUE files with explicit schema and configuration.

**Options:**

- `-s, --schema <path>` - Schema file to validate against
- `-c, --config <path>` - Configuration file to include
- `-f, --format <type>` - Output format (table, json)
- `--strict` - Treat warnings as errors
- `-v, --verbose` - Verbose output with detailed errors

**Examples:**

```bash
arbiter validate schema.cue --schema base-schema.cue
arbiter validate *.cue --strict --format json
```

#### `arbiter tests`

Test management, scaffolding, and coverage analysis.

##### `arbiter tests run`

Run unified test harness for analysis/property/golden/cli tests.

**Options:**

- `--epic <epic>` - Epic file containing test configuration
- `--types <types>` - Test types to run (static,property,golden,cli)
- `--junit <file>` - Write JUnit XML report to file
- `-t, --timeout <ms>` - Test timeout in milliseconds (default: 30000)
- `-v, --verbose` - Verbose output with detailed test results
- `--parallel` - Run tests in parallel (not yet implemented)
- `--update-golden` - Update golden files with actual output

**Examples:**

```bash
arbiter tests run --types static,property
arbiter tests run --junit test-results.xml --verbose
```

##### `arbiter tests scaffold`

Generate test skeletons from CUE invariants.

**Options:**

- `-l, --language <lang>` - Target language (typescript, python, rust, go, bash)
- `--framework <name>` - Test framework override
- `--no-property` - Disable property test generation
- `-o, --output <dir>` - Output directory for generated tests
- `--output-dir <dir>` - Output directory (alias for --output)
- `-f, --force` - Overwrite existing test files
- `-v, --verbose` - Verbose output with detailed analysis

**Examples:**

```bash
arbiter tests scaffold --language typescript --output ./tests
arbiter tests scaffold --framework jest --no-property
```

##### `arbiter tests cover`

Compute contract coverage metrics.

**Options:**

- `--format <type>` - Output format (table, json)
- `--threshold <percent>` - Minimum coverage threshold
- `-v, --verbose` - Detailed coverage analysis

### Version Management

#### `arbiter version`

Semver-aware version planning and release management.

##### `arbiter version plan`

Analyze API changes and recommend semver bump.

**Options:**

- `-c, --current <file>` - Current surface file (default: "surface.json")
- `-p, --previous <file>` - Previous surface file for comparison
- `-o, --output <file>` - Output file for version plan (default:
  "version_plan.json")
- `--strict` - Strict mode for library compliance
- `-v, --verbose` - Verbose output with detailed change analysis

**Examples:**

```bash
arbiter version plan --current surface.json --previous surface-v1.json
arbiter version plan --strict --output version-plan.json
```

##### `arbiter version release`

Update manifests and generate changelog based on version plan.

**Options:**

- `--plan <file>` - Version plan file to execute (default: "version_plan.json")
- `--version <version>` - Specific version to set (overrides plan)
- `--changelog <file>` - Changelog output file (default: "CHANGELOG.md")
- `--dry-run` - Preview changes without applying (default)
- `--apply` - Apply changes (disables dry-run)
- `-v, --verbose` - Verbose output with detailed manifest updates

**Examples:**

```bash
arbiter version release --dry-run
arbiter version release --apply --version 2.0.0
```

### Template Management

#### `arbiter template`

Manage and use CUE schema templates.

##### `arbiter template list`

List available templates.

##### `arbiter template show <template>`

Show template details and usage.

##### `arbiter template add <template>`

Add template to current project.

**Options:**

- `--force` - Overwrite existing files

#### `arbiter templates`

Manage template aliases for code generation.

##### `arbiter templates list`

List available template aliases.

**Options:**

- `-f, --format <format>` - Output format (table, json)
- `-v, --verbose` - Verbose output with additional details

##### `arbiter templates show <name>`

Show details for a template alias.

##### `arbiter templates add <name>`

Add a new template alias.

**Options:**

- `--source <source>` - Template source path or URL
- `--description <desc>` - Template description

##### `arbiter templates remove <name>`

Remove a template alias.

##### `arbiter templates update`

Update template configuration.

### Development Tools

#### `arbiter watch [path]`

Cross-platform file watcher with live validation and planning.

**Options:**

- `--agent-mode` - Output NDJSON for agent consumption
- `--ndjson-output <file>` - Write NDJSON events to file instead of stdout
- `--debounce <ms>` - Debounce delay in milliseconds (250-400, default: 300)
- `--patterns <patterns>` - Comma-separated file patterns to watch
- `--no-validate` - Disable validation on changes
- `--plan` - Enable planning pipeline on assembly changes

**Examples:**

```bash
arbiter watch
arbiter watch ./src --patterns "*.cue,*.ts" --agent-mode
arbiter watch --debounce 500 --plan
```

#### `arbiter server`

Start local Arbiter server (development).

**Options:**

- `-p, --port <number>` - Port number (default: 8080)
- `--host <address>` - Host address (default: localhost)

**Examples:**

```bash
arbiter server --port 5050
arbiter server --host 0.0.0.0 --port 8080
```

#### `arbiter preview`

Show what would be generated without creating files (deterministic output).

**Options:**

- `--format <type>` - Output format (tree, json, yaml)
- `--filter <pattern>` - Filter files by pattern
- `-v, --verbose` - Verbose preview with file contents

#### `arbiter diff <old-file> <new-file>`

Compare two CUE schema versions and analyze changes.

**Options:**

- `--migration` - Generate migration guide for breaking changes
- `--format <type>` - Output format (text, json)
- `--context <lines>` - Context lines around changes (default: 3)
- `--summary` - Show only summary statistics

#### `arbiter explain`

Generate plain-English summary of project specifications.

**Options:**

- `--format <type>` - Output format (markdown, json, yaml)
- `--sections <sections>` - Comma-separated sections to include
- `-v, --verbose` - Detailed explanations

### Integration & Deployment

#### `arbiter sync`

Synchronize project manifests with Arbiter.

**Options:**

- `--language <lang>` - Language to sync (python, typescript, rust, bash, all)
- `--all` - Sync all detected language manifests
- `--dry-run` - Show what would be changed without applying
- `--backup` - Create backup files before modification
- `--force` - Overwrite conflicting sections

**Examples:**

```bash
arbiter sync --language typescript
arbiter sync --all --dry-run
```

#### `arbiter integrate`

Generate CI/CD workflows with contract coverage and quality gates.

**Options:**

- `--provider <name>` - CI provider (github, gitlab, azure, all)
- `--type <type>` - Workflow type (pr, main, release, all)
- `--output <dir>` - Output directory for CI files (default:
  ".github/workflows")
- `--force` - Overwrite existing workflow files
- `--matrix` - Use build matrix from assembly file
- `--templates` - Generate GitHub issue templates from configuration

**Examples:**

```bash
arbiter integrate --provider github --type all
arbiter integrate --provider gitlab --output .gitlab-ci
```

#### `arbiter github-templates`

Manage GitHub issue templates configuration.

**Options:**

- `--output <dir>` - Output directory (default: ".github/ISSUE_TEMPLATE")
- `--force` - Overwrite existing templates

#### `arbiter migrate [patterns...]`

Automatically migrate CUE schemas to latest format.

**Options:**

- `--dry-run` - Show what would be changed without making changes
- `--backup` - Create backup files before migration
- `--force` - Proceed with migration even if errors are detected
- `--from <version>` - Source schema version
- `--to <version>` - Target schema version

### Configuration & Health

#### `arbiter config`

Manage CLI configuration.

##### `arbiter config show`

Show current configuration.

##### `arbiter config set <key> <value>`

Set configuration value.

#### `arbiter health`

Comprehensive Arbiter server health check.

**Options:**

- `--verbose` - Show detailed health information
- `--timeout <ms>` - Health check timeout in milliseconds

**Examples:**

```bash
arbiter health
arbiter health --verbose --timeout 10000
```

### Additional Commands

#### `arbiter import`

Manage trusted import registry for CUE files.

##### `arbiter import init`

Initialize import registry with safe defaults.

##### `arbiter import list`

List allowed and blocked imports.

##### `arbiter import add <pattern>`

Add allowed import pattern (supports wildcards).

##### `arbiter import remove <pattern>`

Remove allowed import pattern.

##### `arbiter import block <pattern>`

Block import pattern with reason.

##### `arbiter import validate <files...>`

Validate imports in CUE files against registry.

#### `arbiter spec`

Manage spec fragments and revisions with git-style operations.

##### `arbiter spec status`

Show the status of spec fragments and revisions.

##### `arbiter spec checkout <fragment-path> [revision]`

Checkout a specific revision of a spec fragment.

##### `arbiter spec diff <fragment-path> [old-revision] [new-revision]`

Show differences between spec revisions.

##### `arbiter spec log <fragment-path>`

Show revision history for a spec fragment.

#### `arbiter docs`

Generate documentation from CUE schemas and API surfaces.

##### `arbiter docs schema`

Generate schema documentation from project specifications.

**Options:**

- `--output <file>` - Output file (default: "schema-docs.md")
- `--format <type>` - Output format (markdown, html, json)

##### `arbiter docs api`

Generate API documentation from surface.json.

**Options:**

- `--surface <file>` - Surface file to use (default: "surface.json")
- `--output <file>` - Output file (default: "api-docs.md")
- `--format <type>` - Output format (markdown, html, openapi)

#### `arbiter examples <type>`

Generate example projects by profile or language type.

**Options:**

- `--profile <name>` - Specific profile (library, cli, service)
- `--language <lang>` - Specific language (typescript, python, rust, go)
- `--output <dir>` - Output directory (default: "./examples")
- `--minimal` - Generate minimal examples
- `--complete` - Generate complete examples with full features

#### `arbiter export <files...>`

Export CUE configurations to various formats.

**Options:**

- `--format <type>` - Export format (json, yaml, toml)
- `--output <file>` - Output file
- `--pretty` - Pretty-print output
- `-v, --verbose` - Verbose output

#### `arbiter create <type>`

Create new schemas and configurations interactively.

**Options:**

- `--no-interactive` - Disable interactive mode
- `-n, --name <name>` - Project name
- `-o, --output <file>` - Output file path
- `-t, --template <template>` - Base template to use

#### `arbiter ide recommend`

Generate IDE configuration for optimal CUE development.

**Options:**

- `--editor <editor>` - Target editor (vscode, vim, emacs)
- `--output <dir>` - Output directory for configuration files

#### `arbiter rename`

Migrate existing files to project-specific naming.

**Options:**

- `--from <pattern>` - Source pattern
- `--to <pattern>` - Target pattern
- `--dry-run` - Preview changes without applying

## Agent-Friendly Features

The Arbiter CLI is designed with agent-first principles, providing several
features specifically for AI and automation workflows:

### NDJSON Output

Many commands support `--agent-mode` and `--ndjson-output` options for
structured, parseable output:

```bash
# Output NDJSON to stdout
arbiter watch --agent-mode

# Output NDJSON to file
arbiter execute EPIC-001 --ndjson-output results.ndjson
arbiter surface typescript --agent-mode --ndjson-output surface-events.ndjson
```

### Non-Interactive Commands

All commands are designed to work without user prompts:

```bash
# Force operations without confirmation
arbiter init --force MyApp
arbiter add service api --force

# Dry-run operations for planning
arbiter generate --dry-run
arbiter sync --dry-run
```

### Standardized Output

Commands provide consistent output formats:

- **JSON Format**: `--format json` for structured data
- **Verbose Mode**: `-v, --verbose` for detailed information
- **Exit Codes**: Proper exit codes (0=success, 1=error, 2=config error)

### API Integration

All commands integrate with the Arbiter API server:

```bash
# Configure API endpoint
arbiter --api-url http://localhost:5050 health

# Set timeout for operations
arbiter --timeout 10000 check
```

### Batch Operations

Support for batch operations from configuration files:

```bash
# Batch create tasks
arbiter task batch --epic EPIC-001 --file tasks.json

# Template-based operations
arbiter add service api --template microservice
```

## Output Formats

### Table Format (Default)

Human-readable tables for status and list commands:

```
┌─────────────┬──────────────┬────────────┬──────────┐
│ Epic ID     │ Name         │ Status     │ Progress │
├─────────────┼──────────────┼────────────┼──────────┤
│ EPIC-001    │ User Auth    │ In Progress│ 3/5      │
│ EPIC-002    │ API Migration│ Planning   │ 0/8      │
└─────────────┴──────────────┴────────────┴──────────┘
```

### JSON Format

Structured data for programmatic consumption:

```json
{
  "epics": [
    {
      "id": "EPIC-001",
      "name": "User Auth",
      "status": "in_progress",
      "progress": { "completed": 3, "total": 5 }
    }
  ]
}
```

### NDJSON Format

Streaming events for real-time processing:

```
{"type":"start","command":"execute","epic":"EPIC-001","timestamp":1640995200}
{"type":"progress","task":"TASK-001","status":"completed","timestamp":1640995230}
{"type":"complete","epic":"EPIC-001","status":"success","timestamp":1640995260}
```

## Examples

### Quick Start Workflow

```bash
# Initialize new project
arbiter init "My App" --template basic

# Add core components
arbiter add service api --language typescript --port 3000
arbiter add database appdb --attach-to api
arbiter add endpoint GET /health --service api
arbiter add endpoint POST /users --service api

# Validate specification
arbiter check --verbose

# Generate project files
arbiter generate --dry-run
arbiter generate --include-ci

# Set up development workflow
arbiter integrate --provider github --type all
arbiter watch --plan
```

### Epic-Based Development

```bash
# Create development epic
arbiter epic create --name "User Management System" --priority high

# Add tasks to epic
arbiter task create --epic EPIC-001 --name "User model" --type feature
arbiter task create --epic EPIC-001 --name "Authentication" --type feature --depends-on TASK-001
arbiter task create --epic EPIC-001 --name "API tests" --type test --depends-on TASK-002

# Execute epic
arbiter execute EPIC-001 --agent-mode --ndjson-output execution.ndjson

# Monitor progress
arbiter epic show EPIC-001 --verbose
arbiter task list --epic EPIC-001 --status in_progress
```

### CI/CD Integration

```bash
# Synchronize project manifests
arbiter sync --all --backup

# Generate CI/CD workflows
arbiter integrate --provider github --matrix --templates

# Version management
arbiter surface typescript --output surface.json
arbiter version plan --current surface.json --previous surface-v1.json
arbiter version release --apply --changelog CHANGELOG.md

# Testing and validation
arbiter tests scaffold --language typescript --output ./tests
arbiter tests run --types static,property --junit test-results.xml
```

### Agent Automation

```bash
# Health monitoring
arbiter health --verbose --timeout 5000

# Continuous validation
arbiter watch --agent-mode --patterns "*.cue,*.ts" --ndjson-output events.ndjson

# Batch operations
echo '[{"name":"auth-service","language":"typescript"},{"name":"user-service","language":"python"}]' | \
  arbiter task batch --epic EPIC-001 --json -

# Surface extraction and analysis
arbiter surface typescript --diff --agent-mode --output-dir ./docs
```

## MCP Integration

The Arbiter CLI is designed to work seamlessly with Model Context Protocol (MCP)
servers, providing structured communication and automation capabilities:

### Agent Mode

Use `--agent-mode` flag to enable structured NDJSON output suitable for MCP
consumption:

```bash
arbiter execute EPIC-001 --agent-mode
arbiter watch --agent-mode --ndjson-output events.ndjson
```

### Configuration

The CLI respects `.arbiter.json` configuration for consistent behavior across
automation workflows:

```json
{
  "apiUrl": "http://localhost:5050",
  "timeout": 5000,
  "color": false,
  "github": {
    "repository": { "owner": "username", "repo": "project" }
  }
}
```

### Exit Codes

Proper exit codes enable reliable automation:

- `0`: Success
- `1`: Command error (validation failure, file not found)
- `2`: Configuration error (server unreachable, invalid config)

---

## Getting Help

- Use `--help` with any command for detailed options
- Check the
  [Arbiter GitHub repository](https://github.com/arbiter-framework/arbiter) for
  issues and updates
- View the [documentation](https://arbiter-framework.dev/docs) for tutorials and
  guides

**Last Updated**: 2025-01-14 **CLI Version**: 1.0.0
