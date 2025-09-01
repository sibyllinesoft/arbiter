# Arbiter Schema Documentation

**Generated:** 2025-09-01T11:58:14.382Z  
**API Version:** arbiter.dev/v2

## Overview

This documentation describes the CUE schemas and data structures used by the Arbiter framework.

## Core Schemas

### Artifact Schema

The Artifact schema defines the structure of buildable and deployable artifacts.

```cue
Artifact: {
    kind: string        // artifact type: "library" | "service" | "cli" | "policy_bundle"
    name?: string       // optional artifact name
    language: string    // primary language: "typescript" | "go" | "rust" | "python" | "cue"
    
    build: {
        tool: string           // build tool: "bun" | "go" | "cargo" | "cue"
        targets: [...string]   // build targets/patterns
        outputs?: [...string]  // optional output specifications
    }
    
    packaging?: {
        publish: bool
        registry: string
        artifact: string
    }
}
```

### Profile Schema

Profiles define validation rules, quality gates, and operational characteristics.

```cue
Profile: {
    semver?: string              // version strategy: "strict" | "loose"
    determinism?: bool           // require deterministic outputs
    
    apiSurface?: {
        source: string          // "generated" | "manual"
        file: string           // path to surface definition
    }
    
    contracts?: {
        forbidBreaking: bool
        invariants: [...{
            name: string
            description: string
            rule: string
        }]
    }
    
    gates?: {
        quality?: {
            testCoverage?: number
            lintPassing?: bool
            typeCheck?: bool
        }
        performance?: {
            responseTime?: string
            payloadSize?: string
        }
    }
}
```

## Quality Gates

Quality gates are automated checks that must pass for validation to succeed.

| Gate Type | Description | Example Rule |
|-----------|-------------|--------------|
| Quality | Code quality metrics | Test coverage > 90% |
| Performance | Runtime performance | Response time < 750ms |
| Security | Security compliance | No hardcoded secrets |
| Compatibility | API compatibility | No breaking changes |

## Validation Rules

### Determinism
All operations must produce identical outputs given identical inputs.

### Performance Constraints
- Request payload ≤ 64KB
- Response time ≤ 750ms
- Rate limit ~1 rps/client

### API Stability
Public APIs must maintain backward compatibility unless major version is incremented.

## Schema Evolution

Schemas follow semantic versioning:
- **PATCH**: Bug fixes, clarifications
- **MINOR**: New optional fields, backward-compatible additions
- **MAJOR**: Breaking changes, required field changes

---

*This documentation is automatically generated from CUE schema definitions.*
