# Artifact Profiles Guide

This document explains Arbiter's artifact profile system, which generalizes the agent to handle different types of software artifacts beyond just services.

## Overview

Arbiter now supports four primary artifact types, each with specialized testing and validation approaches:

- **Library**: API surface extraction, semver policy enforcement, breaking change detection
- **CLI**: Command tree validation, golden I/O testing, interactive session testing  
- **Service**: Traditional deployment patterns (existing functionality)
- **Job**: Resource constraint validation, I/O contract enforcement

## Architecture

The profile system uses the adapter pattern to provide specialized behavior for each artifact type:

```
EpicV1 + AssemblyV1 → ProfileAdapter.plan() → ExecutionPlan → ProfileAdapter.test() → TestVerdict
```

### Core Components

1. **Profile Adapters** (`packages/agent/src/adapters/`)
   - `LibraryAdapter`: Handles library-specific testing
   - `CLIAdapter`: Handles CLI-specific testing with golden tests
   - `JobAdapter`: Handles batch job validation

2. **Surface Extractors** (`packages/agent/src/extractors/`)
   - `TypeScriptSurfaceExtractor`: Extracts TypeScript API surfaces
   - `GoSurfaceExtractor`: Extracts Go API surfaces

3. **Testing Harnesses** (`packages/agent/src/testing/`)
   - `CLIContractHarness`: Comprehensive CLI testing framework

4. **Semver Analysis** (`packages/agent/src/semver/`)
   - `SemverGate`: Breaking change detection and version validation

## Configuration

### Assembly Configuration

Add artifact and profile information to your `arbiter.assembly.json`:

```json
{
  "spec": {
    "artifact": {
      "kind": "library",
      "language": "ts",
      "build": {
        "tool": "bun",
        "targets": ["./src"]
      }
    },
    "profiles": {
      "library": {
        "semver": "strict",
        "surfaceConfig": {
          "entryPoints": ["./src/index.ts"],
          "includePrivate": false
        }
      }
    }
  }
}
```

### CUE Schema Integration

Artifact profiles are defined in CUE for validation:

```cue
// spec/spec/schema/artifact_spec.cue
#Artifact: {
  kind: "library" | "cli" | "service" | "job"
  language: "go" | "ts" | "rust" | "python" | string
  build: #BuildConfig
  packaging?: #PackagingConfig
}
```

## Profile Types

### Library Profile

Libraries focus on API stability and semver compliance:

**Key Features:**
- API surface extraction from TypeScript .d.ts files or Go packages
- Breaking change detection using semver rules
- Automated version bump recommendations
- Type safety validation

**Configuration Example:**
```json
{
  "profiles": {
    "library": {
      "semver": "strict",
      "surfaceConfig": {
        "entryPoints": ["./src/index.ts"],
        "includePrivate": false,
        "extractorOptions": {
          "followReferences": true,
          "includeDocumentation": true
        }
      }
    }
  }
}
```

**Testing Process:**
1. Build the library
2. Extract current API surface
3. Load previous API surface (if exists)
4. Compare surfaces for breaking changes
5. Validate semver compliance
6. Run property tests (if configured)

### CLI Profile  

CLIs focus on command interface stability and I/O contracts:

**Key Features:**
- Command tree structure validation
- Golden file testing for output consistency
- Interactive session testing
- Exit code contract enforcement
- Auto-generated help tests

**Configuration Example:**
```json
{
  "profiles": {
    "cli": {
      "semver": "minor",
      "commandTree": {
        "name": "mycli",
        "description": "My CLI tool",
        "flags": [
          {
            "name": "--version",
            "short": "-v",
            "description": "Show version",
            "type": "boolean"
          }
        ],
        "subcommands": [
          {
            "name": "init",
            "description": "Initialize project",
            "flags": [
              {
                "name": "--name",
                "description": "Project name",
                "type": "string",
                "required": true
              }
            ]
          }
        ]
      },
      "tests": {
        "golden": [
          {
            "name": "Version Output",
            "cmd": "--version",
            "wantCode": 0,
            "normalize": {
              "timestamps": ["buildTime"]
            }
          }
        ],
        "interactive": [
          {
            "name": "Interactive Init",
            "steps": [
              {
                "send": "init",
                "expect": "Enter project name:",
                "delay": 500
              },
              {
                "send": "my-project",
                "expect": "Project created successfully"
              }
            ]
          }
        ]
      }
    }
  }
}
```

### Job Profile

Jobs focus on resource constraints and I/O contracts:

**Key Features:**
- Resource limit validation (CPU, memory, disk)
- I/O schema validation
- Batch processing contracts
- Timeout and retry policy enforcement

**Configuration Example:**
```json
{
  "profiles": {
    "job": {
      "resources": {
        "cpu": "2000m",
        "memory": "4Gi",
        "disk": "10Gi"
      },
      "io": {
        "inputSchema": "./schemas/input.json",
        "outputSchema": "./schemas/output.json"
      },
      "execution": {
        "timeout": "30m",
        "retries": 3
      }
    }
  }
}
```

## Testing Workflow

### Automatic Profile Detection

The `scan` command automatically detects artifact types:

```bash
bun run scan
```

Detection rules:
- `package.json` + TypeScript → Library (TypeScript)
- `go.mod` → Library/CLI (Go)
- `Cargo.toml` → Library/CLI (Rust)
- Binary in common locations → CLI
- Batch processing patterns → Job

### Execution with Profile Testing

```bash
# Uses profile-specific testing automatically
bun run execute epic.json --apply

# Falls back to legacy testing if profile not supported
bun run execute epic.json --apply --verbose
```

### Manual Testing

You can test profiles directly using the adapters:

```typescript
import { LibraryAdapter } from './packages/agent/src/adapters/library-adapter.js';
import { CLIContractHarness } from './packages/agent/src/testing/cli-harness.js';

// Library testing
const adapter = new LibraryAdapter();
const plan = await adapter.plan(epic, assembly, repoPath);
const verdict = await adapter.test(repoPath, plan);

// CLI testing
const harness = new CLIContractHarness({
  binaryPath: '/path/to/cli',
  workingDir: '/repo/path',
  timeout: 30000
});
const results = await harness.runGoldenTests(goldenTestCases);
```

## Best Practices

### Library Projects
1. **Use strict semver policy** for public APIs
2. **Include comprehensive type definitions** in surface extraction
3. **Version your API surfaces** for historical comparison
4. **Document breaking changes** with migration guides

### CLI Projects  
1. **Maintain stable command interfaces** across versions
2. **Use golden tests** for critical output formats
3. **Normalize dynamic content** (timestamps, paths) in tests
4. **Test interactive workflows** with session tests
5. **Document exit codes** and error conditions

### Job Projects
1. **Define clear resource requirements** upfront
2. **Validate I/O schemas** strictly
3. **Handle timeout scenarios** gracefully
4. **Test resource limit behavior** under constraints

### Configuration Management
1. **Start with scan output** as a baseline
2. **Incrementally add profile-specific config** as needed
3. **Use CUE validation** to catch configuration errors
4. **Version your assembly files** alongside code

## Migration Guide

### From Service-Only to Profile-Aware

1. **Run scan to detect your artifact type:**
   ```bash
   bun run scan --output-assembly
   ```

2. **Review the generated assembly file** and customize profiles

3. **Add profile-specific tests** (golden tests for CLIs, API surface tests for libraries)

4. **Update your CI/CD** to use the new testing approach

5. **Gradually migrate existing tests** to the profile system

### Example Migration

Before (service-focused):
```json
{
  "spec": {
    "tests": {
      "cli": [
        {"cmd": "myapp --version", "expectExit": 0}
      ]
    }
  }
}
```

After (profile-aware):
```json
{
  "spec": {
    "artifact": {
      "kind": "cli",
      "language": "go",
      "build": {"tool": "go", "targets": ["./cmd/myapp"]}
    },
    "profiles": {
      "cli": {
        "tests": {
          "golden": [
            {
              "name": "Version Command",
              "cmd": "--version",
              "wantCode": 0,
              "normalize": {"timestamps": ["buildTime"]}
            }
          ]
        }
      }
    }
  }
}
```

## Troubleshooting

### Common Issues

**Profile Not Detected:**
- Check that artifact.kind is set correctly in assembly
- Verify profile adapter is registered (run with --verbose)
- Ensure required files exist for detection

**Golden Tests Failing:**
- Check that CLI binary exists and is executable
- Verify golden file normalization rules
- Use --update-golden flag to refresh baselines

**API Surface Extraction Failing:**
- Ensure TypeScript project builds successfully
- Check that entry points exist and are accessible
- Verify d.ts files are generated for TypeScript

**Breaking Changes False Positives:**
- Review semver policy strictness
- Check if changes are truly breaking
- Update API surface baselines if needed

### Debug Commands

```bash
# Verbose execution with debug info
bun run execute epic.json --verbose

# Force profile adapter initialization
bun run scan --detect-profiles --verbose

# Test specific adapter
bun run test packages/agent/src/adapters/library-adapter.test.ts
```

## API Reference

See the TypeScript interfaces in:
- `packages/agent/src/adapters/index.ts` - Core adapter interfaces
- `packages/agent/src/testing/cli-harness.ts` - CLI testing framework
- `packages/agent/src/extractors/index.ts` - Surface extraction
- `packages/agent/src/semver/breaking-changes.ts` - Semver analysis