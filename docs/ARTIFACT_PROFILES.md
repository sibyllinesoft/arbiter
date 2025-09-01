# Artifact Profiles Guide

## Overview

Arbiter's artifact profile system provides type-safe, validated configurations for four distinct software artifact types. Each profile type enforces specific contracts, validation rules, and testing requirements tailored to its domain.

### The Four Artifact Types

| Type | Purpose | Key Features | Primary Use Cases |
|------|---------|--------------|------------------|
| **Library** | Reusable code packages | API surface validation, semver compliance, breaking change detection | NPM packages, Go modules, Python packages |
| **CLI** | Command-line tools | Command tree validation, golden file tests, help system consistency | Developer tools, system utilities, deployment scripts |
| **Service** | HTTP/WebSocket services | API endpoint validation, health checks, SLA enforcement | REST APIs, GraphQL services, microservices |
| **Job** | Batch/background processes | Resource limits, I/O contracts, determinism validation | Data processing, ETL pipelines, scheduled tasks |

## How Profile Adapters Work

Profile adapters implement the core validation logic for each artifact type through two primary functions:

### The `plan()` Function

The planning function analyzes an epic (a set of planned changes) and generates a specific sequence of validation operations:

```typescript
async plan(epic: Epic, repo: Repository): Promise<{
  operations: Array<{
    type: string;
    config: unknown;
  }>;
}>
```

**Example operations by artifact type:**
- **Library**: `extract_api_surface`, `validate_semver`, `run_tests`
- **CLI**: `compile_command_table`, `run_golden_tests`, `validate_help`
- **Service**: `validate_endpoints`, `check_health`, `run_load_tests`
- **Job**: `enforce_resources`, `validate_io`, `test_determinism`

### The `test()` Function

The testing function executes the planned operations and validates the results:

```typescript
async test(repo: Repository, plan: PlanResult): Promise<{
  pass: boolean;
  verdict: string;
}>
```

**Validation focuses:**
- **Library**: API compatibility, version compliance, test coverage
- **CLI**: Command structure integrity, help text consistency, exit codes
- **Service**: Endpoint functionality, health status, SLA compliance
- **Job**: Resource constraints, I/O safety, execution determinism

## Language Extractors and API Surface Validation

### Supported Languages

Arbiter includes intelligent extractors for multiple programming languages:

#### TypeScript Extractor
- **Tool**: TypeScript Compiler API
- **Extracts**: Exported functions, classes, interfaces, types, enums
- **Signature Analysis**: Full type signatures with parameter and return types
- **Dependencies**: Automatic package.json parsing

```typescript
// Example extracted API symbol
{
  name: "createValidator",
  kind: "function",
  signature: "function createValidator<T>(schema: Schema<T>): Validator<T>",
  visibility: "public"
}
```

#### Go Extractor
- **Tool**: `go doc` command + AST parsing
- **Extracts**: Public functions, types, constants, variables
- **Visibility Rules**: Capitalisation-based public/private detection
- **Module Support**: Full go.mod dependency parsing

```go
// Example Go extraction
type APISymbol struct {
    Name       string `json:"name"`
    Kind       string `json:"kind"`       // "function", "type", "const"
    Signature  string `json:"signature"`
    Visibility string `json:"visibility"` // "public", "private"
}
```

### API Surface Comparison

The system performs intelligent diffing between API surfaces to detect:

#### Breaking Changes (Require Major Version)
- **Removed symbols**: Public functions, types, or constants deleted
- **Signature changes**: Parameter types, return types, or counts modified
- **Visibility reduction**: Public symbols made private or removed

#### Additive Changes (Require Minor Version)
- **New symbols**: Additional public functions, types, or constants
- **Extended interfaces**: Optional parameters or backward-compatible enhancements
- **Enhanced functionality**: New methods on existing types

#### Internal Changes (Require Patch Version)
- **Implementation details**: Private function modifications
- **Documentation updates**: Comments, descriptions, or examples
- **Bug fixes**: Logic corrections that don't affect public API

## The Semver Validation Gate

### Gate Logic

The semver gate implements a strict mathematical validation:

```
GATE_PASSES = (requested_version_bump >= required_bump(Δ))
```

Where `Δ` represents the classified changes between API surfaces.

### Change Classification Algorithm

```typescript
// Pseudocode for change classification
function classifyChanges(oldSurface: APISurface, newSurface: APISurface): {
  // 1. Detect removed symbols → BREAKING
  breaking: detectRemovedSymbols(oldSurface, newSurface),
  
  // 2. Detect signature changes → BREAKING or ADDITIVE
  signatureChanges: analyzeSignatureChanges(oldSurface, newSurface),
  
  // 3. Detect new symbols → ADDITIVE  
  additive: detectNewSymbols(oldSurface, newSurface),
  
  // 4. Internal changes → PATCH
  internal: detectImplementationChanges(oldSurface, newSurface)
}
```

### Semver Policies

#### Strict Policy (Recommended)
- **Breaking changes**: Must use major version bump
- **Additive changes**: Must use minor version bump
- **Internal changes**: Can use patch version bump
- **Enforcement**: Gate fails if version bump is insufficient

#### Minor-Only Policy
- **Breaking changes**: Forbidden (gate always fails)
- **Additive changes**: Allowed with minor bump
- **Internal changes**: Allowed with patch bump
- **Use case**: Libraries with stability guarantees

#### No Policy Enforcement
- **All changes**: Allowed with any version bump
- **Validation**: Informational only
- **Use case**: Internal tools or pre-1.0 development

### Version Bump Comparison Matrix

| Change Type | Impact | Patch | Minor | Major |
|-------------|---------|-------|-------|--------|
| Bug fix | Internal | ✅ | ✅ | ✅ |
| New feature | Additive | ❌ | ✅ | ✅ |
| Breaking change | Breaking | ❌ | ❌ | ✅ |

## CLI Test Harness Capabilities

### Golden File Testing

Golden file tests capture expected CLI behavior through input/output snapshots:

```cue
// Example golden test specification
{
  name: "help_command"
  cmd: "arbiter --help"
  wantOut: "*Arbiter CLI for CUE validation*"
  wantCode: 0
  timeout: "5s"
}
```

**Test execution process:**
1. **Sandbox Creation**: Isolated temporary directory for each test
2. **Command Execution**: CLI invoked with specified arguments
3. **Output Capture**: stdout, stderr, and exit codes recorded
4. **Pattern Matching**: Glob and regex pattern validation
5. **Cleanup**: Automatic sandbox removal after test completion

### Sandboxed Execution

The test harness provides complete isolation:

```typescript
interface CLITestOptions {
  timeout: number;        // Maximum execution time
  useSandbox: boolean;    // Enable isolated execution
  workingDir?: string;    // Custom working directory
  environment?: Record<string, string>; // Environment variables
  verbose?: boolean;      // Detailed test output
}
```

**Security features:**
- **Process isolation**: Each test runs in separate process
- **File system isolation**: Tests cannot affect host system
- **Network restrictions**: Configurable network access controls
- **Resource limits**: Memory and CPU usage constraints

### Property-Based Testing

Beyond golden tests, the system supports property-based validation:

```cue
// Example property test
{
  name: "help_commands_exit_zero"
  description: "All --help commands should exit with code 0"
  property: "all(commands, cmd => cmd.help_exit_code == 0)"
}
```

**Property categories:**
- **Consistency properties**: Help text format, exit code meanings
- **Behavioral properties**: Idempotency, determinism
- **Performance properties**: Execution time bounds, memory usage

### Automatic Test Generation

The harness automatically generates tests for common CLI patterns:

#### Help Command Tests
- Generated for every command and subcommand
- Validates help text contains command summary
- Ensures consistent formatting and exit codes

#### Version Command Tests  
- Validates version format (semantic versioning)
- Ensures version information is accessible
- Cross-references with package metadata

#### Error Handling Tests
- Invalid argument combinations
- Missing required parameters
- File access permission errors

## Assembly File Structure

All artifact profiles are defined in `.assembly.cue` files with a consistent structure:

### Standard Assembly Components

```cue
// Every assembly file includes:
package assembly

// 1. Artifact metadata
artifact: {
  name: "my-project"
  version: "1.0.0"  
  kind: "library" | "cli" | "service" | "job"
}

// 2. Profile configuration (type-specific)
profile: LibraryProfile | CLIProfile | ServiceProfile | JobProfile

// 3. Build configuration
build: {
  language: "typescript" | "go" | "python" | "rust"
  framework?: string
  targets: [...string]
}

// 4. Test configuration
tests: {
  unit: { coverage: >=90 }
  integration: { required: true }
  e2e?: { browser?: [...string] }
}

// 5. Packaging configuration
package: {
  registry?: string
  publish: bool
  assets?: [...string]
}
```

### Profile-Specific Sections

Each artifact type adds specialized configuration:

#### Library Assembly Additions
```cue
profile: LibraryProfile & {
  semver: "strict"
  apiSurface: { /* API extraction config */ }
  contracts: { /* Breaking change rules */ }
}
```

#### CLI Assembly Additions
```cue 
profile: CLIProfile & {
  commands: [/* Command definitions */]
  tests: { golden: [/* Golden file tests */] }
  completion: { /* Shell completion config */ }
}
```

#### Service Assembly Additions
```cue
profile: ServiceProfile & {
  endpoints: [/* API endpoint definitions */]
  healthCheck: { /* Health check configuration */ }
  sla: { /* Service level agreements */ }
}
```

#### Job Assembly Additions
```cue
profile: JobProfile & {
  resources: { /* CPU, memory, time limits */ }
  ioContracts: { /* File access permissions */ }
  execution: { /* Retry, timeout, concurrency */ }
}
```

## Integration with Build Systems

### Language-Specific Integration

#### Node.js/TypeScript Projects
```json
// package.json integration
{
  "scripts": {
    "arbiter:validate": "arbiter check",
    "arbiter:test": "arbiter test --profile cli",
    "prebuild": "arbiter validate",
    "pretest": "arbiter generate-schemas"
  },
  "arbiter": {
    "profile": "library",
    "apiExtraction": {
      "tool": "api-extractor",
      "config": "./api-extractor.json"
    }
  }
}
```

#### Go Module Integration
```go
// go.mod integration through build constraints
//go:build arbiter
// +build arbiter

package main

import _ "github.com/arbiter/go-plugin"
```

#### Python Integration
```toml
# pyproject.toml integration
[tool.arbiter]
profile = "library"
api-extraction = "pydantic"

[tool.arbiter.semver]
policy = "strict"
```

### CI/CD Integration

#### GitHub Actions
```yaml
name: Arbiter Validation
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: arbiter/setup-action@v1
        with:
          profile: library
      - run: arbiter validate --strict
      - run: arbiter test --coverage 90
```

#### GitLab CI
```yaml
arbiter:validate:
  stage: validate
  script:
    - arbiter check --profile service
    - arbiter test --golden --property
  artifacts:
    reports:
      junit: arbiter-test-results.xml
```

## Best Practices

### Profile Selection Guidelines

#### Choose **Library** when:
- ✅ Code will be imported by other projects
- ✅ API stability matters for downstream users  
- ✅ Semantic versioning is important
- ✅ Breaking changes need careful management

#### Choose **CLI** when:
- ✅ Primary interface is command-line arguments
- ✅ User experience consistency is critical
- ✅ Help documentation needs to be accurate
- ✅ Command behavior must be predictable

#### Choose **Service** when:
- ✅ Exposes HTTP/WebSocket endpoints
- ✅ Must handle concurrent requests
- ✅ Health monitoring is required
- ✅ SLA compliance needs validation

#### Choose **Job** when:
- ✅ Runs as batch or background process
- ✅ Resource consumption must be controlled
- ✅ File system access needs restrictions
- ✅ Deterministic execution is required

### Configuration Strategies

#### Start Simple, Add Complexity
```cue
// 1. Begin with minimal profile
profile: LibraryProfile & {
  semver: "strict"
}

// 2. Add API surface validation
profile: LibraryProfile & {
  semver: "strict"
  apiSurface: {
    source: "generated"
    extractors: typescript: {
      tool: "api-extractor"
      config: "./api-extractor.json"
    }
  }
}

// 3. Add comprehensive testing
profile: LibraryProfile & {
  semver: "strict"
  apiSurface: { /* ... */ }
  propertyTests: [
    {
      name: "export_consistency"
      description: "All exports must have TypeScript types"
      property: "all_exports_have_types"
    }
  ]
}
```

#### Environment-Specific Configuration
```cue
// Use CUE's conditional logic for environment variations
#IsDevelopment: build.environment == "development"

profile: ServiceProfile & {
  healthCheck: path: "/health"
  
  // Relaxed timeouts in development
  if #IsDevelopment {
    healthCheck: timeout: "30s"
  }
  if !#IsDevelopment {
    healthCheck: timeout: "5s"  
  }
}
```

### Testing Strategy Recommendations

#### Library Projects
- **Focus on**: API compatibility, semver compliance
- **Golden tests**: Public API usage examples
- **Property tests**: Type safety, behavioral consistency
- **Coverage target**: 95%+ for public APIs

#### CLI Projects  
- **Focus on**: Command reliability, help accuracy
- **Golden tests**: All commands and flag combinations
- **Property tests**: Exit code consistency, help format
- **Interactive tests**: For prompts and confirmations

#### Service Projects
- **Focus on**: Endpoint reliability, health monitoring
- **Load tests**: Performance under expected traffic
- **Contract tests**: API specification compliance
- **Chaos tests**: Fault tolerance validation

#### Job Projects
- **Focus on**: Resource safety, execution determinism
- **Unit tests**: Core business logic validation
- **Integration tests**: Full end-to-end workflows
- **Property tests**: Idempotency, resource constraints

## Troubleshooting Common Issues

### API Surface Extraction Failures

**Problem**: TypeScript extractor fails with compilation errors
```bash
Error: Cannot resolve module 'some-dependency'
```

**Solution**: Ensure all dependencies are installed and TypeScript configuration is valid
```cue
// Add to assembly configuration
profile: LibraryProfile & {
  apiSurface: extractors: typescript: {
    tool: "api-extractor"
    config: "./api-extractor.json"
    // Add tsconfig path resolution
    tsConfig: "./tsconfig.json"
  }
}
```

### Semver Gate Failures

**Problem**: Gate rejects valid version bump
```bash
Error: Version bump 'minor' insufficient for changes requiring 'major'
```

**Solution**: Review breaking changes and adjust version or make changes backward-compatible
```typescript
// Instead of removing a parameter (breaking)
function processData(data: string, options: Options): Result

// Add optional parameter (non-breaking)  
function processData(data: string, options?: Options): Result
```

### Golden Test Flakiness

**Problem**: Tests pass locally but fail in CI
```bash
Golden test 'command_output' failed: timeout after 30s
```

**Solution**: Increase timeouts and add retry logic for CI environments
```cue
tests: golden: [
  {
    name: "slow_command"
    cmd: "arbiter analyze large-file.cue"
    wantCode: 0
    // Increase timeout for CI
    timeout: "60s"
  }
]
```

### Resource Limit Violations

**Problem**: Job exceeds specified resource constraints
```bash
Error: Job exceeded memory limit: used 512Mi, limit 256Mi
```

**Solution**: Adjust limits or optimize job implementation
```cue
profile: JobProfile & {
  resources: {
    // Increase limits based on actual usage
    memory: "512Mi"
    // Or add more efficient resource usage
    cpu: "100m" // Lower CPU if memory is primary constraint
  }
}
```

This comprehensive guide provides everything needed to understand and effectively use Arbiter's artifact profile system. Each profile type enforces domain-specific best practices while providing the flexibility to adapt to unique project requirements.