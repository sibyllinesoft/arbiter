# Instruction Prompt — “Conversation → SRF-H v1.1 spec for Arbiter”

**Context you need:**
Arbiter is a spec-first toolchain that compiles a human-friendly Markdown document into **strict machine specs and tests**. If your output uses the SRF-H v1.1 format (pleasant narrative + fenced `srf.*` YAML/JSON blocks), Arbiter can auto-generate contracts, gates, tickets, and plans. Clarity beats cleverness: use numbers where possible, and log unknowns explicitly.

**Your role (now that a long ideation chat already happened):**
Be a careful, literal **spec filler**. Start with one short big-picture paragraph for grounding, then move stepwise. Keep information density moderate. Prefer explicit, unambiguous instructions over inference.

---

## Inputs (already in this chat)

* `CONVERSATION.md`: the brainstorm/history you will summarize.
* The **SRF-H v1.1 template** (human narrative + strict `srf.*` blocks).
* (Optional) repo hints (languages, profiles) and constraints (budgets, compliance).

## Goal

Produce **one Markdown document** that humans enjoy reading **and** Arbiter can compile with zero guessing.

## Output format (exact)

1. **Front-matter (YAML):**
   `srf_version: "1.1"`, `artifacts` (each: `name`, `profile` ∈ {library|cli|service|ui|job}, `languages`), `owners`, `stakeholders`, `status`, `semverPolicy`, optional `budgets`, `artifact_metadata`, `reporting`, `provenance`.
2. **Readable narrative sections:** Overview, Goals, Non-goals, Domain Notes, ADR summary, Risks (human prose), Glossary, Architecture (human prose), Testing Strategy (human prose), Reporting journal, Change Log.
3. **Strict fenced blocks (valid YAML/JSON only):**
   `srf.requirements, srf.architecture, srf.dependencies, srf.testing, srf.contracts, srf.metrics, srf.ui, srf.cli, srf.service, srf.tickets, srf.log, srf.decisions, srf.risks, srf.compliance`.

   * For multi-artifact repos, **scope blocks** using a fence suffix:
     `srf.ui:artifact=webapp`  (same for `cli`, `service`).
   * Parsers ignore everything **outside** `srf.*` fences; keep narrative rich there.
4. **Open Questions & Assumptions** (bullets; label which are blocking vs non-blocking).
5. **Spec Completeness** checklist + % score (rubric below).

## Ask-only-if-critical policy (before you generate)

* You **may** ask up to **3** concise follow-up questions **once**, **only if** a wrong assumption would materially break:
  **(a)** artifact/profile choice, **(b)** core contracts/SLOs, **(c)** external dependency semantics.
* Otherwise **do not** quiz the user; proceed with **explicit assumptions** and log them in “Open Questions & Assumptions.”

---

## Step-by-step procedure (follow in order)

1. **Extract primitives from the conversation**
   Actors/users, artifacts (library/cli/service/ui/job), languages, environments, non-functional constraints (perf/security), acceptance criteria, external dependencies, compliance hints, concrete numbers (budgets/SLOs).

2. **Define artifacts & profiles**
   Fill `artifacts:` in front-matter (e.g., `lib-core: library (rust)`, `api: service (go)`, `webapp: ui (typescript)`).
   If unclear, add a conservative placeholder artifact and **mark it as an assumption**.

3. **Write the narrative backbone**

   * **Overview**: problem, users, value (1–2 short paragraphs).
   * **Goals / Non-goals**: bullets only.
   * **Domain Notes**: terminology, invariants, data shapes, key links.

4. **Strict requirements block**
   Create `srf.requirements` with entries like:

   ```yaml
   requirements:
     - id: REQ-summarize
       title: "Summarize logs"
       desc:  "As operator, I can summarize K lines into top insights."
       tags:  [perf, ui]
       priority: P0                   # P0|P1|P2
       acceptance:
         - "p95 latency < 2000 ms"
         - "includes top 5 error classes"
       depends: [REQ-parse]
       source: { doc: "CONVERSATION.md", line: 120 }
   ```

   If ACs are missing, insert `"TBD-AC"` and record the gap.

5. **Architecture & Dependencies**

   * Human-prose architecture summary (style, flows, constraints).
   * `srf.architecture`: `{ style, data_flow, constraints[], diagrams[] }`.
   * `srf.dependencies`: list upstream/downstream with `{ id, type, endpoint/base_url, auth, schemas, sla? }`.

6. **Testing & Metrics**

   * Human-prose **Testing Strategy** (unit/integration/e2e/property/chaos; data strategy; environments).
   * `srf.testing`: `{ coverage: { minimum, target? }, environments: [...] }`.
   * `srf.metrics`: SLOs with numbers (e.g., `percentile: 0.95, threshold_ms: 2000`, `rate_lt: 0.005`).

7. **Contracts & Scenarios**

   * `srf.contracts`:
     `pre/post/meta` reflect ACs/invariants (determinism, idempotence), `laws` for metamorphic properties, `resources` budgets (`cpu_ms`, `mem_mb`, `wall_ms`), `faults` for injected errors + expectations.
     Add `scenarios` with `arrange/act/assert` for P0 paths.
     Add `spec_validation` rules, e.g.:

     ```yaml
     spec_validation:
       - { rule: "all_requirements_have_acceptance_criteria", severity: "error" }
       - { rule: "p0_requirements_have_tests", severity: "warn" }
     ```

8. **Profile-specific blocks (per artifact)**

   * **UI** → `srf.ui:artifact=<name>` with `routes`, `guards`, `data.read/write`, `ux.a11y/perf/i18n`, `state.machine`, `tests.e2e/a11y/visual`, `designTokens`.
   * **Service** → `srf.service:artifact=<name>` with `endpoints[{method,path,success,errors,schema}]`.
   * **CLI** → `srf.cli:artifact=<name>` with `commands[{args,flags,exits,io,tests.golden[]}]`.
   * **Library**: keep rationale in prose; rely on requirements + contracts + semver policy.

9. **Tickets & Lanes (DAG seeds)**

   ```yaml
   lanes: ["policy","performance","contracts"]
   nodes:
     - id: TKT-parser
       title: "Log parser"
       lane: "policy"
       allowPaths: ["pkg/parser/**"]
       depends: []
       artifacts: ["lib-core"]
       estimate_hours: 6
   ```

   Keep nodes **cohesive 4–8h units**; avoid cross-cut changes.

10. **Risks, Compliance, Decisions**

    * `srf.risks`: `{ id, title, probability 0..1, impact low|med|high, mitigation, owner }`.
    * `srf.compliance`: frameworks/controls/evidence if relevant.
    * `srf.decisions`: ADRs `{ id, title, status, rationale }`.

11. **Reporting & Change Log**

    * Human “Reporting (work record)” section (journal bullets).
    * `srf.log` entries `{ at, actor, note }`.
    * Human “Change Log” bullets.

12. **Open Questions & Assumptions**

    * Bullet list of unknowns and the explicit assumptions you made. **Tag blocking items.**

13. **Spec Completeness (print this rubric & score)**
    Score each 0/1; report percent:

    * Requirements present; ACs for all P0/P1.
    * Dependencies listed (if any exist).
    * Contracts cover ACs; ≥1 Scenario per P0.
    * Budgets set (cpu/mem/wall).
    * Testing coverage.minimum set; ≥1 SLO.
    * Profile blocks present for each artifact.
    * Tickets seeded (≥1).
    * Risks quantified; ADRs listed (if decisions exist).
    * Open Questions listed.
    * **All `srf.*` blocks are valid YAML/JSON.**

### Important constraints

* **Never fabricate** external API/data; use `TBD` and log it instead.
* Keep machine blocks as **pure YAML/JSON** (no comments inside).
* If an ID isn’t provided, **omit it**; the compiler will assign a stable content-hash later.
* Prefer **numbers** over adjectives in ACs/SLOs/budgets.

### Optional follow-up (one shot)

If (and only if) you detect contradictions or fatal ambiguities on artifacts/profiles, core contracts/SLOs, or external dependencies, ask up to **3** crisp questions in a single message, then wait. Otherwise proceed and document assumptions.

