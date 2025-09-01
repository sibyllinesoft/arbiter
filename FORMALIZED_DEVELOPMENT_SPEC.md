# Arbiter Agent - Formalized Development Specification

**Generated**: 2025-08-31  
**Version**: 3.0.0  
**Status**: ✅ Validated via `arbiter check`

## Overview

This document formalizes the development specification for the Arbiter Agent Master Plan as outlined in TODO.md v3. The specification has been translated into a comprehensive CUE-based configuration in `arbiter.assembly.cue` that defines a developer-friendly, spec-first continuous development tool.

## Architecture Summary

### Core Mission
Build a **continuous development loop** with **test scaffolding from invariants**, **semver-aware version planning**, and **practical ecosystem hooks** - all while maintaining deterministic, versioned, sandboxed execution without symlinks.

### Target Languages
- Python
- TypeScript  
- Rust
- Bash
- Go

### Execution Constraints
- **Payload Limit**: ≤64 KB per operation
- **Duration Limit**: ≤750ms per job
- **Rate Limit**: ≈1 RPS per client
- **Filesystem**: No symlinks (exFAT/Windows compatible)
- **Execution Model**: Deterministic, idempotent, sandboxed, versioned

## Implementation Phases

### Phase 1: Development Feedback Loop (Core Infrastructure)

#### 1.1 File Watching System (`arbiter watch`)
- **Cross-platform file watcher** with 250-400ms debounce
- **Burst coalescing** for multiple rapid changes
- **Live validation pipeline**: validate → plan → profile → analyze
- **Dual output modes**: Human-readable + NDJSON for agent consumption
- **Target**: Changes trigger full validation in ≤3 seconds

#### 1.2 Type Checker Bridges (`arbiter surface`)
Language-specific API surface extraction:

| Language   | Type Checker          | Output Format  |
|------------|----------------------|----------------|
| Python     | `pyright`, `mypy`    | surface.json   |
| TypeScript | `tsc --declaration`  | surface.json   |
| Rust       | `cargo rustdoc`      | surface.json   |
| Go         | `go list`, `go doc`  | surface.json   |
| Bash       | Function parser      | surface.json   |

**Integration**: Automatic surface diff computation for semver bump detection

### Phase 2: Testing Integration

#### 2.1 Test Scaffolding (`arbiter tests scaffold`)
Generate language-appropriate test skeletons from specs:

| Language   | Framework              | Property Testing    |
|------------|----------------------|-------------------- |
| Python     | pytest                | + hypothesis        |
| TypeScript | vitest                | + fast-check        |
| Rust       | cargo test            | + proptest          |
| Go         | go test               | + table-driven      |
| Bash       | bats                  | + custom            |

**Process**: 
1. Read `Epic.spec.tests` and `contracts.invariants`
2. Generate idempotent test stubs with markers
3. Bind inputs/outputs from spec where available

#### 2.2 Contract Coverage (`arbiter tests cover`)
- **Formula**: (# invariants proven by tests) / (total invariants)
- **Default Threshold**: 0.8 (configurable)
- **Output**: `report.json` + `junit.xml` for CI integration
- **Gate**: CI fails if coverage below threshold

### Phase 3: Version Management

#### 3.1 Version Planning (`arbiter version plan`)
**Input**: API delta from surface diff + spec changes  
**Output**: `required_bump` (MAJOR/MINOR/PATCH) with rationale

**Semver Logic**:
- Breaking changes → MAJOR required
- New features → MINOR allowed
- Bug fixes → PATCH allowed
- Strict mode enforces compliance

#### 3.2 Release Management (`arbiter release`)
**Manifest Updates** (language-specific):
- Python: `pyproject.toml`
- TypeScript: `package.json`
- Rust: `Cargo.toml`
- Go: Git tags
- Bash: Git tags

**Process**: Compose CHANGELOG → Suggest version → Update manifests (with `--apply`)

### Phase 4: Ecosystem Integration

#### 4.1 IDE Bootstrap (`arbiter ide recommend`)
Generate IDE configuration:
- `.vscode/extensions.json` (CUE, language-specific extensions)
- `.vscode/tasks.json` (watch, check, format tasks)
- **Problem matchers** for validation errors
- **No symlinks** in generated configs

#### 4.2 Framework Sync (`arbiter sync`)
Language-specific manifest synchronization:
- Python: Inject `tool.arbiter` section in `pyproject.toml`
- TypeScript: Add scripts and devDependencies to `package.json`
- Rust: Update workspace configuration
- Bash: Generate Makefile tasks

#### 4.3 CI Integration (`arbiter integrate`)
Generate GitHub Actions workflows:
- **PR Workflow**: check → lint → test → coverage
- **Main Workflow**: preview → execute → deploy
- **Deterministic**: Identical inputs produce identical workflows

### Phase 5: Documentation & Discovery

#### 5.1 Schema Documentation (`arbiter docs schema`)
- Generated from CUE schemas
- Multiple formats: Markdown, HTML, JSON
- **Auto-generated**: No manual maintenance required

#### 5.2 Examples Generation (`arbiter examples`)
- **Profile-based**: Generate example projects by profile type
- **Language-based**: Generate examples by target language
- **Minimal working repositories** for quick starts

#### 5.3 Plain-English Explanation (`arbiter explain`)
- **Human-readable summary** of current `assembly.cue`
- **JSON IR export** for tooling integration
- **Next step hints** for user guidance

### Phase 6: Quality Assurance & Safety

#### 6.1 Determinism Enforcement
All operations must be:
- **Deterministic**: Same inputs → Same outputs
- **Idempotent**: Repeated operations are safe
- **Versioned**: All specs have explicit versions
- **Sandboxed**: All validation through server API

#### 6.2 Rate Limiting & Safety
- **Payload cap**: 64KB maximum
- **Duration cap**: 750ms maximum  
- **Rate limiting**: 1 RPS with backoff
- **No silent failures**: All errors surfaced

## Implementation Priorities

### Sprint 1: Foundation (Weeks 1-2)
1. **Core CLI structure** with command parsing
2. **File watcher implementation** with debouncing
3. **API server communication** with rate limiting
4. **Basic validation pipeline** (validate → plan)

### Sprint 2: Language Integration (Weeks 3-4)
1. **Type checker bridges** for Python, TypeScript
2. **Surface extraction** and diff computation
3. **Test scaffolding** for core languages
4. **Version analysis** logic

### Sprint 3: Ecosystem Hooks (Weeks 5-6)
1. **IDE configuration generation**
2. **Manifest synchronization** 
3. **CI workflow generation**
4. **Release management** flows

### Sprint 4: Polish & Validation (Weeks 7-8)
1. **Error handling** and user experience
2. **Documentation generation**
3. **Example projects**
4. **Acceptance test validation**

## Quality Gates

### Acceptance Criteria (Must Pass)
1. **Watch loop performance**: Code changes → validation in ≤3s
2. **Scaffold coverage**: Invariants generate runnable tests
3. **Semver enforcement**: Breaking changes require MAJOR bump
4. **Language isolation**: No cross-contamination between language defaults
5. **Deterministic output**: Identical runs produce identical artifacts
6. **CI integration**: Generated workflows run locally via `act`
7. **Legacy handling**: Unversioned specs treated as v0 with migration support

### Test Categories

#### Property Tests
- **Idempotent operations**: `∀x. f(f(x)) = f(x)`
- **Deterministic outputs**: `∀x. f(x) = f(x)`

#### Golden Tests  
- **plan.json format stability**
- **surface.json format stability**

#### Integration Tests
- **End-to-end workflows** for each language
- **API server integration** with rate limiting
- **File system operations** without symlinks

## Risk Mitigation

### Technical Risks
1. **File system performance** on Windows/exFAT
   - *Mitigation*: Efficient debouncing, incremental updates
2. **Language toolchain variations** 
   - *Mitigation*: Version-pinned toolchain specs
3. **Rate limit compliance** with complex operations
   - *Mitigation*: Operation batching and intelligent scheduling

### Operational Risks  
1. **Schema evolution** breaking existing specs
   - *Mitigation*: Migration registry with automated upgrades
2. **Cross-platform compatibility**
   - *Mitigation*: No symlinks, path normalization
3. **Performance scaling** with large codebases
   - *Mitigation*: Incremental analysis, payload size caps

## Success Metrics

### Developer Experience
- **Time to first validation**: <10 seconds from `arbiter watch`
- **Feedback loop latency**: <3 seconds for file changes  
- **Setup complexity**: Single command IDE bootstrap

### Quality Metrics
- **Contract coverage**: ≥80% invariants tested
- **Determinism**: 100% reproducible builds
- **Error clarity**: Plain English error messages with next steps

### Ecosystem Integration
- **IDE support**: VS Code, IntelliJ, Vim configurations
- **CI compatibility**: GitHub Actions, GitLab CI
- **Registry integration**: PyPI, npm, crates.io validation

## Next Steps

1. **Validate spec completeness** against TODO.md requirements
2. **Begin Sprint 1 implementation** with core CLI structure
3. **Set up development environment** with proper tooling
4. **Create initial test cases** for acceptance criteria

---

## Spec Status: ✅ Ready for Implementation

The formalized specification in `arbiter.assembly.cue` provides a complete, validated blueprint for implementing the Arbiter Agent Master Plan. All 10 major components from TODO.md v3 have been translated into structured CUE definitions with proper constraints, workflows, and quality gates.

**Command to validate**: `arbiter check`  
**Status**: All validations passed ✅