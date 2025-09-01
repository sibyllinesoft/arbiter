# Valhalla Agent Benchmarking Framework

A comprehensive SWE agent architecture for reactive DAG execution of software development tasks (requirements → design → implementation → review → merge → docs) in GitLab MRs.

## Architecture Overview

Valhalla implements a parallel, reactive DAG of subagents that maximizes accuracy and robustness on SWE-bench–like tasks while presenting itself externally as a disciplined engineering workflow.

### Core Components

- **Arbiter (Spec Service)**: Emits and validates CUE contracts, enforces schema compliance, and acts as the coordination layer
- **Mimir (Codebase Insight)**: Produces high-level briefs with dependency graphs, hotspots, and failure modes
- **Conclave (Debate Engine)**: Invoked at decision sites to enable structured debate and consensus-building
- **Specialized Subagents**: Tests, Coding, Review, Repair, Merge, and Documentation agents

### Process Flow

1. **Spec**: Arbiter + clients generate validated specifications with acceptance criteria
2. **Brief**: Mimir analyzes codebase and writes insights
3. **Plan**: Optional Conclave debate for strategic approaches
4. **Tests**: Ensure failing oracle exists and expand coverage
5. **Implementation**: Generate multiple candidate patches
6. **Review**: Run tests, cluster duplicates, and select optimal patch
7. **Repair**: Guided edit search within constraints if needed
8. **Merge**: Open GitLab MR with review apps and policy compliance
9. **Docs**: Generate human-readable rationale and coverage reports

## Schema Structure

The system is built around a comprehensive CUE schema defining:

- **Meta**: System versioning, execution context, and tracing
- **Brief**: Codebase insights from Mimir analysis
- **Spec**: Acceptance criteria, failing tests, and constraints
- **Policy**: Budget allocation, stopping rules, and risk limits
- **Rubric**: Success metrics and quality gates
- **Plan**: Optional strategic planning from Conclave
- **Implementation**: Candidate generation and selection
- **ExecutionState**: Phase tracking and telemetry

## Key Features

### Governance & Budgets
- Budget allocation across stages with enforcement
- Stopping rules and circuit breakers
- Edit primitives with safety constraints
- Risk limits and quality gates

### Validation & Benchmarking
- Dedicated experiments per stage
- DSPy tuning for prompt optimization
- Factorial testing of Conclave configurations
- Comprehensive metrics: Pass@1/K, cost, latency, flake rates

### Observable Architecture
- Complete telemetry with trace correlation
- Phase-specific metrics and quality gates
- Budget tracking and circuit breaker status
- Structured logging with correlation IDs

## Files Structure

```
valhalla/
├── spec.cue              # Complete CUE schema definition
├── example.cue           # Example pipeline instance
├── types.ts              # TypeScript type definitions
├── openapi.cue          # OpenAPI specification
├── k8s/                 # Kubernetes manifests
│   ├── valhalla-namespace.yaml
│   ├── valhalla-configmap.yaml
│   ├── valhalla-deployment.yaml
│   ├── valhalla-service.yaml
│   └── valhalla-rbac.yaml
└── README.md            # This file
```

## Usage

### Validating the Schema

```bash
cd valhalla
cue vet spec.cue
```

### Generating Exports

```bash
# Export example to JSON
cue export example.cue

# Validate against schema
cue vet spec.cue example.cue
```

### Kubernetes Deployment

```bash
# Apply all manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n valhalla
kubectl get services -n valhalla
```

## Architecture Principles

1. **Constraint-Driven Design**: All behavior governed by CUE schema constraints
2. **Reactive DAG**: Phases execute based on data availability and constraints
3. **Fail-Safe Defaults**: Conservative budgets and risk limits by default
4. **Observable by Design**: Comprehensive metrics and tracing built-in
5. **Policy Enforcement**: Arbiter validates all operations against policy

## Quality Assurance

- **Budget Coherence**: Phase budgets must sum within total allocation
- **Phase Ordering**: Execution follows strict dependency graph
- **Constraint Validation**: All edits respect safety and risk limits
- **Quality Gates**: Critical gates must pass before progression

## Security Features

- **Zero Trust**: All requests validated regardless of source
- **Least Privilege**: Minimal required permissions per component
- **Secure by Default**: Conservative risk thresholds and approval requirements
- **Audit Trail**: Complete traceability of all decisions and changes

## Integration

The framework is designed to integrate with:
- **GitLab**: MR creation, review apps, and CI/CD pipelines
- **Testing Frameworks**: pytest, Jest, etc. for oracle validation
- **Code Analysis Tools**: Static analysis, security scanning, performance profiling
- **Monitoring**: Prometheus metrics, OpenTelemetry tracing
- **AI Providers**: OpenAI, Anthropic, Google for agent capabilities

## Contributing

This framework follows Arbiter's constraint-driven development principles. All modifications must:

1. Update CUE schema with proper constraints
2. Validate against existing examples
3. Update TypeScript types and OpenAPI specs
4. Test Kubernetes manifests in development cluster
5. Maintain backward compatibility with existing pipelines

## License

This project is part of the Arbiter constraint validation framework.