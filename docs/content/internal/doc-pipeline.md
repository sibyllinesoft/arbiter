---
title: Legacy Documentation Pipeline
sidebar_label: Legacy Pipeline
description: Unified generator + monitoring stack that previously owned Arbiter documentation output.
---

> **Status:** legacy. The MkDocs site configured via `mkdocs.yml` now owns everything published to GitHub Pages. Keep these notes only if you still need the orchestration scripts referenced below.

This document captures the comprehensive automated documentation generation pipeline that historically ran for the Arbiter project. The pipeline coordinates multiple documentation types, validates quality, monitors health, and deploys to production.

## 🚀 Quick Start

```bash
# Generate all documentation
bun run docs:all

# Watch mode for development
bun run docs:generate:watch

# Check documentation health
bun run docs:monitor:health

# Run tests
bun run docs:test:smoke
```

## 📋 Overview

The documentation pipeline consists of:

1. **Unified Orchestration System** - Coordinates all documentation generation
2. **Multiple Documentation Generators** - CLI, API, CUE schemas, code generation, and project docs
3. **Quality Validation** - Automated checks for freshness, links, and quality
4. **Monitoring & Maintenance** - Health monitoring with alerting and auto-fix
5. **CI/CD Integration** - GitHub Actions workflow for automated deployment
6. **Comprehensive Testing** - Full test suite with benchmarking

## 🛠️ Architecture

```
scripts/
├── docs-orchestrator.ts          # Main orchestration system
├── docs-monitor.ts               # Monitoring and maintenance
├── test-docs-pipeline.ts         # Testing and validation
└── docs-generators/
    ├── cue-schema-docs.ts        # CUE schema documentation
    ├── api-docs.ts               # API documentation from OpenAPI/routes
    ├── codegen-docs.ts           # Code generation system docs
    └── project-docs.ts           # Project overview and architecture

docs/                             # Generated documentation output
├── cli-reference.*               # CLI documentation
├── api-reference.*               # API documentation
├── cue-schemas.*                 # CUE schema documentation
├── code-generation.*             # Code generation documentation
├── project-overview.*            # Project documentation
├── *-index.json                  # Search indices
├── *-metrics.json                # Quality metrics
└── health-report.json            # Health monitoring data
```

## 🔧 Available Commands

### Core Generation
- `bun run docs:generate` - Main orchestration system
- `bun run docs:generate:watch` - Watch mode
- `bun run docs:generate:init` - Initialize configuration
- `bun run docs:all` - Generate all documentation types in parallel

### Individual Generators
- `bun run docs:cli` - CLI documentation
- `bun run docs:cue` - CUE schema documentation
- `bun run docs:api` - API documentation
- `bun run docs:codegen` - Code generation documentation
- `bun run docs:project` - Project documentation

### Validation & Quality
- `bun run docs:validate` - Validate documentation quality
- `bun run docs:config:validate` - Validate configuration
- `bun run docs:generate:status` - Check pipeline status

### Monitoring & Maintenance
- `bun run docs:monitor` - Full monitoring suite
- `bun run docs:monitor:health` - Quick health check
- `bun run docs:monitor:fix` - Auto-fix common issues

### Testing & Benchmarking
- `bun run docs:test` - Full test suite
- `bun run docs:test:smoke` - Quick smoke tests
- `bun run docs:test:integration` - Integration tests
- `bun run docs:test:generators` - Test individual generators
- `bun run docs:benchmark` - Performance benchmarks

### Deployment
- `bun run docs:deploy` - Deploy to production

## ⚙️ Configuration

The pipeline is configured via `docs-config.yaml`:

```yaml
version: '1.0.0'
enabled: true

pipeline:
  cli:
    enabled: true
    command: 'bun'
    args: ['run', 'docs:cli']
    timeout: 60000
    parallel: true
    priority: 1
  # ... other generators

outputs:
  baseDir: './docs'
  formats: ['markdown', 'html', 'json']

validation:
  enabled: true
  failOnError: false
  coverage:
    minimum: 80
    target: 95

monitoring:
  enabled: true
  freshness:
    maxAgeHours: 24
    alertThreshold: 72
```

See the full configuration schema in `docs-config.yaml`.

## 🧪 Testing

The pipeline includes comprehensive testing:

### Test Types
- **Generator Tests** - Test individual documentation generators
- **Orchestration Tests** - Test the main orchestration system  
- **Monitoring Tests** - Test health monitoring and alerting
- **Validation Tests** - Test quality validation systems
- **Integration Tests** - End-to-end pipeline testing
- **Smoke Tests** - Quick validation of core functionality
- **Load Tests** - Concurrent and performance testing

### Running Tests

```bash
# Full test suite
bun run docs:test

# Specific test types
bun run docs:test:generators
bun run docs:test:integration
bun run docs:test:smoke

# Performance testing
bun run docs:benchmark --iterations=10
```

### Test Output

Tests generate:
- `test-output/test-report.json` - Detailed test results
- `test-output/test-results.xml` - JUnit XML for CI systems
- `test-output/benchmark-results.json` - Performance metrics

## 📊 Monitoring

The monitoring system tracks:

### Health Metrics
- **Freshness** - Age of documentation files
- **Quality** - Coverage, completeness, structure
- **Links** - Broken internal/external links
- **Performance** - Generation times and resource usage

### Alerts
Configure alerts via `docs-config.yaml`:

```yaml
monitoring:
  alerts:
    enabled: true
    thresholds:
      freshnessHours: 48
      qualityScore: 70
      brokenLinksPercent: 5
    channels:
      slack:
        enabled: true
        webhook: $SLACK_WEBHOOK_URL
```

### Auto-Fix
Common issues are automatically fixable:
- Missing index files
- Broken internal links
- Outdated timestamps
- Missing descriptions

## 🚀 CI/CD Integration

GitHub Actions workflow (`.github/workflows/docs-pipeline.yml`) provides:

### Triggers
- Code changes in packages/apps
- Documentation changes
- Scheduled health checks (daily)
- Manual workflow dispatch

### Environments
- **Development** - Feature branches
- **Staging** - Develop branch 
- **Production** - Main branch

### Pipeline Steps
1. **Detect Changes** - Smart change detection
2. **Build** - Compile project and dependencies
3. **Generate** - Parallel documentation generation
4. **Validate** - Quality checks and validation
5. **Monitor** - Health monitoring and alerting
6. **Deploy** - Environment-specific deployment
7. **Notify** - Success/failure notifications

## 📈 Quality Metrics

The pipeline tracks comprehensive quality metrics:

### Coverage Metrics
- Documentation completeness percentage
- API documentation coverage
- Code comment coverage
- Example availability

### Link Health
- Total links found
- Broken link count and percentage
- Internal vs external link ratio
- Link validation frequency

### Freshness Tracking
- File modification timestamps
- Stale file identification
- Update frequency patterns
- Automated refresh scheduling

### Performance Metrics
- Generation time per documentation type
- Total pipeline execution time
- Resource usage (memory, CPU)
- Concurrent processing efficiency

## 🔍 Troubleshooting

### Common Issues

**Generation Fails**
```bash
# Check specific generator
bun run docs:test:generators --verbose

# Check configuration
bun run docs:config:validate

# Check dependencies
bun run build:all
```

**Stale Documentation**
```bash
# Check freshness
bun run docs:monitor:health

# Force regeneration
bun run docs:generate --force-regenerate

# Auto-fix issues
bun run docs:monitor:fix
```

**Quality Issues**
```bash
# Full quality check
bun run docs:validate

# Check specific issues
bun run docs:monitor --check-quality --check-links

# View detailed report
cat docs/health-report.json | jq
```

### Debug Mode

Enable verbose logging:
```bash
# Any command with verbose output
bun run docs:generate --verbose
bun run docs:monitor --verbose
bun run docs:test --verbose
```

### Performance Issues

```bash
# Run performance benchmarks
bun run docs:benchmark

# Check parallel vs sequential
bun run docs:generate --parallel
bun run docs:generate # (sequential)

# Profile individual generators
time bun run docs:cli
time bun run docs:api
```

## 🤝 Contributing

### Adding New Documentation Types

1. Create generator in `scripts/docs-generators/`
2. Add configuration to `docs-config.yaml`
3. Add npm script to `package.json`
4. Add tests in `scripts/test-docs-pipeline.ts`
5. Update GitHub Actions workflow

### Improving Existing Generators

1. Maintain backward compatibility
2. Add comprehensive tests
3. Update configuration schema
4. Document changes in health metrics

### Testing Changes

```bash
# Test your changes
bun run docs:test

# Test in isolation
bun run docs:test:generators --verbose

# Benchmark performance impact
bun run docs:benchmark --baseline
# Make changes
bun run docs:benchmark
```

## 📚 Documentation Standards

Generated documentation follows these standards:

### Formats
- **Markdown** - Primary format for human consumption
- **HTML** - Web-ready with search and navigation
- **JSON** - Structured data for tooling integration

### Structure
- Clear hierarchical organization
- Comprehensive table of contents
- Cross-linking between sections
- Example code and usage patterns

### Quality Requirements
- 90%+ documentation coverage
- No broken internal links
- Proper metadata and descriptions
- Regular freshness validation

### Accessibility
- WCAG 2.1 AA compliance for HTML output
- Semantic markup and structure
- Alternative text for images
- Keyboard navigation support

## 🔗 Related Documentation

- [CLI Reference](../reference/cli-reference.md) - Command-line interface documentation
- [API Reference](../reference/api/generation-api-reference.md) - REST API documentation  
- [CUE Schemas](../reference/arbiter-cue-schema.md) - CUE type definitions and constraints
- [Code Generation](../overview/code-generation-overview.md) - Code generation system
- [Project Overview](../index.md) - Project architecture and overview

---

**Generated by**: Arbiter Documentation Pipeline  
**Last Updated**: Generated dynamically  
**Pipeline Version**: 1.0.0
