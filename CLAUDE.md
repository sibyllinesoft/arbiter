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

### Key Value Propositions
1. **Declarative Infrastructure**: Define complex systems in CUE and generate everything
2. **AI-Friendly**: Non-interactive commands, structured outputs, comprehensive APIs
3. **Full-Stack Generation**: From database schemas to UI components to CI/CD pipelines
4. **Validation-First**: Strong typing and validation throughout the development lifecycle

---

## 🏗️ REPOSITORY ARCHITECTURE

### Monorepo Structure
```
arbiter/
├── apps/                    # Deployable applications
│   ├── api/                # Bun + TypeScript API server (port 5050)
│   └── web/                # React + Vite frontend
├── packages/               # Shared libraries
│   ├── cli/                # Main CLI package (@arbiter/cli)
│   └── shared/             # Shared types and utilities
├── tests/                  # E2E and integration tests
├── examples/               # Example projects and specifications
├── docs/                   # Documentation and tutorials
└── scripts/                # Build and automation scripts
```

### Package Dependencies
- **Root**: Workspaces coordinator, contains standalone CLI binary (`arbiter-cli`)
- **packages/cli**: Core CLI implementation, depends on `packages/shared`
- **packages/shared**: Common types, utilities, CUE processing logic
- **apps/api**: Backend API server for spec management and validation
- **apps/web**: Web frontend for visual spec editing (React + Vite)

### Technology Stack
- **Runtime**: Bun (primary), Node.js (compatibility)
- **Languages**: TypeScript (strict mode), CUE for specifications
- **CLI Framework**: Commander.js with chalk for styling
- **Testing**: Bun test, golden file testing, E2E with Docker Compose
- **Build**: Bun build, TypeScript compilation
- **Formatting**: Biome (linting, formatting)

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
# Terminal 1: API Server
bun run dev

# Terminal 2: CLI Development  
cd packages/cli
bun run dev

# Terminal 3: Frontend (if needed)
cd apps/web/frontend
bun run dev
```

---

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

### Exit Codes
- `0` - Success
- `1` - Command error (validation failure, file not found, etc.)
- `2` - Configuration error (server unreachable, config invalid)

---

*Last Updated: 2025-09-07*  
*This document reflects the current state of the Arbiter project after CLI simplification and test cleanup.*