---
srf_version: "1.1"
title: "PROJECT NAME"
artifacts:                               # Multi-artifact projects (each has a name + profile)
  - name: "lib-core"
    profile: library                     # library|cli|service|ui|job
    languages: [rust]
  - name: "webapp"
    profile: ui
    languages: [typescript]
owners: ["Team Foo <team@example.com>"]
stakeholders: ["PM Bar <pm@example.com>", "Ops Baz <ops@example.com>"]
status: draft                            # draft|proposed|approved
semverPolicy: strict                     # default policy (artifact-local overrides allowed)
budgets: { cpu_ms: 200, mem_mb: 256, wall_ms: 1000 }   # default budgets
artifact_metadata:
  repository: "github.com/company/project"
  ci_cd: "github-actions"                # jenkins|gitlab|circle|custom
  deployment: "kubernetes"               # docker|serverless|bare-metal
reporting:
  sprint: "2025-09-01..2025-09-14"
  artifact_version: "0.1.0"
provenance:
  sources: ["TODO.md", "ADR-001.md", "Slack #project"]
  generated_by: "SRF-H v1.1 template"
---

# Overview (narrative)
Explain the **why** in 1–2 paragraphs. Keep prose rich; parsers ignore narrative but agents read it for context.

## Goals
- Goal A
- Goal B

## Non-goals
- Non-goal A
- Non-goal B

## Domain Notes (narrative)
Background, diagrams, ecosystem context, edge cases, constraints, links.

---

# Decisions (ADR summary)
- **ADR-001**: Decision. *Status:* accepted. *Rationale:* …
- **ADR-002**: Decision. *Status:* proposed.

```srf.decisions
adrs:
  - id: ADR-001
    title: "Idempotency keys"
    status: "accepted"
    rationale: "Retries must not duplicate"
    links: ["issue#12"]
```
---

# Risks & Mitigations (narrative)
List key risks with mitigations.

```srf.risks
risks:
  - id: RISK-001
    title: "Unstructured logs reduce quality"
    probability: 0.3             # 0.0..1.0
    impact: high                 # low|med|high
    mitigation: "Add canonical parser"
    owner: "team-foo"
```
---

# Glossary (narrative)
- **Atom**: …
- **Intent**: …

---

# Requirements (narrative overview)
Summarize major requirements; reference `@REQ-*` anywhere in prose.

```srf.requirements
# STRICT, PARSEABLE. YAML/JSON only.
# Omit id to let compiler assign stable content-hash IDs.
requirements:
  - id: REQ-summarize
    title: "Summarize logs"
    desc: "As operator, I can summarize K lines to top insights."
    tags: [ui, perf]
    priority: P1                  # P0|P1|P2
    acceptance:
      - "Given N<=1000 lines, summary returns in <2s"
      - "Output lists top 5 error classes"
    depends: [REQ-parse]
    source: { doc: "TODO.md", line: 42 }

  - id: REQ-parse
    title: "Parse logs"
    desc: "Normalize heterogeneous logs into a common event shape."
    tags: [ingest]
    priority: P1
    acceptance:
      - "Reject lines without timestamp"
      - "Support formats: json, nginx, syslog"
```
---

# Architecture (narrative)
Describe the system shape and constraints.

```srf.architecture
style: "microservices"             # monolith|microservices|serverless
data_flow: "event-driven"
constraints:
  - "no-shared-databases"
  - "async-communication-only"
diagrams:
  - "docs/arch/context.png"
```

---

# Dependencies (external systems/APIs)
Narrative: list critical upstreams/downstreams, SLAs, data contracts.

```srf.dependencies
services:
  - id: "auth.sso"
    type: http
    base_url: "https://sso.example.com"
    sla: { availability: "99.9%" }
    auth: "oauth2"
    schemas: { request: "AuthReq", response: "AuthResp" }
  - id: "pkg.registry"
    type: npm
    endpoint: "registry.npmjs.org"
```

---

# Testing Strategy (narrative)
Overall approach to tests, environments, data management.

```srf.testing
coverage: { minimum: 85, target: 95 }   # affects CI gates
types: ["unit", "integration", "e2e", "property", "chaos"]
environments: ["local", "staging", "canary"]
```

---

# Contracts & Scenarios (narrative)
Explain why the contracts exist; the block encodes machine-checkable rules.

```srf.contracts
contracts:
  pre:
    - { name: "valid-input", cue: "len(input) > 0" }
  post:
    - { name: "non-empty-output", cue: "len(output) > 0" }
  meta:
    - { name: "deterministic", cue: "f(x) == f(x)" }
  laws:
    - { name: "idempotent", relation: "f(f(x)) == f(x)" }
  resources: { cpu_ms: 200, mem_mb: 256, wall_ms: 1000 }
  faults:
    - { name: "bad-json", inject: "MALFORMED_INPUT", expect: "error('bad input')" }
scenarios:
  - id: SCN-quick-summary
    title: "Summarize 1000 lines quickly"
    arrange: "load('samples/1k.log')"
    act: "skald summarize --input samples/1k.log"
    assert:
      - "duration_ms < 2000"
      - "contains('Top 5')"
    priority: p0
spec_validation:                    # Spec-level linting hooks
  - { rule: "all_requirements_have_acceptance_criteria", severity: "error" }
  - { rule: "p0_requirements_have_tests", severity: "warn" }
```

---

# Metrics & SLOs (structured)
```srf.metrics
slos:
  - id: SLO-summary-latency
    description: "p95 summary under 2s"
    target: { percentile: 0.95, threshold_ms: 2000 }
  - id: SLO-errors
    description: "error rate < 0.5%"
    target: { rate_lt: 0.005 }
```

---

# UI (per-artifact block; scope via fence suffix)
Narrative intent for the UI; place parseable UI under the scoped block.

```srf.ui:artifact=webapp
routes:
  - path: "/logs"
    component: "LogsPage"
    guards: ["auth.user != null"]
    data:
      read:  [{ source: "GET /v1/logs", schema: "LogList" }]
      write: []
    ux:
      a11y: { aria: true, contrast: "AA" }
      perf: { tti_ms: 1200, lcp_ms: 1800 }
      i18n: { requiredKeys: ["logs.title","logs.empty"], locales: ["en","es"] }
    state: { machine: "docs/statecharts/logs.scxml" }
    tests: { e2e: ["loads", "filters"], a11y: true, visual: false }
designTokens:
  color: { primary: "#123456" }
  spacing: { sm: 4, md: 8, lg: 16 }
  typography: { body: "Inter 14px" }
```

---

# CLI / Service / Library (use artifact-scoped blocks as needed)
```srf.cli:artifact=cli-tool
commands:
  - name: "skald summarize"
    summary: "Summarize logs"
    args: [{ name: "--input", type: "file", required: true }]
    flags: [{ name: "--top", type: "int", default: 5 }]
    exits: [{ code: 0, meaning: "ok" }, { code: 2, meaning: "bad input" }]
    io: { in: "file", out: "stdout", schema: "Summary" }
```

```srf.service:artifact=api
endpoints:
  - method: GET
    path: "/v1/summary"
    success: 200
    errors: [400, 500]
    schema:
      request: "SummaryRequest"
      response: "SummaryResponse"
```

---

# Tickets & Lanes (DAG seeds)
Narrative about lanes and rationale.

```srf.tickets
lanes: ["policy", "performance", "contracts"]
nodes:
  - id: TKT-parser
    title: "Log parser"
    lane: "policy"
    allowPaths: ["pkg/parser/**"]
    depends: []
    artifacts: ["lib-core"]           # optional scoping
    estimate_hours: 6

  - id: TKT-summarizer
    title: "Summarizer"
    lane: "performance"
    allowPaths: ["pkg/summarize/**"]
    depends: ["TKT-parser"]
    artifacts: ["lib-core","api"]
    estimate_hours: 8
```

---

# Reporting (work record)
Narrative journal entries go here. Mirror key facts in the block below for machines.

```srf.log
entries:
  - at: "2025-09-01T13:12:00Z"
    actor: "Nathan"
    note: "Kickoff meeting; clarified P0 requirements."
  - at: "2025-09-02T10:05:00Z"
    actor: "PM Bar"
    note: "Enforce strict semver for library; perf budget set."
```

---

# Compliance (optional)
Narrative: regulatory scope and intent.

```srf.compliance
frameworks:
  - name: "SOC2"
    controls: ["CC1.1","CC2.1"]
    evidence: ["logs/audit.md","policy/change-mgmt.md"]
  - name: "HIPAA"
    controls: ["164.312(a)(2)(i)"]
    evidence: ["docs/phi_handling.md"]
```

---

# Change Log (narrative)
- 2025-09-02 — Added SLO-summary-latency; tightened budgets.

<!-- PARSING RULES
1) Everything outside ```srf.*``` blocks is narrative; parsers ignore it.
2) Each srf.* block must be valid YAML/JSON. Supported blocks include:
   - srf.requirements, srf.architecture, srf.dependencies, srf.testing,
     srf.contracts, srf.metrics, srf.ui, srf.cli, srf.service, srf.tickets,
     srf.log, srf.decisions, srf.risks, srf.compliance
3) Artifact-scoped blocks use the suffix form: ```srf.<kind>:artifact=<name>
4) Unknown keys: warn and ignore. Block versions may be introduced later via suffix: :v=1
5) IDs may be omitted; compiler assigns stable content-hash IDs.
6) Front-matter defines multi-artifact topology; per-artifact overrides may live in the scoped blocks.
-->
