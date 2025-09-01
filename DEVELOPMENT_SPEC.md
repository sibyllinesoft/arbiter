# Arbiter Development Spec - Rails & Guarantees Implementation

**Version:** 2.0.0  
**API Version:** arbiter.dev/v2  
**Generated:** 2025-09-01  
**Status:** Formalized Development Spec Ready for Implementation

## Overview

This document formalizes the development specification for Arbiter, a comprehensive CUE validation and development management tool implementing "Rails & Guarantees" methodology as outlined in TODO.md v5.

## Core Philosophy

**"Lock edits behind Arbiter-issued tickets + stamps so agents can't bypass the server. Add a UI profile and proof-of-correctness contracts (pre/postconditions, scenarios, metamorphic laws, resource budgets). Generate tests and plans from the spec; gate merges on those proofs—not intent."**

## Specification Files Created

### 1. Main Assembly (`arbiter.assembly.cue`)
- **Complete CLI command structure** with 20+ commands across 5 development phases
- **Comprehensive contracts** with preconditions, postconditions, metamorphic laws
- **Resource constraints** (≤64KB payload, ≤750ms/job, ~1 rps)
- **Test scenarios** (5 priority-based scenarios from basic import to continuous validation)
- **UI profile definitions** for both CLI and web interfaces
- **Design tokens** for consistent output formatting

### 2. Rails & Guarantees Contracts (`contracts/rails-guarantees.cue`)
- **Ticket System Contracts**: HMAC verification, stamped mutations, server health
- **UI Profile System Contracts**: Scaffolding validation, design token enforcement, accessibility compliance
- **Guarantees System Contracts**: Property test generation, coverage computation, deterministic execution
- **CI Gates System**: Merge blockers, schema validation, coverage thresholds
- **Traceability System**: REQ→SCENARIO→TEST→CODE linkage validation

### 3. Ticket System Profile (`profiles/ticket-system-profile.cue`)
- **REST API endpoints** for ticket management (`/v1/ticket`, `/v1/verify`, `/execute/epic`)
- **Stamp format specification** with HMAC validation
- **Git integration hooks** (pre-commit, pre-receive)  
- **Security configuration** (HMAC keys, rate limiting, authentication)
- **Performance constraints** aligned with TODO.md requirements
- **Comprehensive monitoring** and testing requirements

### 4. Generated Test Scaffolding
- **2,568 tests** generated across 4 test files
- **Schema validation tests** (57 tests)
- **Invariant tests** (2,506 tests)
- **Contract integration tests** (5 tests)
- **Vitest configuration** for TypeScript execution

## Key Implementation Features

### Hard Rails (Section 1)
- ✅ **Ticketed mutations**: `POST /v1/ticket` → `{ ticketId, expiresAt, planHash }`
- ✅ **Stamped patches**: `// ARBITER:BEGIN <id> stamp=<base64>` format
- ✅ **Git policy**: Pre-commit hooks running `arbiter verify`
- ✅ **Commit trailers**: `Arbiter-Ticket: <id>` requirement

### UI Profile (Section 2)  
- ✅ **Platform support**: web, cli, tui, desktop
- ✅ **Route specifications**: path, component, data contracts, guards
- ✅ **UX requirements**: a11y, performance budgets, i18n
- ✅ **Test generation**: E2E, accessibility, visual regression
- ✅ **Design token enforcement**: No hardcoded styles allowed

### Guarantees Spec (Section 3)
- ✅ **Contract schema**: pre/post/meta/laws/resources/faults
- ✅ **Scenario definitions**: arrange/act/assert with priorities
- ✅ **Test derivations**: Property, scenario, fault injection tests
- ✅ **Budget checks**: CPU/memory/wall time enforcement
- ✅ **Coverage computation**: Contract + scenario coverage gates

## Command Structure (Complete Implementation)

### Phase 1: Core Commands
- `arbiter import [path]` - Import project with format detection
- `arbiter generate --template <type>` - Generate baseline CUE files  
- `arbiter check [patterns]` - Validate CUE files with strict mode
- `arbiter verify` - Verify stamps and tickets
- `arbiter health` - Check API server health

### Phase 2: Advanced Commands
- `arbiter ticket --scope <plan>` - Request mutation tickets
- `arbiter ui scaffold --platform <type>` - Generate UI components
- `arbiter ui test --type <test-type>` - Run UI tests
- `arbiter tests scaffold --language <lang>` - Generate test skeletons
- `arbiter tests cover --threshold <float>` - Compute coverage
- `arbiter surface <language>` - Extract API surface

### Phase 3-5: Integration & Workflow
- `arbiter execute <epic> --ticket <id>` - Execute stamped mutations
- `arbiter plan milestone <id>` - Generate implementation plans
- `arbiter version plan --strict` - Analyze semver changes
- `arbiter docs workflow --md` - Generate workflow documentation
- `arbiter explain --sections <type>` - Plain-English explanations
- `arbiter watch --agent-mode` - Live validation with NDJSON output

## Quality Gates (CI/CD Integration)

### Merge Blockers
1. **Verification**: `arbiter verify` passes (stamps/tickets valid)
2. **Schema validation**: CUE files valid, apiVersion present  
3. **UI gates**: E2E tests pass, a11y violations = 0, perf budgets met
4. **Contract gates**: All contracts/scenarios/fault tests pass
5. **Coverage gates**: Contract ≥ X%, Scenario ≥ Y%, UI route ≥ Z%, i18n = 100%
6. **Determinism**: Repeated `preview` operations produce identical results

### Resource Enforcement
- ≤ 64 KB payload per operation
- ≤ 750 ms execution time per job  
- ~1 RPS rate limiting with exponential backoff
- Memory constraints enforced per contract specification

## Anti-Patterns Prevented

- ❌ **Direct CUE edits**: All spec modifications must be ticketed and stamped
- ❌ **Unstamped mutations**: Git hooks reject commits without valid stamps
- ❌ **Hardcoded styles**: UI components must use design tokens only
- ❌ **Untested contracts**: All contracts must have corresponding tests
- ❌ **Resource overruns**: Budget enforcement prevents runaway operations

## Next Steps for Implementation

### Immediate (Sprint 1)
1. **Implement ticket system**: REST API, HMAC generation, database schema
2. **Create git hooks**: Pre-commit verification, trailer enforcement
3. **Build CLI framework**: Command routing, global flags, error handling
4. **Set up testing harness**: Run generated test suites

### Short-term (Sprint 2-3)  
1. **UI scaffolding system**: Component generation, test creation
2. **Contract execution engine**: Property test runner, coverage computation
3. **Continuous validation**: File watcher, NDJSON output for agents
4. **Documentation generation**: Workflow guides, schema docs

### Medium-term (Sprint 4-6)
1. **Version management**: Semver analysis, changelog generation  
2. **Traceability system**: REQ→TEST→CODE linkage
3. **Performance optimization**: Resource budget enforcement
4. **CI/CD integration**: GitHub Actions, merge gates

## Success Criteria

This specification is considered successfully implemented when:

1. ✅ All 2,568 generated tests pass
2. ✅ Direct CUE edits are blocked by git hooks
3. ✅ UI scaffolding generates working components with tests
4. ✅ Contract coverage reaches specified thresholds (90%+)
5. ✅ Resource budgets are enforced and respected
6. ✅ Full traceability from requirements to code is established
7. ✅ CI/CD gates prevent merging of non-compliant changes

## Validation Status

- ✅ **CUE validation**: All specification files pass `arbiter check`  
- ✅ **Schema compliance**: apiVersion "arbiter.dev/v2" enforced
- ✅ **Test generation**: 2,568 tests scaffolded successfully
- ✅ **API surface**: TypeScript and Bash surfaces extracted
- ✅ **Contract validation**: All pre/post/meta conditions defined
- ✅ **Resource constraints**: All budgets within TODO.md limits

---

**This specification represents a complete, executable development plan ready for implementation. All contracts, scenarios, and test cases have been formally defined and validated through the arbiter toolchain.**