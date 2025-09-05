# Arbiter

_CUE-based specification validation and management CLI with agent-first automation_

Arbiter is a powerful CLI toolkit for CUE (Configure, Unify, Execute) specification management, validation, and code generation. Built with agent-first design principles, it provides comprehensive CUE tooling for developers and AI agents with JSON output support, structured error handling, and automation-friendly interfaces.

## ✨ Features

### 🤖 Agent-First Design
- **JSON output support** for all commands
- **Structured error codes** for automation workflows
- **Predictable exit codes** for CI/CD integration
- **Self-contained executable** with minimal dependencies

### 🛠️ Comprehensive CUE Tooling
- **Validation and checking** with detailed error reporting
- **Multi-format export** to JSON, YAML, OpenAPI, Kubernetes, and more
- **Template management** with project scaffolding
- **Schema generation** and code generation capabilities

### 📊 Project Management
- **File watching** with real-time validation feedback  
- **Dependency analysis** and project structure insights
- **Test generation** from CUE invariants and specifications
- **Version management** with semantic versioning support

### 🏗️ Monorepo Architecture
- **Modular design** with shared packages and isolated applications
- **TypeScript throughout** with strict type safety
- **Bun-powered performance** for fast execution
- **Docker containerization** for consistent deployment

## 🏗️ Architecture

```
┌─────────────────┐                 ┌─────────────────┐
│  Arbiter CLI    │ ────────────→   │ CUE Validation  │
│                 │                 │ API Server      │
│ • File watching │                 │                 │
│ • Validation    │                 │ • CUE Engine    │
│ • Export tools  │                 │ • Schema mgmt   │
│ • Templates     │                 │ • Code gen      │
└─────────────────┘                 └─────────────────┘
```

**Monorepo Structure:**
- **apps/api/**: TypeScript API server with CUE validation engine
- **packages/shared/**: Common types, utilities, and configurations
- **packages/cli/**: CLI command implementations and tooling
- Bun for runtime performance and package management
- Docker for containerized development and deployment

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh/) v1.0.0 or later
- Docker (optional, for containerized development)

### CLI Installation & Setup

1. **Clone and setup dependencies:**
   ```bash
   git clone <repository-url>
   cd arbiter
   bun install
   ```

2. **Build the monorepo:**
   ```bash
   bun run build:all
   ```

3. **Start the API server (optional, for advanced features):**
   ```bash
   bun dev
   # Server starts at http://localhost:5050
   ```

4. **Use the CLI:**
   ```bash
   # Make CLI executable
   chmod +x arbiter-cli.mjs
   
   # Check installation
   ./arbiter-cli.mjs --help
   
   # Check server connectivity (with auto-discovery)
   ./arbiter-cli.mjs check
   
   # Validate CUE files
   ./arbiter-cli.mjs validate examples/basic.cue
   
   # Check API health
   ./arbiter-cli.mjs health
   ```

### Global Installation

```bash
# Install globally for system-wide access
./install-cli.sh

# After installation, use from anywhere:
arbiter --help
arbiter check
```

## 🖥️ Arbiter CLI

Arbiter includes a powerful command-line interface that provides access to all CUE validation, schema management, and code generation capabilities. The CLI is designed to be agent-friendly and easily distributable for external use.

### CLI Installation

#### Option 1: Direct Usage (Recommended for Development)
```bash
# From the project root
./arbiter-cli.mjs --help
```

#### Option 2: Global Installation
```bash
# Install globally for system-wide access
./install-cli.sh

# After installation, use from anywhere:
arbiter --help
```

#### Option 3: npm/Package Manager Installation
```bash
# Local installation in a project
npm install arbiter

# Use with npx
npx arbiter --help

# Or add to package.json scripts:
# "scripts": { "validate": "arbiter check" }
```

### CLI Quick Start

```bash
# Check CLI installation and dependencies
arbiter-cli.mjs --deps-check --verbose

# Initialize a new CUE project
arbiter-cli.mjs init my-project --template basic

# Validate CUE files
arbiter-cli.mjs check

# Watch files for changes with live validation
arbiter-cli.mjs watch

# Generate API surface documentation
arbiter-cli.mjs surface typescript --output api.json

# Export configurations to various formats
arbiter-cli.mjs export *.cue --format json,yaml,openapi

# Check server health
arbiter-cli.mjs health
```

### Key CLI Commands

| Command | Description | Example |
|---------|-------------|---------|
| `init` | Initialize new CUE project with templates | `arbiter init my-app --template kubernetes` |
| `check` | Validate CUE files with detailed reporting | `arbiter check --format json --verbose` |
| `watch` | Real-time file watching with validation | `arbiter watch --agent-mode --debounce 250` |
| `surface` | Extract API surfaces from code | `arbiter surface typescript --diff --include-private` |
| `export` | Export to multiple formats | `arbiter export . --format openapi,types,k8s` |
| `validate` | Explicit schema validation | `arbiter validate schema.cue data.cue --strict` |
| `version` | Semver-aware version management | `arbiter version plan --strict --verbose` |
| `tests` | Generate and run tests from invariants | `arbiter tests scaffold --language typescript` |
| `generate` | Generate code from specifications | `arbiter generate --output-dir ./generated` |
| `health` | Comprehensive server health check | `arbiter health --verbose --timeout 5000` |

### CLI for Agents and Automation

The Arbiter CLI is specifically designed to work seamlessly with AI agents and automation tools:

**Agent-Friendly Features:**
- **Structured Output**: JSON format support for all commands
- **Exit Codes**: Predictable exit codes for automation workflows  
- **Dependency Checking**: Built-in dependency validation with suggestions
- **Self-Contained**: Minimal external dependencies required
- **Error Recovery**: Comprehensive error messages with actionable suggestions

**Automation Examples:**
```bash
# CI/CD Pipeline Integration
arbiter check --format json > validation-report.json
arbiter tests run --junit test-results.xml
arbiter version plan --output version-plan.json

# Agent Workflow Integration
arbiter watch --agent-mode | jq '.type == "validation_error"'
arbiter surface typescript --diff --format json | jq '.breaking_changes[]'

# Batch Processing
find . -name "*.cue" -exec arbiter validate {} \;
arbiter export **/*.cue --format openapi --output ./docs/api/
```

### CLI Configuration

Create `.arbiter.json` in your project root:

```json
{
  "apiUrl": "http://localhost:5050",
  "timeout": 750,
  "format": "table",
  "color": true,
  "projectDir": "."
}
```

**Supported Formats:**
- JSON: `.arbiter.json`
- YAML: `.arbiter.yaml` or `.arbiter.yml`
- Auto-discovery up the directory tree

### Advanced CLI Usage

**Template Management:**
```bash
# List available templates
arbiter template list

# Add custom template to project
arbiter template add budget_constraint --output my-budget.cue

# Show template details
arbiter template show selection_rubric
```

**Epic Execution (Agent-First Code Generation):**
```bash
# Execute development epics with deterministic output
arbiter execute epics/new-service.json --dry-run
arbiter execute epics/config-refactor.json --verbose
```

**Testing Revolution:**
```bash
# Generate tests from CUE invariants
arbiter tests scaffold --language typescript --verbose
arbiter tests scaffold --language python --output tests/

# Analyze contract coverage
arbiter tests cover --threshold 0.9 --junit coverage.xml

# Run unified test harness
arbiter tests run --epic epics/service.json --types static,golden
```

**IDE and Ecosystem Integration:**
```bash
# Generate IDE configurations
arbiter ide recommend --editor vscode --force

# Synchronize project manifests
arbiter sync --language typescript --dry-run

# Generate CI/CD workflows
arbiter integrate --provider github --matrix
```

### Troubleshooting CLI

**Common Issues:**

1. **Missing Dependencies**
   ```bash
   # Check dependencies and get suggestions
   arbiter-cli.mjs --deps-check --verbose
   
   # Install missing dependencies
   bun install  # or npm install
   ```

2. **CLI Not Built**
   ```bash
   # Build the CLI
   bun run build:cli
   
   # Or build everything
   bun run build
   ```

3. **Server Connection Issues**
   ```bash
   # Check connectivity with auto-discovery
   arbiter check --detailed
   
   # Test server health
   arbiter health
   
   # Manually specify server port
   arbiter config set apiUrl http://localhost:5050
   ```

   **Port Configuration Guide:**
   - **Development**: Server runs on port `5050` (`bun run dev`)
   - **Docker**: Server runs on port `5050` (`docker-compose up`)
   - **CLI Auto-discovery**: Tries ports `[5050, 3000, 4000, 8080]`
   
   If connection fails:
   1. Verify server is running: `curl http://localhost:5050/health`
   2. Check logs: `bun run dev` or `docker-compose logs`
   3. Try discovery: `arbiter check --detailed`
   
   # Start the server if needed
   bun dev
   ```

4. **Permission Issues**
   ```bash
   # Make CLI executable
   chmod +x arbiter-cli.mjs
   
   # Check installation permissions
   ls -la ~/.local/bin/arbiter
   ```

**Getting Help:**
```bash
# General help
arbiter-cli.mjs --help

# Command-specific help
arbiter-cli.mjs <command> --help

# CLI diagnostics
arbiter-cli.mjs --info
arbiter-cli.mjs --self-test
```

## 📖 Usage

### Basic CUE Validation

```bash
# Validate CUE files in current directory
./arbiter-cli.mjs check

# Validate specific files
./arbiter-cli.mjs check schema.cue config.cue

# Get JSON output for automation
./arbiter-cli.mjs check --format json
```

### Project Scaffolding

```bash
# Initialize a new CUE project
./arbiter-cli.mjs init my-project --template basic

# List available templates
./arbiter-cli.mjs template list

# Generate from templates
./arbiter-cli.mjs generate --template kubernetes
```

### Export and Transformation

```bash
# Export to multiple formats
./arbiter-cli.mjs export config.cue --format json,yaml,openapi

# Extract API surface from TypeScript
./arbiter-cli.mjs surface typescript --output api.json

# Watch files with real-time validation
./arbiter-cli.mjs watch --debounce 250
```

## 🧪 Development

### Running Tests

```bash
# Shared package tests
bun test

# CLI functionality tests  
./arbiter-cli.mjs --self-test

# Manual validation
./test-cli-distribution.sh
```

### Building for Production

```bash
# Build all packages
bun run build:all

# Build individual components
bun run build:shared
bun run build:api

# Build Docker image
docker build -t arbiter .
```

### Code Quality

```bash
# Type checking across monorepo
bun run typecheck

# Linting with Biome
bun run lint

# Auto-formatting
bun run format
bun run lint:fix

# Quality gate (with warnings acceptable)
bun run quality
```

## 📁 Project Structure

```
arbiter/                           # Root workspace
├── package.json                   # Workspace configuration  
├── tsconfig.json                 # Root TypeScript config
├── biome.json                    # Code formatting/linting
├── arbiter-cli.mjs               # ✅ Working CLI wrapper
├── arbiter-cli.cjs               # ✅ Stable CLI backend
│
├── apps/
│   ├── api/                      # ✅ API application
│   │   ├── package.json          # API-specific dependencies
│   │   ├── tsconfig.json         # API TypeScript config  
│   │   ├── src/                  # ✅ TypeScript source
│   │   └── dist/                 # ✅ Built output
│   └── web/                      # Future frontend (prepared)
│
├── packages/
│   ├── shared/                   # ✅ Shared utilities
│   │   ├── package.json          # Shared package config
│   │   ├── tsconfig.json         # Shared TypeScript config
│   │   ├── src/                  # ✅ Shared types & utils
│   │   └── dist/                 # ✅ Built output
│   └── cli/                      # CLI package (TypeScript source)
│       ├── package.json          # CLI-specific dependencies
│       ├── tsconfig.json         # CLI TypeScript config
│       └── src/                  # CLI command implementations
│
├── spec/                         # Example CUE specifications
├── doc/                         # CUE language documentation  
├── examples/                    # Usage examples
└── scripts/                     # Build and deployment scripts
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes with tests
4. Ensure all tests pass: `bun test && cd frontend && npm test`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built on the powerful [CUE language](https://cuelang.org/)
- Inspired by collaborative editing tools like Figma and Notion  
- Thanks to the CUE community for excellent documentation and examples

