# Arbiter CLI

A powerful command-line interface for CUE validation, project management, and configuration export. Built with TypeScript and designed for developers who work with CUE configurations.

## Features

- 🚀 **Fast Validation**: Sub-second validation for typical CUE files
- 🎨 **Pretty Output**: Colored tables and progress indicators
- 📊 **Multiple Formats**: Export to JSON, YAML, OpenAPI, TypeScript types, and Kubernetes manifests
- 🏗️ **Project Templates**: Quick project initialization with best practices
- ⚡ **Performance Focused**: Optimized for P95 < 1s on 10KB documents
- 🛠️ **Developer Friendly**: Comprehensive error messages with friendly translations

## Quick Start

```bash
# Install dependencies
bun install

# Build the CLI
bun run build

# Link for global usage
bun link

# Or run directly
bun run src/cli.ts --help
```

## Usage

### Initialize a New Project

```bash
# Interactive initialization
arbiter init

# With template and options
arbiter init my-api --template api --directory ./projects/my-api

# List available templates
arbiter init --list-templates
```

### Validate CUE Files

```bash
# Check all CUE files in current directory
arbiter check

# Check specific patterns
arbiter check "config/*.cue" "schemas/*.cue"

# JSON output
arbiter check --format json

# Verbose output with detailed errors
arbiter check --verbose

# Fail fast on first error
arbiter check --fail-fast
```

### Explicit Validation

```bash
# Validate with schema
arbiter validate values.cue --schema schema.cue

# Strict mode (warnings as errors)
arbiter validate *.cue --strict

# With configuration file
arbiter validate app.cue --config prod.cue --schema base.cue
```

### Export Configurations

```bash
# Export to multiple formats
arbiter export *.cue --format openapi,types,k8s

# Export to specific file
arbiter export config/ --format json --output config.json

# Export with schema and minification
arbiter export values.cue --schema schema.cue --format json --minify

# List available formats
arbiter export dummy --list-formats
```

### Health Monitoring

```bash
# Check server health
arbiter health

# Show current configuration
arbiter config show
```

## Configuration

Arbiter CLI looks for configuration files in this order:

1. `--config` flag path
2. `.arbiter.json` in current directory
3. `.arbiter.yaml` in current directory
4. Walk up directory tree looking for config files

### Configuration File Example

```json
{
  "apiUrl": "http://localhost:8080",
  "timeout": 5000,
  "format": "table",
  "color": true,
  "projectDir": "."
}
```

## Project Templates

### Basic Template
Simple CUE project with schema and values:
```
my-project/
├── cue.mod/module.cue
├── schema.cue
├── values.cue
├── README.md
├── .gitignore
└── .arbiter.json
```

### Kubernetes Template  
CUE project for Kubernetes configurations:
```
k8s-project/
├── cue.mod/module.cue
├── k8s/base.cue
├── k8s/app.cue
├── README.md
└── .arbiter.json
```

### API Template
CUE project for API schema definition:
```
api-project/
├── cue.mod/module.cue
├── api/types.cue
├── api/users.cue
├── openapi.cue
├── README.md
└── .arbiter.json
```

## Export Formats

| Format | Description | Output |
|--------|-------------|---------|
| `json` | Standard JSON format | `.json` |
| `yaml` | YAML format | `.yaml` |
| `openapi` | OpenAPI 3.0 specification | `.openapi.yaml` |
| `types` | TypeScript type definitions | `.ts` |
| `k8s` | Kubernetes YAML manifests | `.k8s.yaml` |

## Performance

The CLI is optimized for developer productivity:

- **P95 target**: < 1 second for validating 10KB documents
- **Concurrent validation**: Up to 5 files validated simultaneously
- **Streaming output**: Real-time progress for large operations
- **Smart caching**: Efficient API client with timeout handling

### Performance Monitoring

```bash
# The CLI tracks performance metrics internally
# Check validation times in verbose mode
arbiter check --verbose

# Use the health command to verify server performance
arbiter health
```

## Error Handling

The CLI provides friendly error messages with context:

```bash
# Before (raw CUE error):
# field not allowed: spec.replicas

# After (friendly translation):
# ✗ Validation Error [kubernetes]: The field 'spec.replicas' is not allowed in this context
#   → Check your schema definition for allowed fields
#   → Line 15, Column 3 in deployment.cue
```

## Exit Codes

- `0`: Success
- `1`: Validation errors or command-specific failures  
- `2`: System errors (network, file system, etc.)

## Development

```bash
# Install dependencies
bun install

# Development mode with watch
bun run dev

# Run tests
bun test

# Run golden tests
bun test:golden

# Update golden test files
UPDATE_GOLDEN=1 bun test:golden

# Build for production
bun run build

# Type checking
bun run typecheck
```

## API Integration

The CLI wraps the Arbiter HTTP API with the following endpoints:

- `POST /api/validate` - CUE validation
- `POST /api/ir` - Intermediate representation  
- `GET /health` - Server health check

Configuration is handled through the API client with:
- Request timeouts (configurable)
- Error retry logic
- Performance tracking
- Friendly error translation

## Examples

### CI/CD Integration

```yaml
# GitHub Actions example
- name: Validate CUE configurations
  run: |
    arbiter check --format json > validation-results.json
    arbiter health
```

### Development Workflow

```bash
# 1. Initialize project
arbiter init my-config --template kubernetes

# 2. Develop and validate
cd my-config
arbiter check --watch  # Continuous validation

# 3. Export for deployment
arbiter export . --format k8s --output manifests/
```

### Integration Testing

```bash
# Validate against production schema
arbiter validate staging.cue --schema prod-schema.cue --strict

# Export and verify
arbiter export *.cue --format openapi > api.yaml
arbiter validate api.yaml
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## License

MIT License - see [LICENSE](../../LICENSE) file.