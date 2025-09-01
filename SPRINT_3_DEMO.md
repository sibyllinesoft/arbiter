# Sprint 3: SDK + CI Integration - "GitHub for Architecture"

This demo showcases Arbiter's transformation into a complete "GitHub for Architecture" platform with SDK integration and CI/CD workflow automation.

## 🚀 What's New in Sprint 3

### 1. TypeScript SDK (`@arbiter/sdk`)
- **Client Library**: Full-featured TypeScript client with retry/backoff logic
- **Three Core Methods**: `validateArchitecture()`, `explain()`, `export()`
- **Real-time Support**: WebSocket integration for live validation updates
- **Error Handling**: Comprehensive error types with retry strategies
- **Protocol Versioning**: Built-in compatibility checking (Protocol v1.0)

### 2. GitHub Actions Integration
- **`arbiter-validate` Action**: Validates architecture on PRs with annotations
- **PR Comments**: Friendly error explanations and suggestions
- **Export Artifacts**: Auto-generates OpenAPI, TypeScript, Kubernetes manifests
- **Multi-Environment**: Matrix validation for dev/staging/prod configs
- **Failure Control**: `--fail-on=error/warning/info` for different environments

### 3. CI/CD Workflow Examples
- **Pull Request Gates**: Block merges on architecture violations
- **Export Generation**: Automatically create deployment artifacts
- **Multi-Environment Validation**: Test configs against different environments
- **Artifact Upload**: Generated exports available for download

## 🛠️ SDK Usage Examples

### Basic Validation

```typescript
import { ArbiterClient } from '@arbiter/sdk';

const client = new ArbiterClient({
  baseUrl: 'http://localhost:3000',
  timeout: 30000,
  debug: true,
});

// Validate architecture
const result = await client.validateArchitecture({
  schema: schemaContent,
  config: configContent,
});

if (!result.valid) {
  // Get friendly explanations
  const explanations = await client.explain(result.errors);
  explanations.forEach(exp => {
    console.log(`❌ ${exp.explanation}`);
    console.log(`💡 Suggestions: ${exp.suggestions.join(', ')}`);
  });
}
```

### Export to Multiple Formats

```typescript
// Export to OpenAPI
const openapi = await client.export(validConfig, {
  format: 'openapi',
  includeExamples: true,
});

// Export to TypeScript
const typescript = await client.export(validConfig, {
  format: 'typescript',
});

// Export to Kubernetes
const k8s = await client.export(validConfig, {
  format: 'kubernetes',
  config: { namespace: 'production' }
});
```

### Real-time Validation

```typescript
await client.connectWebSocket({
  reconnect: { enabled: true, maxAttempts: 5 }
}, {
  onValidationResult: (result) => {
    console.log('Real-time result:', result);
  },
  onConnectionChange: (connected) => {
    console.log('Connection:', connected);
  }
});
```

## 🔄 GitHub Actions Workflow

### Pull Request Validation

```yaml
name: Architecture Validation
on:
  pull_request:
    paths: ['**/*.cue']

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Validate Architecture
        uses: ./.github/actions/arbiter-validate
        with:
          schema-path: 'schema/api-schema.cue'
          config-path: 'config/api-config.cue'
          fail-on: 'error'
          export-formats: 'openapi,typescript,kubernetes'
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### What the Action Does

1. **Validates Configuration**: Checks config against schema using Arbiter server
2. **Creates Annotations**: Adds inline comments to PR with violation details
3. **Posts PR Comment**: Summary of violations with explanations and suggestions
4. **Generates Exports**: Creates OpenAPI spec, TypeScript types, K8s manifests
5. **Uploads Artifacts**: Makes generated files available for download
6. **Fails Build**: Blocks PR merge if violations exceed `fail-on` threshold

## 📁 Example Files Structure

```
examples/
├── api-schema.cue       # Comprehensive API specification schema
├── api-config.cue       # User Management API implementation
├── basic-usage.ts       # SDK usage demonstration
└── README.md           # Usage instructions

.github/
├── actions/
│   └── arbiter-validate/    # Custom GitHub Action
│       ├── action.yml       # Action definition
│       ├── src/index.ts     # Action implementation
│       └── package.json     # Dependencies
└── workflows/
    └── validate-architecture.yml  # Example workflow

packages/
└── sdk/                     # TypeScript SDK
    ├── src/
    │   ├── client.ts        # Main client class
    │   ├── types.ts         # Type definitions
    │   ├── errors.ts        # Error classes
    │   └── retry.ts         # Retry logic
    ├── examples/
    │   └── basic-usage.ts   # SDK examples
    └── README.md           # SDK documentation
```

## 🧪 Demo Scenarios

### Scenario 1: Valid Architecture ✅

```bash
# All validation passes
npm run sdk:demo  # Runs basic-usage.ts example
# Output: ✅ Architecture is valid!
# Exports: Generated OpenAPI, TypeScript, K8s manifests
```

### Scenario 2: Architecture Violations ❌

```cue
// Introduce a violation in api-config.cue
userAPI: #APISpec & {
  baseURL: "invalid-url"  // Missing protocol - will fail validation
}
```

**Result**:
- SDK catches violation and explains the issue
- GitHub Action blocks PR with detailed annotations
- PR comment shows friendly error explanation and suggestions
- No exports generated until violations are fixed

### Scenario 3: Multi-Environment Validation 🌍

The workflow validates configurations for multiple environments:

```yaml
strategy:
  matrix:
    environment: [development, staging, production]
```

Each environment gets:
- Separate validation results
- Environment-specific export artifacts
- Individual pass/fail status
- Tailored rate limits and security settings

## 🔧 Running the Demo

### Prerequisites

```bash
# Install dependencies
bun install

# Start Arbiter server
bun run dev  # Starts server on http://localhost:3000
```

### SDK Demo

```bash
# Run comprehensive SDK example
cd packages/sdk
bun run examples/basic-usage.ts

# Expected output:
# 🏗️ Arbiter SDK Example: Basic Usage
# 1. Checking server compatibility...
#    SDK: 0.1.0, Server: 1.0.0
#    Compatible: ✅
# 2. Validating architecture with errors...
#    Valid: ❌
#    Violations: 1 errors, 0 warnings
# 3. Explaining validation errors...
#    Error 1: baseURL must match pattern "^https?://"
# 4. Validating corrected architecture...
#    Valid: ✅
# 5. Exporting architecture...
#    ✅ OpenAPI export successful
#    ✅ TypeScript export successful
```

### GitHub Action Demo

```bash
# Simulate GitHub Action locally (requires act or similar)
act pull_request -W .github/workflows/validate-architecture.yml

# Or create actual PR to see it in action:
git checkout -b test-violations
# Edit examples/api-config.cue to introduce violations
git commit -am "test: introduce architecture violations"  
git push origin test-violations
# Create PR - will trigger validation workflow
```

## 📊 Success Criteria - All Achieved! ✅

### ✅ SDK Example Compiles and Runs
- [x] TypeScript SDK builds without errors
- [x] Basic usage example demonstrates all features
- [x] Retry/backoff logic handles network failures
- [x] WebSocket real-time updates work correctly

### ✅ Sample Repo Uses Action and Fails PR
- [x] GitHub Action correctly validates architecture files
- [x] Creates inline annotations on PR files
- [x] Posts helpful PR comments with explanations
- [x] Blocks PR merge when violations found
- [x] Generates and uploads export artifacts

### ✅ Compatibility Matrix Documented  
- [x] Protocol v1.0 compatibility checking
- [x] SDK version 0.1.0 supports all server versions 1.0+
- [x] Automatic compatibility verification on connection
- [x] Clear error messages for version mismatches

### ✅ Ready for Team Integration
- [x] Comprehensive documentation and examples
- [x] Easy-to-copy GitHub Action workflow
- [x] Multiple export formats (OpenAPI, TypeScript, Kubernetes)
- [x] Configurable failure thresholds (`error`/`warning`/`info`)
- [x] Multi-environment validation support

## 🌟 Integration Benefits

Teams can now:

1. **Validate on Every PR**: Catch architecture violations before merge
2. **Generate Artifacts**: Auto-create OpenAPI specs, types, manifests
3. **Real-time Feedback**: Get instant validation in their development workflow
4. **Enforce Standards**: Block deployments that violate architectural rules
5. **Multi-Environment**: Test configs against dev/staging/prod environments
6. **Export Integration**: Use generated artifacts in deployment pipelines

## 🚀 Next Steps

With Sprint 3 complete, Arbiter is now a full "GitHub for Architecture" platform. Teams can integrate it into their workflow and start enforcing architectural standards across their organization.

Future enhancements could include:
- Performance prediction based on architectural decisions
- Runtime drift detection comparing live systems to architecture
- Agent marketplace with curated constraint packages
- Visual architecture editor with real-time validation
- Integration with more CI/CD platforms (GitLab, Azure DevOps, etc.)

---

**Arbiter**: From standalone tool to comprehensive architecture platform! 🎯