# Arbiter Development Specification

**Version:** 4.0.0  
**API Version:** arbiter.dev/v2  
**Status:** Draft  
**Last Updated:** 2025-09-01

## Executive Summary

This specification formalizes the complete end-to-end implementation of the Arbiter framework as outlined in TODO.md Master Plan v4. The goal is to close the loop with a deterministic **Requirements → Spec → Plan → Execute → Test → Trace** pipeline.

## Golden Path User Workflow

The following sequence represents what users should be able to accomplish with a fully implemented Arbiter:

```bash
# 1. Analyze requirements from natural language
arbiter requirements analyze TODO.md --out requirements.cue

# 2. Generate formal specification from requirements  
arbiter spec generate --from-requirements requirements.cue --template library --out arbiter.assembly.cue

# 3. Validate specification and check gates
arbiter check

# 4. Generate human-readable documentation
arbiter docs assembly --md --out SPECIFICATION.md  

# 5. Create implementation plan
arbiter plan milestone M1 --out M1_IMPLEMENTATION.md

# 6. Generate test scaffolding
arbiter tests generate --from-assembly --language rust --out tests/

# 7. Start continuous validation
arbiter watch

# 8. Set up CI/CD integration
arbiter integrate
```

**Deliverables per step:** `requirements.cue` → `assembly.cue` → `SPECIFICATION.md` → `plan.md` → tests + `junit.xml`/`report.json` → CI integration

## System Constraints (Non-Negotiable Rails)

### Performance Limits
- **Request payload:** ≤64 KB
- **Response time:** ≤750 ms per operation  
- **Rate limit:** ~1 request per second per client
- **Behavior:** Batch operations and implement backoff; no silent drops

### Operational Requirements
- **Versioning:** Treat missing `apiVersion/kind` as v0 on read; always write latest envelope
- **Execution:** All analyze/validate operations via server; never run tools outside sandbox
- **Determinism:** Same inputs ⇒ same `plan.json` and artifacts; re-runs are no-ops
- **Filesystem:** Produce no symlinks; standalone/bundle copy files

## Implementation Requirements by Milestone

### Milestone 1: Core Foundation

**Server Endpoints (Stable JSON APIs):**
- `POST /v1/validate/assembly|epic` → `{apiVersion, ir, diagnostics[]}`
- `POST /v1/plan/epic` → `{plan[], guards[], diff}`  
- `POST /v1/execute/epic?apply=1` → `{applied, junit, report}`
- Profile endpoints: `/v1/profile/library/surface`, `/v1/profile/cli/check`

**CLI Commands:**
- `arbiter docs schema|assembly [--md|--json] --out <file>`
- `arbiter explain` (plain-English + IR JSON)
- `arbiter export --json` (machine IR for agents)
- `arbiter integrate` (GH Actions + pre-commit; works out of the box)
- `arbiter validate --explain` (paths + line:col + fix hints)

**Acceptance Criteria:**
- ✅ None of these commands return "not implemented"
- ✅ Each command writes artifacts and supports NDJSON (`--agent-mode`)
- ✅ All server endpoints return valid JSON responses

### Milestone 2: Requirements Pipeline

**Requirements Analysis:**
```bash
arbiter requirements analyze TODO.md --out requirements.cue
```
- **Parser:** Deterministic conversion of headings → requirement groups; bullets → requirement items
- **Recognition:** Parse tags (`Milestone:`, `Deliverable:`, `Gate:`, `Risk:`)
- **ID Assignment:** Assign stable IDs (`REQ-<slug>-NN`)
- **Output Format:** CUE with fields: `id`, `title`, `desc`, `milestone`, `acceptance`, `risks`, `links`

**Spec Generation:**
```bash
arbiter spec generate --from-requirements requirements.cue --template <profile> --out arbiter.assembly.cue
```
- **Mapping:** Map requirements to `Artifact/Profile` blocks, `contracts.invariants`, and test stubs
- **Documentation:** Include inline comments explaining each section
- **Idempotency:** Same input → byte-identical output

**Assembly Documentation:**
```bash
arbiter docs assembly --md --out SPECIFICATION.md
```
- **Rendering:** Generate readable spec from validated IR
- **Format:** Tables for artifacts, gates, milestones; auto-links to requirement IDs

**Interactive Creation:**
```bash
arbiter spec create --interactive
```
- **Guided prompts:** Project type (platform_upgrade|library|service|cli|job), milestones, deliverables, gates, risks
- **Output:** Write `assembly.cue` with comments; re-running with same answers is no-op

### Milestone 3: Surface Analysis & Watch

**Surface Extraction:**
```bash
arbiter surface [--lang <py|ts|rs|go|sh>] --out surface.json
```

**Language-Specific Strategies:**
- **Rust:** `cargo public-api` → JSON; fallback to `rustdoc JSON`; final fallback to `syn` parsing
  - Extract: `pub` types, traits, functions, method signatures, feature flags
- **TypeScript:** `tsc --emitDeclarationOnly` → parse `.d.ts` files  
  - Extract: API names, generics, exported members
- **Python:** `pyright --createstub` or `stubgen` → stubs → JSON surface
- **Go:** `go list -json ./...` + `go doc -all` → exported identifiers
- **Bash:** Parse `--help` trees, function names, expected exit codes

**Features:**
- Compute API delta and `required_bump` for semantic versioning
- Wire into `arbiter check`, `arbiter version plan`, and `watch` mode

**Continuous Development Loop:**
```bash
arbiter watch
```
- **Monitoring:** Watch `*.cue`, code, tests; debounce 250–400 ms
- **On Change:** validate spec → surface extract → profile gates → fast analyze touched docs
- **Output:** Status line + NDJSON events: `{"phase":"watch","changed":["..."],"validate":{ok}, "surface":{delta}, "gates":{pass}}`

### Milestone 4: Testing & Traceability

**Test Generation:**
```bash
arbiter tests generate --from-assembly --language <lang> --out tests/
```
- **Language Support:** 
  - Python: pytest + hypothesis
  - TypeScript: vitest + fast-check  
  - Rust: cargo test + proptest
  - Go: table-driven tests
  - Bash: bats
- **Mapping:** `contracts.invariants[*].cue` → property tests when inputs/outputs declared
- **Fallback:** Generate TODO with guidance for unmappable invariants

**Contract Coverage:**
```bash
arbiter tests cover
```
- **Metric:** Contract Coverage = proven invariants / total invariants
- **Output:** `report.json` and `junit.xml`
- **Enforcement:** Configurable threshold enforcement in CI

**Traceability System:**
- **ID Assignment:** Stable IDs for REQ-*, SPEC-*, TEST-*, CODE-* (path anchors)
- **Link Building:** `arbiter trace link` builds graph: requirement IDs → spec.contracts/tests → generated test files/anchors → code locations (via `// ARBITER:BEGIN/END` markers)
- **Reporting:** `arbiter trace report --out TRACE.json` summarizes coverage and gaps

### Milestone 5: Ecosystem Integration

**Version Management:**
```bash
arbiter version plan
```
- **Analysis:** Use surface delta + spec diff to compute `required_bump` and recommended version
- **Policy Enforcement:** Fail `check` if policy violated (e.g., strict library + breaking delta without MAJOR)

```bash
arbiter release --dry-run|--apply
```
- **Actions:** Compose CHANGELOG; bump versions via `arbiter sync`
- **Language Support:** For Go/Bash suggest tags; never mutate `go.mod`

**Ecosystem Hooks:**
- `arbiter ide recommend` → VS Code extensions + tasks + problem matchers; save-time `cue fmt`
- `arbiter sync` → Project file updates (pyproject/package/Cargo/Makefile) from spec; idempotent
- `arbiter integrate` → CI with build matrices from Profile; PR → `check`; main → `preview|execute`
- `--output-dir` support on all generators (`docs`, `spec generate`, `tests generate`, `plan`)

## Acceptance Test Suite

All of the following must pass for the implementation to be considered complete:

1. **Workflow Demo:** Complete flow `TODO.md → requirements.cue → assembly.cue → SPECIFICATION.md → M1_IMPLEMENTATION.md → tests → green check` on a sample repository

2. **Rust Surface Extraction:** Non-empty extraction from real Rust projects; deliberate breaking change flips `required_bump=MAJOR`

3. **Watch Mode:** Edit file → validate/surface/gates update within ≤3 seconds

4. **Test Generation:** `tests generate` produces runnable test suites; `tests cover` computes Contract Coverage accurately

5. **Traceability:** `TRACE.json` links REQ→SPEC→TEST→CODE with no dangling IDs

6. **Determinism:** Identical inputs yield byte-identical outputs across two separate runs

7. **Command Completeness:** No command listed in this specification returns "not implemented"

## Architecture Overview

### System Layers

**CLI Layer (Node.js/TypeScript)**
- Parse command-line arguments and options
- Format output for human/agent consumption  
- Handle file I/O operations
- Communicate with API server via HTTP

**API Server Layer (Bun + Elysia)**
- Process validation requests in sandboxed environment
- Execute CUE operations and schema validation
- Manage surface extraction across languages
- Handle profile operations and gate checking

**Analysis Layer (Multi-language)**
- Extract API surfaces from codebases
- Compute semantic diffs and version recommendations
- Generate test scaffolding from specifications
- Perform static analysis and quality checks

**Storage Layer (CUE Configuration)**
- Store specifications and artifact profiles
- Maintain traceability links and metadata
- Version management and schema evolution
- Contract definitions and invariants

### Data Flow

```
Requirements (Markdown) 
    ↓ [parse + analyze]
Requirements (CUE)
    ↓ [generate + template]  
Assembly Specification (CUE)
    ↓ [validate + profile]
Implementation Plan (JSON)
    ↓ [execute + test]
Validated Artifacts + Reports
```

## Quality Gates & Invariants

### Performance Invariants
- All operations respect ≤64KB payload, ≤750ms response time, ~1 rps/client limits
- Request batching and backoff implemented where needed
- No silent drops or timeouts without user notification

### Determinism Invariants  
- Same inputs always produce identical outputs
- Re-running operations are no-ops when inputs unchanged
- No side effects in validation or analysis operations

### Completeness Invariants
- All documented commands and APIs are fully functional
- Error messages are helpful and actionable
- Agent mode produces valid, parseable NDJSON for all commands

## Risk Management

### High-Impact Risks

**Performance Constraints (Medium Probability, High Impact)**
- Risk: Performance constraints may be too restrictive for complex operations
- Mitigation: Implement streaming and batching for large operations; provide progress feedback

**Surface Extraction Reliability (High Probability, Medium Impact)**  
- Risk: Language-specific surface extraction may be unreliable across different codebases
- Mitigation: Implement robust fallback strategies for each language; extensive testing across real projects

**Determinism Challenges (Medium Probability, High Impact)**
- Risk: External dependencies may introduce non-determinism
- Mitigation: Sandbox all operations and maintain strict control over dependency versions

## Output Specifications

### Always Generated Files
- `plan.json` - Execution plan with dependencies and validation gates
- `diff.txt` - Human-readable diff of changes  
- `junit.xml` - Test results in standard format
- `report.json` - Detailed analysis and metrics
- `TRACE.json` - Traceability mapping
- `surface.json` - API surface extraction results

### Format Standards
- **API Version:** All outputs stamped with `"apiVersion":"arbiter.dev/v2"`
- **Agent Mode:** NDJSON with small, stable keys for programmatic consumption
- **Human Mode:** Formatted tables and readable output for direct user consumption

## Anti-Patterns (Explicitly Forbidden)

The following behaviors are strictly prohibited in the implementation:

- ❌ Exceed performance caps (64KB, 750ms, 1 rps)
- ❌ Bypass sandbox execution model
- ❌ Write older schema versions  
- ❌ Emit symlinks in generated artifacts
- ❌ Generate non-idempotent file edits
- ❌ Silent failures without user notification
- ❌ Breaking determinism guarantees

## Implementation Priority

**Phase 1 (M1):** Core server endpoints and CLI commands - establish foundation  
**Phase 2 (M2):** Requirements pipeline and interactive spec creation - enable workflow  
**Phase 3 (M3):** Surface extraction and watch mode - enable continuous feedback  
**Phase 4 (M4):** Test generation and traceability - enable quality assurance  
**Phase 5 (M5):** Ecosystem integration and version management - enable production use

This specification provides a comprehensive roadmap for implementing the complete Arbiter framework according to the requirements outlined in TODO.md Master Plan v4.