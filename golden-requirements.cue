// Generated requirements from markdown analysis
// Timestamp: 2025-09-01T01:29:21.436Z
// API Version: arbiter.dev/v2

package requirements

apiVersion: "arbiter.dev/v2"
kind: "Requirements"
metadata: {
    name: "parsed-requirements"
    generated: "2025-09-01T01:29:21.436Z"
    source: "markdown-analysis"
}

requirements: {
    "GROUP-arbiter-agent-master-plan-prompt-v4": {
        title: "Arbiter Agent — Master Plan Prompt (v4)"
        description: ""
        requirements: {
        }
    }
    "GROUP-0-golden-path-what-the-user-should-be-able-to-do": {
        title: "0) Golden Path (what the user should be able to do)"
        description: ""
        requirements: {
        }
    }
    "GROUP-1-rails-non-negotiables": {
        title: "1) Rails (non-negotiables)"
        description: ""
        requirements: {
            "REQ-versioning-treat-mis-01": {
                title: "**Versioning:** treat missing `apiVersion/kind` as v0 on read; always write latest envelope"
                description: "**Versioning:** treat missing `apiVersion/kind` as v0 on read; always write latest envelope."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-execution-all-analyz-02": {
                title: "**Execution:** all analyze/validate via server; never run tools outside sandbox"
                description: "**Execution:** all analyze/validate via server; never run tools outside sandbox."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-caps-64-kb-request-p-03": {
                title: "**Caps:** ≤64 KB request payloads, ≤750 ms per job, \~1 rps/client; batch/backoff; no silent drops"
                description: "**Caps:** ≤64 KB request payloads, ≤750 ms per job, \~1 rps/client; batch/backoff; no silent drops."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-determinism-same-inp-04": {
                title: "**Determinism:** same inputs ⇒ same `plan"
                description: "**Determinism:** same inputs ⇒ same `plan.json` and artifacts; re-runs are no-ops."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-filesystems-produce--05": {
                title: "**Filesystems:** produce no symlinks; standalone/bundle copy files"
                description: "**Filesystems:** produce no symlinks; standalone/bundle copy files."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-2-implement-missing-core-make-today-s-commands-real": {
        title: "2) Implement missing core (make today’s commands real)"
        description: ""
        requirements: {
            "REQ-post-v1-validate-ass-06": {
                title: "`POST /v1/validate/assembly|epic` → `{apiVersion, ir, diagnostics[]}`"
                description: "`POST /v1/validate/assembly|epic` → `{apiVersion, ir, diagnostics[]}`"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-post-v1-plan-epic-pl-07": {
                title: "`POST /v1/plan/epic` → `{plan[], guards[], diff}`"
                description: "`POST /v1/plan/epic` → `{plan[], guards[], diff}`"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-post-v1-execute-epic-08": {
                title: "`POST /v1/execute/epic?apply=1` → `{applied, junit, report}`"
                description: "`POST /v1/execute/epic?apply=1` → `{applied, junit, report}`"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-profiles-v1-profile--09": {
                title: "Profiles: `/v1/profile/library/surface`, `/v1/profile/cli/check`"
                description: "Profiles: `/v1/profile/library/surface`, `/v1/profile/cli/check`"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-arbiter-docs-schema--10": {
                title: "`arbiter docs schema|assembly [--md|--json] --out <file>`"
                description: "`arbiter docs schema|assembly [--md|--json] --out <file>`"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-arbiter-explain-plai-11": {
                title: "`arbiter explain` (plain-English + IR JSON)"
                description: "`arbiter explain` (plain-English + IR JSON)"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-arbiter-export-json--12": {
                title: "`arbiter export --json` (machine IR for agents)"
                description: "`arbiter export --json` (machine IR for agents)"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-arbiter-integrate-gh-13": {
                title: "`arbiter integrate` (GH Actions + pre-commit; works out of the box)"
                description: "`arbiter integrate` (GH Actions + pre-commit; works out of the box)"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-arbiter-validate-exp-14": {
                title: "`arbiter validate --explain` (paths + line\:col + fix hints)"
                description: "`arbiter validate --explain` (paths + line\:col + fix hints)"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-3-requirements-spec-pipeline-bridge-the-gap": {
        title: "3) Requirements → Spec pipeline (bridge the gap)"
        description: ""
        requirements: {
            "REQ-arbiter-requirements-15": {
                title: "`arbiter requirements analyze TODO"
                description: "`arbiter requirements analyze TODO.md --out requirements.cue`"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-deterministic-parser-16": {
                title: "Deterministic parser: headings → requirement groups; bullets → requirement items; recognize tags (`Milestone:`, `Deliverable:`, `Gate:`, `Risk:`); assign stable IDs (`REQ-<slug>-NN`)"
                description: "Deterministic parser: headings → requirement groups; bullets → requirement items; recognize tags (`Milestone:`, `Deliverable:`, `Gate:`, `Risk:`); assign stable IDs (`REQ-<slug>-NN`)."
                milestone: "`"
                deliverable: true
                gate: true
                risk: true
                acceptance: [
                ]
            }
            "REQ-emit-cue-with-fields-17": {
                title: "Emit CUE with fields: `id`, `title`, `desc`, `milestone`, `acceptance`, `risks`, `links`"
                description: "Emit CUE with fields: `id`, `title`, `desc`, `milestone`, `acceptance`, `risks`, `links`."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-arbiter-spec-generat-18": {
                title: "`arbiter spec generate --from-requirements requirements"
                description: "`arbiter spec generate --from-requirements requirements.cue --template <profile> --out arbiter.assembly.cue`"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-map-requirements-to--19": {
                title: "Map requirements to `Artifact/Profile` blocks, `contracts"
                description: "Map requirements to `Artifact/Profile` blocks, `contracts.invariants`, and `tests` stubs; include **inline comments** explaining each section."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-idempotent-same-inpu-20": {
                title: "Idempotent: same input → byte-identical output"
                description: "Idempotent: same input → byte-identical output."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-arbiter-docs-assembl-21": {
                title: "`arbiter docs assembly --md --out SPECIFICATION"
                description: "`arbiter docs assembly --md --out SPECIFICATION.md`"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-render-readable-spec-22": {
                title: "Render readable spec from validated IR (tables for artifacts, gates, milestones; auto-links to requirement IDs)"
                description: "Render readable spec from validated IR (tables for artifacts, gates, milestones; auto-links to requirement IDs)."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-4-interactive-spec-building-for-green-field": {
        title: "4) Interactive spec building (for green-field)"
        description: ""
        requirements: {
            "REQ-arbiter-spec-create--23": {
                title: "`arbiter spec create --interactive`"
                description: "`arbiter spec create --interactive`"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-guided-prompts-proje-24": {
                title: "Guided prompts: project type (platform\_upgrade|library|service|cli|job), milestones, deliverables, gates, risks"
                description: "Guided prompts: project type (platform\_upgrade|library|service|cli|job), milestones, deliverables, gates, risks."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-writes-assembly-cue--25": {
                title: "Writes `assembly"
                description: "Writes `assembly.cue` with comments; re-running with same answers is a no-op."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-5-surface-extraction-make-gates-bite-fix-rust": {
        title: "5) Surface extraction (make gates bite; fix Rust)"
        description: ""
        requirements: {
            "REQ-rust-rs-try-cargo-pu-26": {
                title: "**Rust (`rs`):** try `cargo public-api` → JSON; else `rustdoc JSON` if available; else parse crate items via `syn` walk"
                description: "**Rust (`rs`):** try `cargo public-api` → JSON; else `rustdoc JSON` if available; else parse crate items via `syn` walk. Extract `pub` types, traits, fns, method sigs, feature flags."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-typescript-ts-tsc-em-27": {
                title: "**TypeScript (`ts`):** `tsc --emitDeclarationOnly` → parse `"
                description: "**TypeScript (`ts`):** `tsc --emitDeclarationOnly` → parse `.d.ts` (API names, generics, exported members)."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-python-py-pyright-cr-28": {
                title: "**Python (`py`):** `pyright --createstub` or `stubgen` → stubs → JSON surface"
                description: "**Python (`py`):** `pyright --createstub` or `stubgen` → stubs → JSON surface."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-go-go-go-list-json-g-29": {
                title: "**Go (`go`):** `go list -json "
                description: "**Go (`go`):** `go list -json ./...` + `go doc -all` → exported identifiers."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-bash-sh-parse-help-t-30": {
                title: "**Bash (`sh`):** parse `--help` trees, function names, expected exits"
                description: "**Bash (`sh`):** parse `--help` trees, function names, expected exits."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-6-dev-feedback-loop-continuous": {
        title: "6) Dev feedback loop (continuous)"
        description: ""
        requirements: {
            "REQ-watch-cue-code-tests-31": {
                title: "Watch `*"
                description: "Watch `*.cue`, code, tests; debounce 250–400 ms. On change:"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-validate-spec-surfac-32": {
                title: "validate spec → surface extract → profile gates → fast analyze touched docs"
                description: "validate spec → surface extract → profile gates → fast analyze touched docs."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-output-status-line-n-33": {
                title: "Output status line; NDJSON events:"
                description: "Output status line; NDJSON events:"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-7-tests-from-spec-make-invariants-executable": {
        title: "7) Tests from spec (make invariants executable)"
        description: ""
        requirements: {
            "REQ-produce-language-app-34": {
                title: "Produce **language-appropriate** test skeletons with idempotent markers:"
                description: "Produce **language-appropriate** test skeletons with idempotent markers:"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-python-pytest-hypoth-35": {
                title: "python (pytest + hypothesis), ts (vitest + fast-check), rust (cargo test + proptest), go (table-driven), bash (bats)"
                description: "python (pytest + hypothesis), ts (vitest + fast-check), rust (cargo test + proptest), go (table-driven), bash (bats)."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-map-contracts-invari-36": {
                title: "Map `contracts"
                description: "Map `contracts.invariants[*].cue` → property tests when inputs/outputs are declared; otherwise generate TODO with guidance."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-arbiter-tests-cover--37": {
                title: "**`arbiter tests cover`**: compute **Contract Coverage** = proven invariants / total; emit `report"
                description: "**`arbiter tests cover`**: compute **Contract Coverage** = proven invariants / total; emit `report.json` and `junit.xml`; enforce threshold in CI."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-8-traceability-requirements-spec-plan-tests-code": {
        title: "8) Traceability (requirements ⇄ spec ⇄ plan ⇄ tests ⇄ code)"
        description: ""
        requirements: {
            "REQ-assign-stable-ids-re-38": {
                title: "Assign stable IDs: `REQ-*`, `SPEC-*`, `TEST-*`, `CODE-*` (path anchors)"
                description: "Assign stable IDs: `REQ-*`, `SPEC-*`, `TEST-*`, `CODE-*` (path anchors)."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-arbiter-trace-link-b-39": {
                title: "`arbiter trace link` builds a graph: requirement IDs to `spec"
                description: "`arbiter trace link` builds a graph: requirement IDs to `spec.contracts/tests`, to generated test files/anchors, to code locations (via `// ARBITER:BEGIN/END` markers)."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-arbiter-trace-report-40": {
                title: "`arbiter trace report --out TRACE"
                description: "`arbiter trace report --out TRACE.json` summarizes coverage and gaps."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-9-version-management-semver-guidance": {
        title: "9) Version management (semver + guidance)"
        description: ""
        requirements: {
            "REQ-arbiter-version-plan-41": {
                title: "`arbiter version plan`: uses **surface delta** + spec diff to compute `required_bump` and recommended version; fail `check` if policy violated (e"
                description: "`arbiter version plan`: uses **surface delta** + spec diff to compute `required_bump` and recommended version; fail `check` if policy violated (e.g., strict library + breaking delta without MAJOR)."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-arbiter-release-dry--42": {
                title: "`arbiter release --dry-run|--apply`: compose CHANGELOG; bump versions via `arbiter sync` (pyproject/package/Cargo); for go/bash, suggest tags; never mutate `go"
                description: "`arbiter release --dry-run|--apply`: compose CHANGELOG; bump versions via `arbiter sync` (pyproject/package/Cargo); for go/bash, suggest tags; never mutate `go.mod`."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-10-ecosystem-hooks": {
        title: "10) Ecosystem hooks"
        description: ""
        requirements: {
            "REQ-arbiter-ide-recommen-43": {
                title: "`arbiter ide recommend` (VS Code extensions + tasks + problem matchers; save-time `cue fmt`)"
                description: "`arbiter ide recommend` (VS Code extensions + tasks + problem matchers; save-time `cue fmt`)."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-arbiter-sync-project-44": {
                title: "`arbiter sync`: project file updates (pyproject/package/Cargo/Makefile) from spec; idempotent"
                description: "`arbiter sync`: project file updates (pyproject/package/Cargo/Makefile) from spec; idempotent."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-arbiter-integrate-ci-45": {
                title: "`arbiter integrate`: CI with build matrices from Profile; PR → `check`; main → `preview|execute`"
                description: "`arbiter integrate`: CI with build matrices from Profile; PR → `check`; main → `preview|execute`."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-output-dir-on-all-ge-46": {
                title: "`--output-dir` on all generators (`docs`, `spec generate`, `tests generate`, `plan`)"
                description: "`--output-dir` on all generators (`docs`, `spec generate`, `tests generate`, `plan`)."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-11-outputs-always": {
        title: "11) Outputs (always)"
        description: ""
        requirements: {
            "REQ-files-plan-json-diff-47": {
                title: "Files: `plan"
                description: "Files: `plan.json`, `diff.txt`; where relevant `junit.xml`, `report.json`, `TRACE.json`, `surface.json`. Stamp `\"apiVersion\":\"arbiter.dev/v2\"`."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-ndjson-agent-mode-on-48": {
                title: "NDJSON (`--agent-mode`): one event per phase with small, stable keys"
                description: "NDJSON (`--agent-mode`): one event per phase with small, stable keys."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-12-acceptance-suite-must-pass": {
        title: "12) Acceptance suite (must pass)"
        description: ""
        requirements: {
        }
    }
    "GROUP-13-don-ts": {
        title: "13) Don’ts"
        description: ""
        requirements: {
            "REQ-don-t-exceed-caps-do-49": {
                title: "Don’t exceed caps; don’t bypass sandbox; don’t write older schemas; don’t emit symlinks; don’t generate non-idempotent edits"
                description: "Don’t exceed caps; don’t bypass sandbox; don’t write older schemas; don’t emit symlinks; don’t generate non-idempotent edits."
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-pseudocode-anchors-agent-follows": {
        title: "Pseudocode anchors (agent follows)"
        description: ""
        requirements: {
        }
    }
}

// Summary statistics
stats: {
    total_groups: 16
    total_requirements: 49
    by_milestone: {
        M1: 48
        M2: 0
        M3: 0
        M4: 0
        M5: 0
    }
}
