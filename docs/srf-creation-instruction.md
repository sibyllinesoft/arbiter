# AI Instruction: Convert Requirements to SRF v1.1

Generated at: 2025-09-04T04:51:27.553Z

## Context

You are an AI assistant helping convert raw requirements into a structured SRF
(Specification Requirements Format) v1.1 document. This document will later be
processed by Arbiter to generate formal CUE specifications and tests.

## Your Task

Transform the requirements below into a complete SRF v1.1 document that follows
the template structure exactly.

## Requirements to Convert:

````markdown
srf_version: "1.1" title: "Lens Agent CLI Suite" artifacts:

- name: "lens-cli-sdk" profile: library languages: \[rust]
- name: "sripgrep" profile: cli languages: \[rust]
- name: "scontext" profile: cli languages: \[rust]
- name: "spatch" profile: cli languages: \[rust]
- name: "simpact" profile: cli languages: \[rust]
- name: "sgraph" profile: cli languages: \[rust]
- name: "sdiffx" profile: cli languages: \[rust]
- name: "srefactor" profile: cli languages: \[rust]
- name: "sdoc" profile: cli languages: \[rust]
- name: "sqa" profile: cli languages: \[rust]
- name: "shealth" profile: cli languages: \[rust] owners: \["Nathan
  [nathan@example.com](mailto:nathan@example.com)"] stakeholders: \["DevX
  [devx@example.com](mailto:devx@example.com)", "Search Infra
  [search@example.com](mailto:search@example.com)", "Release Eng
  [releng@example.com](mailto:releng@example.com)"] status: proposed
  semverPolicy: strict budgets: { cpu_ms: 200, mem_mb: 256, wall_ms: 1000 }
  artifact_metadata: repository: "github.com/nathan/lens-agent-cli" ci_cd:
  "github-actions" deployment: "kubernetes" reporting: sprint:
  "2025-09-01..2025-09-14" artifact_version: "0.1.0" provenance: sources:
  \["SRF-H_v1.1.md", "Lens SPI plan", "Agent tool plans"] generated_by: "SRF-H
  v1.1 template"

---

# Overview (narrative)

A compact, unixy suite of “agent-grade” CLIs on top of Lens’s SPI. Tools default
to JSONL, deterministic ordering, stable `ref`s, strict budgets, and `--strict`
for write ops. The suite accelerates agent workflows: retrieve → build context →
safe patch → analyze impact → verify.

## Goals

- Deliver a shared CLI contract (JSONL, exit codes, budgets, tracing) and
  `lens-cli-sdk` for SPI access.
- Ship `sripgrep`, `scontext`, `spatch`, `simpact`, `sgraph`, `sdiffx`,
  `srefactor`, `sdoc`, `sqa`, `shealth` with measurable SLOs.

## Non-goals

- General-purpose generative code edits beyond constrained, verifiable codemods.
- Remote/cloud indexing; Lens remains the indexing source of truth.

## Domain Notes (narrative)

Relies on Lens `/v1/spi/{search,resolve,context,xref}`. Structural accuracy via
tree-sitter; verification via formatters/build/test hooks. Streaming supported
via SSE for low-latency pipelines. Determinism (ordering, seeds) is mandatory
for agent reproducibility.

---

# Decisions (ADR summary)

- **ADR-001**: Default output is JSONL with deterministic key order. _Status:_
  accepted. _Rationale:_ machine-first, agent-replayable.
- **ADR-002**: All write operations require `--strict` unless explicitly
  `--force`. _Status:_ accepted. _Rationale:_ safety.
- **ADR-003**: `ref` is
  `lens://{repo_sha}/{path}@{source_hash}#B{start}:{end}|AST:{path}`. _Status:_
  accepted. _Rationale:_ re-addressability across tools.
- **ADR-004**: Use tree-sitter + fuzzy + semantic tri-anchoring for patch
  alignment. _Status:_ accepted. _Rationale:_ robust to drift.

```srf.decisions
adrs:
  - id: ADR-001
    title: "Deterministic JSONL default"
    status: "accepted"
    rationale: "Agents need stable parse + replay"
  - id: ADR-002
    title: "Strict-by-default writes"
    status: "accepted"
    rationale: "Prevent ambiguous edits"
  - id: ADR-003
    title: "Stable ref URI"
    status: "accepted"
    rationale: "Round-trip slices across tools"
  - id: ADR-004
    title: "Structure-aware patching"
    status: "accepted"
    rationale: "AST+fuzzy+semantic increases alignment success"
```
````

---

# Risks & Mitigations (narrative)

AST brittleness; mitigate with language whitelist and fuzzy/semantic fallback.
Index staleness; include `source_hash` checks and fail fast. Ambiguity;
`--strict` default for writes and deterministic tie-breakers. Token blowups;
greedy cover with hard caps.

```srf.risks
risks:
  - id: RISK-ast
    title: "AST parse failures in edge cases"
    probability: 0.3
    impact: high
    mitigation: "Whitelist grammars; fallback anchors; telemetry"
    owner: "search-infra"
  - id: RISK-stale
    title: "Index drift vs working tree"
    probability: 0.4
    impact: high
    mitigation: "Compare source_hash; block writes if dirty"
    owner: "devx"
  - id: RISK-ambig
    title: "Ambiguous match leads to wrong edit"
    probability: 0.2
    impact: high
    mitigation: "--strict default, reliability score, `--verify`"
    owner: "cli-core"
```

---

# Glossary (narrative)

- **ref**: Stable URI to a code slice.
- **budget**: CPU/wall/token caps for a call.
- **pack**: Token-bounded, deduped context bundle.
- **invariants**: Post-conditions required after an edit.

---

# Requirements (narrative overview)

Phase-labeled, measurable requirements across tools.

```srf.requirements
requirements:
  - id: REQ-sdk-contract
    title: "Shared CLI & SDK contract"
    desc: "Provide JSONL I/O, exit codes, budgets, tracing, and stable refs across tools."
    tags: [sdk, contracts]
    priority: P0
    acceptance:
      - "All tools emit JSONL with fixed key order"
      - "Exit codes {0,2,3,4} mapped consistently"
      - "ref round-trips via /spi/resolve"

  - id: REQ-sripgrep
    title: "Semantic ripgrep"
    desc: "rg-shaped search over Lens SPI (lex/struct/hybrid) with timing breakdown and budgets."
    tags: [search, perf]
    priority: P0
    acceptance:
      - "p95 local latency < 120ms for k<=50"
      - "Deterministic ordering incl. tie-breakers"
      - "Recall@10 ≥ rg+ctags baseline on corpus"

  - id: REQ-scontext
    title: "Context pack builder"
    desc: "Construct deduped, token-capped packs from refs/queries with minimal overlap."
    tags: [context]
    priority: P0
    acceptance:
      - "No duplicate lines across refs in a pack"
      - "Pack size ≤ context_tokens"
      - "Includes symbol defs for matched hits"

  - id: REQ-spatch
    title: "Structure-aware patch"
    desc: "Apply edit plans/unified diffs under drift using AST+fuzzy+semantic anchoring and verification."
    tags: [editing, safety]
    priority: P1
    acceptance:
      - ">=95% success on drifted corpus"
      - "Idempotence: re-apply ⇒ no-op"
      - "`--verify` gate passes or exit=4"

  - id: REQ-simpact
    title: "Change impact analyzer"
    desc: "Rank downstream symbols/files affected by a ref or patch via xrefs + imports graph."
    tags: [analysis]
    priority: P1
    acceptance:
      - "Top-10 includes >80% of true impacts on gold set"
      - "Outputs reasons with xref evidence"

  - id: REQ-sgraph
    title: "Code graph queries"
    desc: "Provide deps/rdeps/who-calls/path queries with scope filters."
    tags: [graph]
    priority: P1
    acceptance:
      - "Answers return in <300ms for medium repos"
      - "DOT output validates with dot(1)"

  - id: REQ-sdiffx
    title: "Semantic diff"
    desc: "AST-aware diff that detects moves/renames and normalizes formatting noise."
    tags: [diff]
    priority: P2
    acceptance:
      - "Move/rename detection F1 ≥ 0.9 on corpus"
      - "Whitespace-only changes suppressed"

  - id: REQ-srefactor
    title: "Constrained codemods"
    desc: "Rename/extract/reorder with xref-updated refs and verification."
    tags: [refactor]
    priority: P2
    acceptance:
      - "All references updated across repo"
      - "Build/test pass under `--verify`"

  - id: REQ-sdoc
    title: "Doc surfacer"
    desc: "Assemble docstrings/examples/tests for a symbol with ranked exemplars and citations."
    tags: [docs]
    priority: P2
    acceptance:
      - "Returns stitched note ≤ N tokens"
      - "Includes ≥2 cited refs for examples"

  - id: REQ-sqa
    title: "Quick answers (extractive)"
    desc: "Answer factual queries over packs with immutable citations; `--strict` enforces agreement."
    tags: [qa]
    priority: P2
    acceptance:
      - "Two agreeing spans required under --strict"
      - "Zero hallucinations in eval (precision ≥ 0.99)"

  - id: REQ-shealth
    title: "Guardrail"
    desc: "Health checks, budget enforcement, auto-downgrade of modes, and ambiguity detection."
    tags: [ops]
    priority: P0
    acceptance:
      - "Blocks writes when `/health` degraded"
      - "Enforces budget_ms with `timed_out:true`"
```

---

# Architecture (narrative)

CLI suite + shared SDK talking to Lens SPI. Local LRU caches, batched requests,
SSE consumption. Deterministic seeds; `--trace` yields replayable transcripts.

```srf.architecture
style: "modular-cli"
data_flow: "request-response"
constraints:
  - "deterministic-output-required"
  - "writes-require-verify-or-strict"
  - "no direct index mutation"
diagrams:
  - "docs/arch/cli-suite-context.png"
```

---

# Dependencies (external systems/APIs)

Lens SPI provides search, resolve, context, and xref.

```srf.dependencies
services:
  - id: "lens.spi"
    type: http
    base_url: "http://localhost:7700/v1/spi"
    sla: { availability: "99.9%" }
    auth: "none"
    schemas:
      request: "SearchReq|ResolveReq|ContextReq|XrefReq"
      response: "SearchResp|ResolveResp|ContextResp|XrefResp"
```

---

# Testing Strategy (narrative)

Agent task bench (200 tasks) for retrieval, patching, refactors, and QA.
Regression gates on recall\@10, patch success, verify pass-rate, and p95
latencies. Replay logs captured from `--trace`.

```srf.testing
coverage: { minimum: 85, target: 95 }
types: ["unit", "integration", "e2e", "property", "golden", "chaos"]
environments: ["local", "staging", "canary"]
```

---

# Contracts & Scenarios (narrative)

Pre/post conditions encode determinism and safety. Scenarios reflect P0 flows.

```srf.contracts
contracts:
  pre:
    - { name: "valid-jsonl", cue: "stdout lines parse as JSON" }
    - { name: "budget-bounds", cue: "duration_ms <= budget_ms" }
  post:
    - { name: "deterministic-order", cue: "sort(keys(out)) stable && ties break by (path, byte_start)" }
    - { name: "idempotent-writes", cue: "apply(x); apply(x) == no-op" }
  meta:
    - { name: "traceable", cue: "trace contains stages+timings" }
  laws:
    - { name: "ref-stability", relation: "resolve(ref) returns same slice for same source_hash" }
  resources: { cpu_ms: 200, mem_mb: 256, wall_ms: 1000 }
  faults:
    - { name: "spi-timeout", inject: "simulate 429/504", expect: "timed_out:true; deterministic partials" }
scenarios:
  - id: SCN-sripgrep-fast
    title: "Search under 120ms"
    arrange: "index sample repo; set k=20"
    act: "sripgrep q 'read file' --mode hybrid --k 20 --budget-ms 200"
    assert: ["p95 < 120", "results >= 1", "deterministic-order"]
    priority: p0
  - id: SCN-scontext-pack
    title: "Token-bounded pack"
    arrange: "collect refs from sripgrep"
    act: "scontext --context-tokens 2000"
    assert: ["size_tokens <= 2000", "no duplicate lines"]
    priority: p0
  - id: SCN-spatch-safe
    title: "Safe patch with verify"
    arrange: "introduce small API change in sample repo"
    act: "spatch --plan plan.yaml --verify 'cargo build' --strict"
    assert: ["reliability >= 0.8", "idempotent-writes", "verify passes"]
    priority: p1
spec_validation:
  - { rule: "all_requirements_have_acceptance_criteria", severity: "error" }
  - { rule: "p0_requirements_have_tests", severity: "warn" }
```

---

# Metrics & SLOs (structured)

```srf.metrics
slos:
  - id: SLO-sripgrep-latency
    description: "p95 local search under 120ms (k<=50)"
    target: { percentile: 0.95, threshold_ms: 120 }
  - id: SLO-spatch-success
    description: ">=95% apply success on drifted corpus under --strict"
    target: { rate_gte: 0.95 }
  - id: SLO-qa-precision
    description: "sqa precision ≥ 0.99 under --strict"
    target: { rate_gte: 0.99 }
  - id: SLO-diff-f1
    description: "sdiffx move/rename F1 ≥ 0.9"
    target: { rate_gte: 0.9 }
```

---

# CLI / Service / Library (artifact-scoped)

```srf.cli:artifact=sripgrep
commands:
  - name: "sripgrep q"
    summary: "Free-text search (hybrid)"
    args: [{ name: "query", type: "string", required: true }]
    flags:
      - { name: "--mode", type: "enum", values: [lex, struct, hybrid], default: hybrid }
      - { name: "--k", type: "int", default: 20 }
      - { name: "--budget-ms", type: "int", default: 200 }
      - { name: "--context-tokens", type: "int", default: 800 }
      - { name: "--trace", type: "bool", default: false }
    exits: [{ code: 0, meaning: "ok" }, { code: 2, meaning: "ambiguous" }]
    io: { in: "stdin-optional", out: "stdout", schema: "SearchResp" }
  - name: "sripgrep sym"
    summary: "Symbol search"
    args: [{ name: "symbol", type: "string", required: true }]
    flags: [{ name: "--k", type: "int", default: 50 }]
    exits: [{ code: 0, meaning: "ok" }]
    io: { in: "none", out: "stdout", schema: "SearchResp" }
  - name: "sripgrep struct"
    summary: "AST selector search"
    args: [{ name: "selector", type: "string", required: true }]
    flags: [{ name: "--lang", type: "string" }]
    exits: [{ code: 0, meaning: "ok" }]
    io: { in: "none", out: "stdout", schema: "SearchResp" }
```

```srf.cli:artifact=scontext
commands:
  - name: "scontext"
    summary: "Build token-bounded context pack"
    args: []
    flags:
      - { name: "--from-refs", type: "file-or-stdin", default: "-" }
      - { name: "--context-tokens", type: "int", default: 2000 }
      - { name: "--cluster", type: "bool", default: true }
    exits: [{ code: 0, meaning: "ok" }]
    io: { in: "stdin", out: "stdout", schema: "ContextPack" }
```

```srf.cli:artifact=spatch
commands:
  - name: "spatch"
    summary: "Apply structure-aware edit plan or diff"
    args: []
    flags:
      - { name: "--plan", type: "file", required: false }
      - { name: "--diff", type: "file", required: false }
      - { name: "--verify", type: "string", required: false }
      - { name: "--strict", type: "bool", default: true }
      - { name: "--undo", type: "bool", default: true }
    exits:
      - { code: 0, meaning: "applied" }
      - { code: 2, meaning: "ambiguous" }
      - { code: 3, meaning: "invariants_failed" }
      - { code: 4, meaning: "verify_failed" }
    io: { in: "stdin-optional", out: "stdout", schema: "PatchResult" }
```

```srf.cli:artifact=simpact
commands:
  - name: "simpact"
    summary: "Rank impacted symbols/files from a ref or patch"
    args: []
    flags:
      - { name: "--ref", type: "string", required: false }
      - { name: "--patch", type: "file", required: false }
      - { name: "--top", type: "int", default: 20 }
    exits: [{ code: 0, meaning: "ok" }]
    io: { in: "stdin-optional", out: "stdout", schema: "ImpactList" }
```

```srf.cli:artifact=sgraph
commands:
  - name: "sgraph deps"
    summary: "Dependencies of a symbol/file"
    args: [{ name: "--ref", type: "string", required: true }]
    flags: [{ name: "--dot", type: "bool", default: false }]
    exits: [{ code: 0, meaning: "ok" }]
    io: { in: "none", out: "stdout", schema: "Graph" }
  - name: "sgraph rdeps"
    summary: "Reverse dependencies"
    args: [{ name: "--ref", type: "string", required: true }]
    flags: [{ name: "--depth", type: "int", default: 3 }]
    exits: [{ code: 0, meaning: "ok" }]
    io: { in: "none", out: "stdout", schema: "Graph" }
  - name: "sgraph who-calls"
    summary: "Callers of a function"
    args: [{ name: "--ref", type: "string", required: true }]
    flags: []
    exits: [{ code: 0, meaning: "ok" }]
    io: { in: "none", out: "stdout", schema: "Graph" }
```

```srf.cli:artifact=sdiffx
commands:
  - name: "sdiffx"
    summary: "Semantic diff with move/rename detection"
    args: [{ name: "--a", type: "path", required: true }, { name: "--b", type: "path", required: true }]
    flags: [{ name: "--json", type: "bool", default: true }]
    exits: [{ code: 0, meaning: "ok" }]
    io: { in: "none", out: "stdout", schema: "SemanticDiff" }
```

```srf.cli:artifact=srefactor
commands:
  - name: "srefactor rename"
    summary: "Rename symbol across repo"
    args: [{ name: "--ref", type: "string", required: true }, { name: "--to", type: "string", required: true }]
    flags: [{ name: "--verify", type: "string", required: false }]
    exits: [{ code: 0, meaning: "ok" }, { code: 4, meaning: "verify_failed" }]
    io: { in: "none", out: "stdout", schema: "RefactorResult" }
```

```srf.cli:artifact=sdoc
commands:
  - name: "sdoc"
    summary: "Assemble docs/examples/tests for a symbol"
    args: [{ name: "--ref", type: "string", required: true }]
    flags: [{ name: "--tokens", type: "int", default: 1200 }]
    exits: [{ code: 0, meaning: "ok" }]
    io: { in: "none", out: "stdout", schema: "DocNote" }
```

```srf.cli:artifact=sqa
commands:
  - name: "sqa"
    summary: "Extractive answers over context packs"
    args: [{ name: "--question", type: "string", required: true }]
    flags:
      - { name: "--pack", type: "file", required: true }
      - { name: "--strict", type: "bool", default: true }
    exits: [{ code: 0, meaning: "ok" }, { code: 2, meaning: "ambiguous" }]
    io: { in: "stdin-optional", out: "stdout", schema: "Answer" }
```

```srf.cli:artifact=shealth
commands:
  - name: "shealth"
    summary: "Guardrail: health + budgets"
    args: []
    flags:
      - { name: "--require-healthy", type: "bool", default: true }
      - { name: "--downgrade-mode", type: "bool", default: true }
    exits: [{ code: 0, meaning: "ok" }, { code: 2, meaning: "degraded" }]
    io: { in: "none", out: "stdout", schema: "HealthReport" }
```

```srf.service:artifact=lens-cli-sdk
endpoints:
  - method: POST
    path: "/v1/spi/search"
    success: 200
    errors: [400, 408, 429, 500]
    schema:
      request: "SearchReq"
      response: "SearchResp"
  - method: POST
    path: "/v1/spi/context"
    success: 200
    errors: [400, 500]
    schema:
      request: "ContextReq"
      response: "ContextResp"
  - method: GET
    path: "/v1/spi/resolve"
    success: 200
    errors: [400, 404, 500]
    schema:
      request: "ResolveReq"
      response: "ResolveResp"
  - method: POST
    path: "/v1/spi/xref"
    success: 200
    errors: [400, 500]
    schema:
      request: "XrefReq"
      response: "XrefResp"
```

---

# Tickets & Lanes (DAG seeds)

Phased delivery with strict gates.

```srf.tickets
lanes: ["foundation", "search", "patching", "graph", "diff+refactor", "docs+qa", "ops"]
nodes:
  - id: TKT-sdk
    title: "lens-cli-sdk + CLI contract"
    lane: "foundation"
    allowPaths: ["sdk/**", "common/**"]
    depends: []
    artifacts: ["lens-cli-sdk"]
    estimate_hours: 24

  - id: TKT-sripgrep
    title: "sripgrep MVP"
    lane: "search"
    allowPaths: ["tools/sripgrep/**"]
    depends: ["TKT-sdk"]
    artifacts: ["sripgrep"]
    estimate_hours: 24

  - id: TKT-scontext
    title: "scontext MVP"
    lane: "search"
    allowPaths: ["tools/scontext/**"]
    depends: ["TKT-sdk","TKT-sripgrep"]
    artifacts: ["scontext"]
    estimate_hours: 24

  - id: TKT-spatch
    title: "spatch MVP (AST+fuzzy+semantic)"
    lane: "patching"
    allowPaths: ["tools/spatch/**"]
    depends: ["TKT-sdk"]
    artifacts: ["spatch"]
    estimate_hours: 56

  - id: TKT-simpact
    title: "simpact"
    lane: "graph"
    allowPaths: ["tools/simpact/**"]
    depends: ["TKT-sdk"]
    artifacts: ["simpact"]
    estimate_hours: 24

  - id: TKT-sgraph
    title: "sgraph"
    lane: "graph"
    allowPaths: ["tools/sgraph/**"]
    depends: ["TKT-sdk"]
    artifacts: ["sgraph"]
    estimate_hours: 24

  - id: TKT-sdiffx
    title: "sdiffx"
    lane: "diff+refactor"
    allowPaths: ["tools/sdiffx/**"]
    depends: ["TKT-sdk"]
    artifacts: ["sdiffx"]
    estimate_hours: 32

  - id: TKT-srefactor
    title: "srefactor"
    lane: "diff+refactor"
    allowPaths: ["tools/srefactor/**"]
    depends: ["TKT-sdiffx","TKT-sgraph"]
    artifacts: ["srefactor"]
    estimate_hours: 40

  - id: TKT-sdoc
    title: "sdoc"
    lane: "docs+qa"
    allowPaths: ["tools/sdoc/**"]
    depends: ["TKT-sdk","TKT-sripgrep"]
    artifacts: ["sdoc"]
    estimate_hours: 20

  - id: TKT-sqa
    title: "sqa"
    lane: "docs+qa"
    allowPaths: ["tools/sqa/**"]
    depends: ["TKT-scontext"]
    artifacts: ["sqa"]
    estimate_hours: 28

  - id: TKT-shealth
    title: "shealth"
    lane: "ops"
    allowPaths: ["tools/shealth/**"]
    depends: ["TKT-sdk"]
    artifacts: ["shealth"]
    estimate_hours: 12
```

---

# Reporting (work record)

Seed log for kickoff and gates.

```srf.log
entries:
  - at: "2025-09-03T13:00:00Z"
    actor: "Nathan"
    note: "Approved proposed tool list and contracts."
  - at: "2025-09-03T18:00:00Z"
    actor: "DevX"
    note: "Set P0 SLOs for sripgrep + scontext; strict budgets applied."
```

---

# Change Log (narrative)

- 2025-09-03 — Initial SRF for CLI suite; set P0/P1 scopes and SLOs.

````

## SRF Template to Fill:

```markdown
# SRF v1.1 - Structured Requirements Format

## Project Metadata

```yaml
srf.metadata:
  version: "1.1"
  project_name: "[PROJECT_NAME]"
  project_id: "[PROJECT_ID]"
  description: "[BRIEF_PROJECT_DESCRIPTION]"
  created_at: "[ISO_DATE]"
  last_modified: "[ISO_DATE]"
  stakeholders:
    product_owner: "[PRODUCT_OWNER]"
    tech_lead: "[TECH_LEAD]"
    team: "[TEAM_NAME]"
  tags: ["[TAG1]", "[TAG2]", "[TAG3]"]
  status: "draft|active|deprecated"
````

## Project Context

### Problem Statement

[Describe the problem this project solves, target users, and business value]

### Success Criteria

[Define measurable outcomes and key results]

### Constraints and Assumptions

[List technical, business, and operational constraints]

## Technical Specifications

```yaml
srf.technical:
  artifact_profile: 'library|cli|service|ui|job'
  language_primary: '[PRIMARY_LANGUAGE]'
  languages_secondary: ['[LANG1]', '[LANG2]']
  frameworks:
    primary: '[PRIMARY_FRAMEWORK]'
    secondary: ['[FRAMEWORK1]', '[FRAMEWORK2]']
  runtime_environment: '[RUNTIME_ENV]'
  deployment_targets: ['[TARGET1]', '[TARGET2]']
  compatibility:
    platforms: ['[PLATFORM1]', '[PLATFORM2]']
    versions: '[VERSION_REQUIREMENTS]'
```

## Requirements Categories

### Functional Requirements

```yaml
srf.requirements.functional:
  - id: 'FR-001'
    title: '[REQUIREMENT_TITLE]'
    description: '[DETAILED_DESCRIPTION]'
    priority: 'critical|high|medium|low'
    category: 'core|feature|integration|ui'
    acceptance_criteria:
      - 'Given [CONDITION], when [ACTION], then [OUTCOME]'
      - 'Given [CONDITION], when [ACTION], then [OUTCOME]'
    dependencies: ['[DEP_ID1]', '[DEP_ID2]']
    effort_estimate: '[STORY_POINTS|HOURS]'
    business_value: '[HIGH|MEDIUM|LOW]'
```

### Non-Functional Requirements

```yaml
srf.requirements.non_functional:
  performance:
    response_time:
      target: '[TARGET_MS]ms'
      max_acceptable: '[MAX_MS]ms'
    throughput:
      target: '[TARGET_RPS] requests/second'
      peak_load: '[PEAK_RPS] requests/second'
    resource_usage:
      memory_limit: '[MEMORY_MB]MB'
      cpu_limit: '[CPU_PERCENT]%'
  scalability:
    concurrent_users: '[MAX_USERS]'
    data_volume: '[MAX_RECORDS]'
    growth_projection: '[GROWTH_RATE]% per [PERIOD]'
  reliability:
    availability_slo: '[UPTIME_PERCENT]%'
    error_budget: '[ERROR_RATE]%'
    mttr_target: '[MINUTES] minutes'
    backup_frequency: '[FREQUENCY]'
  security:
    authentication: 'required|optional|none'
    authorization: 'rbac|acl|none'
    data_encryption: 'at_rest|in_transit|both|none'
    compliance: ['[STANDARD1]', '[STANDARD2]']
    vulnerability_scanning: 'required|optional'
  usability:
    accessibility: 'wcag_2_1_aa|wcag_2_1_a|none'
    browser_support: ['[BROWSER1]', '[BROWSER2]']
    mobile_responsive: 'required|optional|not_applicable'
    i18n_support: 'required|optional|none'
```

## Architecture & Design

```yaml
srf.architecture:
  pattern: 'monolith|microservices|serverless|library|cli'
  components:
    - name: '[COMPONENT_NAME]'
      type: '[COMPONENT_TYPE]'
      responsibility: '[COMPONENT_RESPONSIBILITY]'
      interfaces: ['[INTERFACE1]', '[INTERFACE2]']
  data_storage:
    primary: '[DATABASE_TYPE]'
    secondary: ['[CACHE_TYPE]', '[QUEUE_TYPE]']
    data_retention: '[RETENTION_POLICY]'
  external_dependencies:
    apis:
      - name: '[API_NAME]'
        url: '[API_URL]'
        authentication: '[AUTH_TYPE]'
        rate_limits: '[LIMITS]'
        fallback_strategy: '[FALLBACK]'
    services:
      - name: '[SERVICE_NAME]'
        type: '[SERVICE_TYPE]'
        criticality: 'critical|important|optional'
```

## API Specifications

```yaml
srf.api:
  style: 'rest|graphql|grpc|webhook'
  base_url: '[BASE_URL]'
  version_strategy: 'header|path|query'
  authentication:
    method: 'bearer|api_key|oauth2|none'
    scopes: ['[SCOPE1]', '[SCOPE2]']
  endpoints:
    - path: '[ENDPOINT_PATH]'
      method: '[HTTP_METHOD]'
      description: '[ENDPOINT_DESCRIPTION]'
      request_schema: '[SCHEMA_REF]'
      response_schema: '[SCHEMA_REF]'
      error_codes: ['[CODE1]', '[CODE2]']
      rate_limit: '[REQUESTS_PER_MINUTE]'
  data_schemas:
    - name: '[SCHEMA_NAME]'
      type: 'object|array|primitive'
      properties:
        field1:
          type: '[FIELD_TYPE]'
          required: true|false
          description: '[FIELD_DESCRIPTION]'
```

## Quality Assurance

```yaml
srf.quality:
  testing_strategy:
    unit_tests:
      coverage_target: '[PERCENTAGE]%'
      framework: '[TEST_FRAMEWORK]'
    integration_tests:
      coverage_target: '[PERCENTAGE]%'
      test_data_strategy: '[STRATEGY]'
    end_to_end_tests:
      coverage_target: '[PERCENTAGE]%'
      automation_level: '[PERCENTAGE]%'
    performance_tests:
      load_testing: 'required|optional'
      stress_testing: 'required|optional'
      tools: ['[TOOL1]', '[TOOL2]']
  code_quality:
    linting: 'required|optional'
    static_analysis: 'required|optional'
    complexity_limits:
      cyclomatic: '[MAX_COMPLEXITY]'
      nesting_depth: '[MAX_DEPTH]'
    documentation:
      api_docs: 'required|optional'
      inline_comments: 'required|optional'
      architecture_docs: 'required|optional'
```

## Operations & Deployment

```yaml
srf.operations:
  deployment:
    strategy: 'blue_green|rolling|canary|direct'
    environments: ['development', 'staging', 'production']
    automation_level: '[PERCENTAGE]%'
    rollback_strategy: '[STRATEGY]'
  monitoring:
    metrics:
      - name: '[METRIC_NAME]'
        type: 'counter|gauge|histogram|summary'
        description: '[METRIC_DESCRIPTION]'
        labels: ['[LABEL1]', '[LABEL2]']
    logging:
      level: 'debug|info|warn|error'
      structured: true|false
      retention: '[RETENTION_DAYS] days'
    alerting:
      channels: ['email', 'slack', 'pagerduty']
      escalation_policy: '[POLICY_NAME]'
  maintenance:
    backup_strategy: '[STRATEGY]'
    update_frequency: '[FREQUENCY]'
    maintenance_windows: '[SCHEDULE]'
```

## Project Constraints

```yaml
srf.constraints:
  timeline:
    start_date: '[ISO_DATE]'
    target_date: '[ISO_DATE]'
    hard_deadline: '[ISO_DATE]'
    milestones:
      - name: '[MILESTONE_NAME]'
        date: '[ISO_DATE]'
        deliverables: ['[DELIVERABLE1]', '[DELIVERABLE2]']
  budget:
    development_cost: '[CURRENCY_AMOUNT]'
    operational_cost_monthly: '[CURRENCY_AMOUNT]'
    infrastructure_cost: '[CURRENCY_AMOUNT]'
    third_party_costs: '[CURRENCY_AMOUNT]'
  resources:
    team_size: '[NUMBER] developers'
    skill_requirements: ['[SKILL1]', '[SKILL2]']
    external_dependencies: ['[VENDOR1]', '[VENDOR2]']
  compliance:
    regulations: ['[REGULATION1]', '[REGULATION2]']
    certifications: ['[CERT1]', '[CERT2]']
    audit_requirements: ['[REQ1]', '[REQ2]']
```

## Risk Assessment

```yaml
srf.risks:
  - id: 'RISK-001'
    description: '[RISK_DESCRIPTION]'
    category: 'technical|business|operational|external'
    probability: 'high|medium|low'
    impact: 'high|medium|low'
    risk_score: '[CALCULATED_SCORE]'
    mitigation_strategy: '[STRATEGY]'
    contingency_plan: '[PLAN]'
    owner: '[RESPONSIBLE_PERSON]'
    review_date: '[ISO_DATE]'
```

## Validation Criteria

```yaml
srf.validation:
  acceptance_tests:
    - scenario: '[TEST_SCENARIO]'
      given: '[PRECONDITIONS]'
      when: '[ACTIONS]'
      then: '[EXPECTED_OUTCOMES]'
      verification_method: 'automated|manual|both'
  performance_criteria:
    - metric: '[METRIC_NAME]'
      baseline: '[BASELINE_VALUE]'
      target: '[TARGET_VALUE]'
      measurement_method: '[METHOD]'
  quality_gates:
    - gate: '[GATE_NAME]'
      criteria: '[CRITERIA]'
      measurement: '[MEASUREMENT_METHOD]'
      threshold: '[THRESHOLD_VALUE]'
```

## Appendices

### Glossary

[Define domain-specific terms and acronyms]

### References

[List relevant documentation, standards, and external resources]

### Change Log

```yaml
srf.changelog:
  - version: '1.1.0'
    date: '[ISO_DATE]'
    changes: ['[CHANGE1]', '[CHANGE2]']
    author: '[AUTHOR]'
```

````

## Instructions:

# SRF v1.1 Creation Instructions

## Overview
You are creating a Structured Requirements Format (SRF) v1.1 document that will be processed by the Arbiter system to generate formal CUE specifications, validation rules, and test cases. Follow these guidelines carefully.

## Key Principles

### 1. Structured Data Blocks
- All `srf.*` blocks MUST be valid YAML or JSON
- Use consistent indentation (2 spaces for YAML)
- Quote string values that might contain special characters
- Use proper list syntax for arrays
- Ensure all required fields are present

### 2. Requirement Completeness
- Every functional requirement needs clear acceptance criteria
- Use the "Given-When-Then" format for behavioral specifications
- Include measurable success metrics
- Specify dependencies between requirements
- Assign realistic priority levels

### 3. Technical Specificity
- Choose appropriate artifact profiles: `library`, `cli`, `service`, `ui`, `job`
- Specify actual technologies, not generic placeholders
- Include version constraints where relevant
- Define concrete API contracts when applicable
- Set realistic performance targets

## Section-by-Section Guidelines

### Project Metadata
- Use kebab-case for `project_id`
- Include ISO 8601 timestamps
- Tag projects meaningfully (`api`, `frontend`, `mobile`, etc.)
- Set status appropriately (`draft`, `active`, `deprecated`)

### Technical Specifications
- **Artifact Profile Selection:**
  - `library`: Reusable code packages, SDKs, utilities
  - `cli`: Command-line tools and utilities
  - `service`: Backend services, APIs, microservices
  - `ui`: Frontend applications, dashboards, websites
  - `job`: Batch processes, workers, scheduled tasks

- **Language and Framework:**
  - Be specific: "TypeScript" not "JavaScript"
  - Include version constraints: "Node.js >=18.0.0"
  - List secondary languages for polyglot projects
  - Specify framework versions: "React 18.x", "FastAPI 0.100+"

### Functional Requirements
- **ID Format:** Use consistent prefixes: `FR-001`, `NFR-001`, `API-001`
- **Acceptance Criteria:** Write testable conditions
  ```yaml
  acceptance_criteria:
    - "Given a valid API key, when making a request, then return 200 status"
    - "Given invalid credentials, when authenticating, then return 401 error"
````

- **Dependencies:** Reference other requirement IDs
- **Effort Estimation:** Use story points or hour estimates consistently

### Non-Functional Requirements

- **Performance Targets:** Be realistic and measurable
  - Response time: `< 200ms` for web APIs
  - Throughput: `1000 requests/second` for high-load services
  - Memory: `< 512MB` for containerized services
- **Scalability Numbers:** Base on actual usage projections
  - Concurrent users: realistic peaks, not theoretical maximums
  - Data volume: consider growth over 2-3 years
- **SLOs and Error Budgets:** Industry-standard targets
  - Availability: `99.9%` for internal tools, `99.99%` for critical services
  - Error rate: `< 0.1%` for production systems

### API Specifications

- **Complete Endpoint Documentation:**
  ```yaml
  endpoints:
    - path: '/api/v1/users'
      method: 'GET'
      description: 'List users with pagination'
      request_schema: 'PaginationRequest'
      response_schema: 'UserListResponse'
      error_codes: ['400', '401', '500']
      rate_limit: '100/minute'
  ```

### Quality Assurance

- **Test Coverage Targets:**
  - Unit tests: 80-90% for business logic
  - Integration tests: 70-80% for API endpoints
  - E2E tests: Cover critical user workflows
- **Code Quality Tools:** Specify actual tools (ESLint, Prettier, SonarQube)

### Operations & Deployment

- **Monitoring Strategy:** Define actual metrics
  ```yaml
  metrics:
    - name: 'http_requests_total'
      type: 'counter'
      description: 'Total HTTP requests by method and status'
      labels: ['method', 'status_code', 'endpoint']
  ```

## Data Quality Standards

### Placeholder Management

- Use `"TBD"` for unknown external APIs or third-party dependencies
- Use `"[TO_BE_DETERMINED]"` for values requiring stakeholder input
- Replace `"[PLACEHOLDER]"` with actual values before finalizing

### Realistic Values

- Set conservative but achievable performance targets
- Use industry-standard SLA percentages
- Base resource estimates on similar projects
- Include buffer time in timeline estimates

### Consistency Checks

- Ensure artifact profile matches technical specifications
- Verify dependency relationships are bidirectional
- Check that non-functional requirements align with use cases
- Validate that monitoring covers defined SLOs

## Common Patterns by Artifact Type

### Library/SDK

```yaml
srf.technical:
  artifact_profile: 'library'
  language_primary: 'TypeScript'
  deployment_targets: ['npm', 'cdn']
```

### CLI Tool

```yaml
srf.technical:
  artifact_profile: 'cli'
  language_primary: 'Go'
  deployment_targets: ['binary', 'homebrew', 'apt']
```

### Web Service

```yaml
srf.technical:
  artifact_profile: 'service'
  language_primary: 'Python'
  frameworks:
    primary: 'FastAPI'
  deployment_targets: ['docker', 'kubernetes']
```

### Frontend Application

```yaml
srf.technical:
  artifact_profile: 'ui'
  language_primary: 'TypeScript'
  frameworks:
    primary: 'React'
  deployment_targets: ['cdn', 'nginx']
```

### Background Job

```yaml
srf.technical:
  artifact_profile: 'job'
  language_primary: 'Python'
  deployment_targets: ['kubernetes-cronjob', 'aws-lambda']
```

## Final Validation Checklist

Before submitting your SRF document:

- [ ] All YAML blocks are syntactically valid
- [ ] Every functional requirement has acceptance criteria
- [ ] Technical specifications match the artifact profile
- [ ] Performance targets are realistic and measurable
- [ ] API endpoints are completely specified
- [ ] Dependencies are properly referenced
- [ ] Risk assessments include mitigation strategies
- [ ] Timeline includes realistic milestones
- [ ] Monitoring strategy covers defined SLOs
- [ ] No placeholder values remain in critical fields

## Output Format

Generate a complete SRF v1.1 document that:

1. Follows the exact template structure
2. Contains valid YAML/JSON in all `srf.*` blocks
3. Provides specific, actionable requirements
4. Can be immediately processed by: `arbiter srf import your-srf.md`

Begin your response with the complete SRF document. Do not include explanatory
text before or after the document itself.

## Important Notes:

- Keep all `srf.*` blocks strictly valid YAML/JSON
- Fill in realistic but conservative values for budgets, SLOs, and constraints
- Use "TBD" for unknown external APIs/dependencies
- Be specific about acceptance criteria and measurable outcomes
- Include proper artifact profiles: library, cli, service, ui, job
- Ensure language choices match the actual technology stack

## Output Format:

Generate a complete SRF v1.1 document that Arbiter can process. The document
should be immediately usable with:

```bash
arbiter srf import generated-srf.md --template <appropriate-template>
```

Begin your response with the SRF document (no preamble needed).
