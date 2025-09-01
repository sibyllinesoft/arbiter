# Arbiter Agent

Implementation Agent following the **Arbiter Agent — Operating Prompt (v1)** specification. Makes CUE files executable contracts with deterministic, idempotent operations within strict operational constraints.

## Overview

The Arbiter Agent transforms CUE configuration files into executable contracts that can generate, patch, and test code deterministically. It operates within Arbiter's strict sandbox constraints:

- **64KB** maximum analysis text per operation
- **750ms** per-job timeout limit  
- **≈1 RPS** rate limit for API calls
- **4 workers** bounded concurrency

## Core Commands

### `scan` - Discover/Synthesize Assembly Files

Scans repository structure and discovers existing CUE packages, YAML trees, and suggests project configurations. If no `arbiter.assembly.cue` exists, synthesizes one from the repository structure.

```bash
arbiter-agent scan [path] [options]
```

**Options:**
- `-o, --output <dir>` - Output directory for results
- `-v, --verbose` - Verbose output

**Outputs:**
- `scan.json` - Discovery results and metadata
- `arbiter.assembly.json` - Synthesized assembly (if none found)
- `migration-patch.json` - Migration plan (if legacy detected)

### `assemble` - Load Assembly & Upsert Projects

Loads assembly configuration, computes file→project mappings with conflict resolution, and upserts projects in Arbiter with proper batching for payload size limits.

```bash
arbiter-agent assemble [path] [options]
```

**Options:**
- `-a, --assembly <file>` - Assembly file path
- `--apply` - Apply changes to Arbiter (default: dry-run)
- `--api-url <url>` - Arbiter API URL (default: http://localhost:8080)
- `--timeout <ms>` - Request timeout (default: 750)
- `-v, --verbose` - Verbose output

**Features:**
- Stable-sorted project processing for deterministic results
- File conflict resolution (nearest to root wins)
- Batched analysis requests respecting 64KB limits
- Rate-limited API calls at 1 RPS

### `execute` - Execute Versioned Epics

Executes versioned epics with deterministic code generation, full test pipelines, and idempotence assertions.

```bash
arbiter-agent execute <epicPath> [options]
```

**Options:**
- `-r, --repo <path>` - Repository path (default: current directory)
- `--apply` - Apply changes to filesystem (default: dry-run)
- `--api-url <url>` - Arbiter API URL (default: http://localhost:8080)
- `--timeout <ms>` - Request timeout (default: 750)
- `--junit <file>` - JUnit XML output file
- `-v, --verbose` - Verbose output

**Features:**
- Versioned resource migration (v0 → v1 automatic)
- Deterministic execution plans with guard validation
- ARBITER marker-based idempotent patching
- Full test pipeline: static → property → golden → CLI
- Event emission: ProjectUpdated, EpicsChanged, TestReportReady

## Versioned Envelope System

All resources use the `apiVersion/kind/spec` envelope structure:

```typescript
interface EnvelopedResource<T> {
  apiVersion: string;        // e.g., "arbiter.dev/v1"
  kind: 'Assembly' | 'Epic'; 
  metadata?: {
    name?: string;
    createdAt?: string;
    annotations?: Record<string, string>;
  };
  spec: T;
}
```

### Assembly v1 Structure

```typescript
interface AssemblyV1 {
  projects: Array<{
    name: string;
    path: string;
    include?: string[];  // default: ["**/*.cue"]
    exclude?: string[];  // default: ["**/node_modules/**"]
    schema?: string;
    entrypoint?: string;
  }>;
  epics?: Array<{
    id: string;
    path: string;
    enabled?: boolean;
  }>;
  settings?: {
    defaultTimeout?: number;     // default: 750
    maxConcurrency?: number;     // default: 4
    rateLimits?: {
      requestsPerSecond?: number; // default: 1
      payloadSizeKB?: number;     // default: 64
    };
  };
}
```

### Epic v1 Structure

```typescript
interface EpicV1 {
  id: string;              // pattern: ^EPIC-[A-Z0-9-]+$
  title: string;
  owners: string[];
  targets: Array<{
    root: string;
    include: string[];
    exclude: string[];
  }>;
  generate: Array<{
    path: string;
    mode: 'create' | 'patch';
    template: string;        // file path or inline content
    data: Record<string, any>;
    guards: string[];        // strings that must NOT exist
  }>;
  contracts: {
    types: string[];         // CUE type definitions
    invariants: string[];    // CUE constraint expressions
  };
  tests: {
    static: Array<{ selector: string }>;
    property: Array<{ name: string; cue: string }>;
    golden: Array<{ input: string; want: string }>;
    cli: Array<{ cmd: string; expectExit: number; expectRE?: string }>;
  };
  rollout: {
    steps: string[];
    gates: Array<{ name: string; cue: string }>;
  };
  heuristics: {
    preferSmallPRs: boolean;    // default: true
    maxFilesPerPR: number;      // default: 10
  };
}
```

## Migration System

The agent automatically migrates legacy v0 resources to v1:

- **Legacy Detection**: Recognizes unversioned CUE/JSON formats
- **Automatic Migration**: Converts to envelope structure
- **Migration Patches**: Documents all changes made
- **Backward Compatibility**: Maintains functionality during transition

## Idempotent Operations

All operations are designed to be safely re-runnable:

- **Deterministic Plans**: Same inputs always produce same execution plan
- **Guard Validation**: Prevents conflicting changes
- **ARBITER Markers**: Enable safe re-application of patches
- **Idempotence Assertions**: Verifies re-runs would be no-ops

### ARBITER Markers

```typescript
// ARBITER:BEGIN endpoint
export const handlers = {
  // Generated content here
};
// ARBITER:END endpoint
```

Markers enable safe patching by allowing the agent to update specific sections without affecting surrounding code.

## Development

```bash
# Install dependencies
bun install

# Development mode
bun run dev

# Build
bun run build

# Type check
bun run typecheck

# Test
bun run test
```

## Integration

The agent integrates with the broader Arbiter ecosystem:

- **Arbiter API**: Projects, analysis, events via rate-limited HTTP
- **CUE Runtime**: Schema validation and property testing  
- **File System**: Deterministic file generation and patching
- **CI/CD**: Event emission for external automation

## Architecture

```
┌─────────────────────────────────────────┐
│              CLI Layer                  │
├─────────────────────────────────────────┤
│  scan    │  assemble   │   execute      │
├─────────────────────────────────────────┤  
│         Versioning System               │
│    (Migration, Validation, Envelopes)   │
├─────────────────────────────────────────┤
│         Rate Limiter                    │
│    (1 RPS, 64KB, 750ms constraints)    │
├─────────────────────────────────────────┤
│              Core Engine                │
│   (Deterministic Plans, Guards, Tests) │
└─────────────────────────────────────────┘
```

The agent follows the **ports and adapters** pattern with clean separation between:
- **Domain Logic**: Versioning, planning, execution rules
- **Application Layer**: Command orchestration and workflows  
- **Infrastructure**: File system, HTTP API, CUE runtime

## License

MIT