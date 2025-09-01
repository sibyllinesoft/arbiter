# Epic v2 Guide: Agent-First Code Generation

**Transform your development workflow with executable contracts that agents can use for autonomous, deterministic code generation.**

## Table of Contents

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Epic Schema](#epic-schema)
- [Template System](#template-system)
- [Testing Framework](#testing-framework)
- [CI/CD Integration](#cicd-integration)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

Epic v2 transforms the concept of "epics" from simple task descriptions into **executable contracts** that agents can use to autonomously generate code, run tests, and validate results. This system enables:

- **Deterministic Code Generation**: Same epic always produces same output
- **Agent Autonomy**: AI agents can execute epics without human intervention
- **Built-in Quality Gates**: Tests and contracts ensure code quality
- **Idempotent Operations**: Re-running an epic produces no changes if already applied
- **Full Traceability**: Every change is documented and validated

## Getting Started

### Prerequisites

1. **Arbiter CLI**: Install and configure the Arbiter CLI tool
2. **API Server**: Running Arbiter API server for CUE evaluation
3. **Templates**: Template files for code generation
4. **Test Infrastructure**: Test data and golden files

### Basic Workflow

1. **Create Epic**: Define what you want to build in an epic file
2. **Dry Run**: See what changes would be made without applying them
3. **Execute**: Apply the changes and run tests
4. **Validate**: Ensure all contracts and gates pass

```bash
# Create an epic
arbiter execute epics/my-feature.json --dry-run

# Apply the changes
arbiter execute epics/my-feature.json

# Run tests
arbiter test --epic epics/my-feature.json
```

## Epic Schema

An Epic v2 file defines everything needed for autonomous code generation:

### Core Fields

```json
{
  "id": "EPIC-UNIQUE-ID-001",
  "title": "Human-readable description",
  "owners": ["team-name", "owner@company.com"],
  
  "targets": [
    {
      "root": "path/to/code",
      "include": ["**/*.ts", "**/*.json"],
      "exclude": ["**/node_modules/**"]
    }
  ],
  
  "generate": [
    {
      "path": "relative/path/to/file.ts",
      "mode": "create",
      "template": "path/to/template.t",
      "data": { "key": "value" },
      "guards": ["pattern that must not exist"]
    }
  ]
}
```

### Generation Modes

- **`create`**: Create new files (fails if file exists)
- **`patch`**: Update existing files using ARBITER markers

### Guards System

Guards prevent conflicts and ensure safe operations:

```json
{
  "guards": [
    "class AuthService already exists",
    "ARBITER:BEGIN auth-middleware already exists"
  ]
}
```

### Contracts and Validation

Define what must be true after generation:

```json
{
  "contracts": {
    "types": [
      "services.auth.exports.AuthService != _|_"
    ],
    "invariants": [
      "All API endpoints must be authenticated",
      "JWT tokens must expire within 24 hours"
    ]
  }
}
```

### Test Configuration

Epic v2 includes comprehensive testing:

```json
{
  "tests": {
    "static": [
      { "selector": "services/**/*.ts" }
    ],
    "property": [
      { "name": "Service exports", "cue": "service.exports != _|_" }
    ],
    "golden": [
      { "input": "service.ts", "want": "testdata/service.golden" }
    ],
    "cli": [
      { "cmd": "npm test", "expectExit": 0 }
    ]
  }
}
```

## Template System

### Template Files

Templates use simple `{{.variable}}` substitution:

```typescript
// templates/service/index.ts.t
import express from 'express';

export class {{.serviceName}} {
  private port: number = {{.port}};
  
  {{if .database}}
  private db: {{.database}}Connection;
  {{end}}
  
  start(): void {
    console.log('{{.serviceName}} starting on port', this.port);
  }
}
```

### Inline Templates

For simple content, use inline templates:

```json
{
  "template": "# {{.name}}\\n\\n{{.description}}\\n\\nVersion: {{.version}}",
  "data": {
    "name": "My Service",
    "description": "A great service",
    "version": "1.0.0"
  }
}
```

### Patch Mode with ARBITER Markers

For updating existing files, use ARBITER markers:

```json
{
  "mode": "patch",
  "template": "// ARBITER:BEGIN my-feature\\nexport const feature = true;\\n// ARBITER:END my-feature",
  "guards": ["ARBITER:BEGIN my-feature already exists"]
}
```

## Testing Framework

Epic v2 includes a unified test harness with four test types:

### Static Analysis Tests

Validate that generated code compiles and follows rules:

```json
{
  "static": [
    { "selector": "src/**/*.ts" },
    { "selector": "config/*.cue" }
  ]
}
```

### Property Tests

CUE expressions that must evaluate to true:

```json
{
  "property": [
    {
      "name": "Service has health endpoint",
      "cue": "service.routes.health != _|_"
    },
    {
      "name": "All endpoints are authenticated",
      "cue": "len([for r in service.routes if r.auth == true { r }]) == len(service.routes)"
    }
  ]
}
```

### Golden File Tests

Compare outputs against expected results:

```json
{
  "golden": [
    {
      "input": "generated/api.ts",
      "want": "testdata/expected-api.ts"
    }
  ]
}
```

### CLI Tests

Test commands and scripts:

```json
{
  "cli": [
    {
      "cmd": "npm run build",
      "expectExit": 0
    },
    {
      "cmd": "npm test",
      "expectExit": 0,
      "expectRE": "All tests passed"
    }
  ]
}
```

## CI/CD Integration

Epic v2 includes GitHub Actions workflow for automated execution:

### Pull Request Flow

1. **Dry Run**: Shows planned changes in PR comments
2. **Validation**: Runs all tests and contracts
3. **Scoring**: Provides pass/fail status

### Main Branch Flow

1. **Execution**: Applies changes to codebase
2. **Validation**: Runs full test suite
3. **Commit**: Creates commit with generated changes
4. **Rollback**: Automatic rollback on failure

### Configuration

The workflow automatically detects changed epic files and processes them:

```yaml
# .github/workflows/epic-execution.yml
on:
  pull_request:
    paths: ['epics/**/*.json', 'epics/**/*.yaml']
  push:
    branches: [main]
    paths: ['epics/**/*.json', 'epics/**/*.yaml']
```

## Examples

### New Microservice

Create a complete microservice with scaffolding:

```json
{
  "id": "EPIC-AUTH-SERVICE-001",
  "title": "Create authentication microservice",
  "generate": [
    {
      "path": "services/auth/package.json",
      "mode": "create",
      "template": "templates/service/package.json.t",
      "data": {
        "name": "auth-service",
        "port": 3001,
        "features": ["jwt", "oauth", "2fa"]
      }
    },
    {
      "path": "services/auth/src/index.ts",
      "mode": "create", 
      "template": "templates/service/index.ts.t",
      "data": {
        "serviceName": "AuthService",
        "database": "postgres"
      }
    }
  ],
  "tests": {
    "cli": [
      { "cmd": "cd services/auth && npm test", "expectExit": 0 }
    ]
  }
}
```

### Configuration Migration

Migrate from JSON to CUE configuration:

```json
{
  "id": "EPIC-CONFIG-MIGRATION-001",
  "title": "Migrate configuration to CUE",
  "generate": [
    {
      "path": "config/app.cue",
      "mode": "create",
      "template": "templates/config/app.cue.t",
      "data": {
        "environments": ["dev", "staging", "prod"]
      }
    },
    {
      "path": "src/config.ts",
      "mode": "patch",
      "template": "// ARBITER:BEGIN cue-loader\\nimport { loadCue } from './lib/cue';\\n// ARBITER:END cue-loader"
    }
  ],
  "tests": {
    "static": [{ "selector": "config/*.cue" }],
    "cli": [{ "cmd": "cue vet config/", "expectExit": 0 }]
  }
}
```

### Breaking Change with Migration

Handle breaking changes safely:

```json
{
  "id": "EPIC-API-V2-MIGRATION-001", 
  "title": "Migrate API from v1 to v2",
  "generate": [
    {
      "path": "api/v2/users.ts",
      "mode": "create",
      "template": "templates/api/v2-endpoint.ts.t",
      "data": {
        "entity": "User",
        "breaking_changes": {
          "userId": "id",
          "userName": "username"
        }
      }
    },
    {
      "path": "api/v1/users.ts",
      "mode": "patch", 
      "template": "// ARBITER:BEGIN deprecation\\n/** @deprecated Use /api/v2/users */\\n// ARBITER:END deprecation"
    }
  ],
  "rollout": {
    "gates": [
      { "name": "v1 still functional", "cue": "api.v1.functional == true" },
      { "name": "v2 feature complete", "cue": "api.v2.complete == true" }
    ]
  }
}
```

## Best Practices

### Epic Design

1. **Single Responsibility**: Each epic should focus on one feature or change
2. **Idempotent**: Running the same epic multiple times should be safe
3. **Testable**: Include comprehensive tests for validation
4. **Documented**: Clear title and owners

### Template Design

1. **Simple Logic**: Keep template logic minimal
2. **Reusable**: Design templates for multiple use cases
3. **Well-Typed**: Provide clear data contracts
4. **Documented**: Include usage examples

### Testing Strategy

1. **Comprehensive**: Cover static, property, golden, and CLI tests
2. **Fast**: Keep tests quick for rapid feedback
3. **Stable**: Avoid flaky tests that break CI
4. **Meaningful**: Test behavior, not implementation

### CI Integration

1. **Fail Fast**: Validate epics before execution
2. **Clear Feedback**: Provide detailed PR comments
3. **Rollback Ready**: Ensure safe rollback on failures
4. **Monitoring**: Track execution success rates

## Troubleshooting

### Common Issues

#### Epic Validation Fails
```bash
# Check epic schema
arbiter validate epics/my-epic.json --schema epics/EpicV2.cue
```

#### Guard Violations
```bash
# Check what guards are failing
arbiter execute epics/my-epic.json --dry-run --verbose
```

#### Template Errors
```bash
# Test template rendering
arbiter execute epics/my-epic.json --dry-run
```

#### Test Failures
```bash
# Run specific test types
arbiter test --epic epics/my-epic.json --types static,property
```

### Debug Mode

Enable verbose logging for detailed execution information:

```bash
# Verbose dry-run
arbiter execute epics/my-epic.json --dry-run --verbose

# Verbose testing  
arbiter test --epic epics/my-epic.json --verbose
```

### Golden File Updates

When golden files need updating after legitimate changes:

```bash
# Update golden files
arbiter test --epic epics/my-epic.json --update-golden
```

## Advanced Features

### Conditional Generation

Use guards and data to conditionally generate code:

```json
{
  "generate": [
    {
      "path": "optional-feature.ts",
      "mode": "create",
      "template": "{{if .enableFeature}}export const feature = true;{{end}}",
      "data": { "enableFeature": true },
      "guards": ["feature already exists"]
    }
  ]
}
```

### Multi-Target Generation

Generate code across multiple directories:

```json
{
  "targets": [
    {
      "root": "frontend/src",
      "include": ["**/*.tsx", "**/*.ts"]
    },
    {
      "root": "backend/src", 
      "include": ["**/*.ts"]
    }
  ]
}
```

### Complex Rollout Gates

Define sophisticated validation criteria:

```json
{
  "rollout": {
    "gates": [
      {
        "name": "Performance within SLA",
        "cue": "metrics.p95_latency < 200"
      },
      {
        "name": "Error rate acceptable", 
        "cue": "metrics.error_rate < 0.01"
      },
      {
        "name": "All dependencies updated",
        "cue": "len([for d in dependencies if d.version == \"latest\" { d }]) == len(dependencies)"
      }
    ]
  }
}
```

---

**Ready to transform your development workflow?** Start with a simple epic and gradually build more sophisticated automated generation pipelines. The Epic v2 system grows with your needs, from simple file creation to complex multi-service architectures.

For more examples and advanced patterns, see the `epics/examples/` directory.