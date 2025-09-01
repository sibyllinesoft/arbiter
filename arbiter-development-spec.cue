// Arbiter Development Specification
// Formalized spec based on TODO.md Master Plan v4
// API Version: arbiter.dev/v2

package arbiter

import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

// Project Metadata
apiVersion: "arbiter.dev/v2"
kind: "Epic"
metadata: {
    name: "arbiter-implementation-epic"
    title: "Complete End-to-End Arbiter Implementation"
    version: "4.0.0"
    description: "Close the loop end-to-end: Requirements → Spec → Plan → Execute → Test → Trace pipeline"
}

// Golden Path User Workflow
workflow: {
    name: "golden-path"
    description: "What the user should be able to do"
    steps: [
        {
            command: "arbiter requirements analyze TODO.md --out requirements.cue"
            output: "requirements.cue"
        },
        {
            command: "arbiter spec generate --from-requirements requirements.cue --template <profile> --out arbiter.assembly.cue"
            output: "arbiter.assembly.cue"
        },
        {
            command: "arbiter check"
            description: "validate & profile gates"
        },
        {
            command: "arbiter docs assembly --md --out SPECIFICATION.md"
            output: "SPECIFICATION.md"
        },
        {
            command: "arbiter plan milestone M1 --out M1_IMPLEMENTATION.md"
            output: "M1_IMPLEMENTATION.md"
        },
        {
            command: "arbiter tests generate --from-assembly --language rust --out tests/"
            output: "tests/"
        },
        {
            command: "arbiter watch"
            description: "continuous validate/surface/gates"
        },
        {
            command: "arbiter integrate"
            description: "CI/pre-commit wiring"
        }
    ]
}

// System Constraints (Rails)
constraints: {
    versioning: {
        rule: "treat missing apiVersion/kind as v0 on read; always write latest envelope"
        enforcement: "mandatory"
    }
    execution: {
        rule: "all analyze/validate via server; never run tools outside sandbox"
        enforcement: "mandatory"
    }
    performance: {
        maxRequestSize: "64KB"
        maxResponseTime: "750ms"
        rateLimit: "~1 rps/client"
        enforcement: "batch/backoff; no silent drops"
    }
    determinism: {
        rule: "same inputs ⇒ same plan.json and artifacts; re-runs are no-ops"
        enforcement: "mandatory"
    }
    filesystem: {
        rule: "produce no symlinks; standalone/bundle copy files"
        enforcement: "mandatory"
    }
}

// Core Implementation Requirements
requirements: {
    
    // REQ-SERVER-01: Server Endpoints
    "REQ-SERVER-01": {
        title: "Stable JSON Server Endpoints"
        description: "Implement core server endpoints with stable JSON APIs"
        acceptance: [
            "POST /v1/validate/assembly|epic → {apiVersion, ir, diagnostics[]}",
            "POST /v1/plan/epic → {plan[], guards[], diff}",
            "POST /v1/execute/epic?apply=1 → {applied, junit, report}",
            "Profiles: /v1/profile/library/surface, /v1/profile/cli/check"
        ]
        milestone: "M1"
    }

    // REQ-CLI-01: CLI Commands
    "REQ-CLI-01": {
        title: "Complete CLI Implementation"
        description: "Implement all missing CLI commands"
        acceptance: [
            "arbiter docs schema|assembly [--md|--json] --out <file>",
            "arbiter explain (plain-English + IR JSON)",
            "arbiter export --json (machine IR for agents)",
            "arbiter integrate (GH Actions + pre-commit; works out of the box)",
            "arbiter validate --explain (paths + line:col + fix hints)"
        ]
        gate: "none of these returns 'not implemented'; each writes artifacts and NDJSON (--agent-mode)"
        milestone: "M1"
    }

    // REQ-PIPELINE-01: Requirements Analysis
    "REQ-PIPELINE-01": {
        title: "Requirements → Spec Pipeline"
        description: "Bridge the gap from requirements to specification"
        components: {
            requirements_analysis: {
                command: "arbiter requirements analyze TODO.md --out requirements.cue"
                parser: "Deterministic parser: headings → requirement groups; bullets → requirement items"
                recognition: "recognize tags (Milestone:, Deliverable:, Gate:, Risk:)"
                id_assignment: "assign stable IDs (REQ-<slug>-NN)"
                output_format: "Emit CUE with fields: id, title, desc, milestone, acceptance, risks, links"
            }
            spec_generation: {
                command: "arbiter spec generate --from-requirements requirements.cue --template <profile> --out arbiter.assembly.cue"
                mapping: "Map requirements to Artifact/Profile blocks, contracts.invariants, and tests stubs"
                documentation: "include inline comments explaining each section"
                idempotency: "same input → byte-identical output"
            }
            assembly_docs: {
                command: "arbiter docs assembly --md --out SPECIFICATION.md"
                rendering: "Render readable spec from validated IR"
                format: "tables for artifacts, gates, milestones; auto-links to requirement IDs"
            }
        }
        milestone: "M2"
    }

    // REQ-INTERACTIVE-01: Interactive Spec Building
    "REQ-INTERACTIVE-01": {
        title: "Interactive Spec Building"
        description: "For green-field projects"
        command: "arbiter spec create --interactive"
        features: [
            "Guided prompts: project type (platform_upgrade|library|service|cli|job)",
            "Configure milestones, deliverables, gates, risks",
            "Writes assembly.cue with comments",
            "Re-running with same answers is a no-op"
        ]
        milestone: "M2"
    }

    // REQ-SURFACE-01: Surface Extraction
    "REQ-SURFACE-01": {
        title: "Surface Extraction (Fix Rust)"
        description: "Make gates bite; fix Rust support"
        command: "arbiter surface [--lang <py|ts|rs|go|sh>] --out surface.json"
        strategies: {
            rust: {
                priority: ["cargo public-api → JSON", "rustdoc JSON if available", "parse crate items via syn walk"]
                extract: "pub types, traits, fns, method sigs, feature flags"
            }
            typescript: {
                strategy: "tsc --emitDeclarationOnly → parse .d.ts"
                extract: "API names, generics, exported members"
            }
            python: {
                strategy: "pyright --createstub or stubgen → stubs → JSON surface"
            }
            go: {
                strategy: "go list -json ./... + go doc -all → exported identifiers"
            }
            bash: {
                strategy: "parse --help trees, function names, expected exits"
            }
        }
        features: [
            "Compute delta and required_bump",
            "Wire into arbiter check, arbiter version plan, and watch"
        ]
        acceptance: "real rust/ts/go/python projects produce non-empty surfaces with stable JSON; breaking changes trigger MAJOR recommendations"
        milestone: "M3"
    }

    // REQ-WATCH-01: Continuous Development Loop
    "REQ-WATCH-01": {
        title: "Dev Feedback Loop (Continuous)"
        command: "arbiter watch"
        behavior: [
            "Watch *.cue, code, tests; debounce 250–400 ms",
            "On change: validate spec → surface extract → profile gates → fast analyze touched docs",
            "Output status line; NDJSON events"
        ]
        output_format: "{'phase':'watch','changed':[...], 'validate':{ok}, 'surface':{delta}, 'gates':{pass}}"
        milestone: "M3"
    }

    // REQ-TESTS-01: Tests from Specification
    "REQ-TESTS-01": {
        title: "Tests from Spec (Make Invariants Executable)"
        command: "arbiter tests generate --from-assembly --language <lang> --out tests/"
        features: [
            "Produce language-appropriate test skeletons with idempotent markers",
            "Support: python (pytest + hypothesis), ts (vitest + fast-check), rust (cargo test + proptest), go (table-driven), bash (bats)",
            "Map contracts.invariants[*].cue → property tests when inputs/outputs are declared",
            "Generate TODO with guidance for unmappable invariants"
        ]
        coverage_command: "arbiter tests cover"
        coverage_metric: "Contract Coverage = proven invariants / total"
        outputs: ["report.json", "junit.xml"]
        enforcement: "enforce threshold in CI"
        milestone: "M4"
    }

    // REQ-TRACE-01: Traceability
    "REQ-TRACE-01": {
        title: "Traceability (requirements ⇄ spec ⇄ plan ⇄ tests ⇄ code)"
        id_assignment: [
            "Assign stable IDs: REQ-*, SPEC-*, TEST-*, CODE-* (path anchors)"
        ]
        link_building: "arbiter trace link builds a graph: requirement IDs to spec.contracts/tests, to generated test files/anchors, to code locations (via // ARBITER:BEGIN/END markers)"
        reporting: "arbiter trace report --out TRACE.json summarizes coverage and gaps"
        milestone: "M4"
    }

    // REQ-VERSION-01: Version Management
    "REQ-VERSION-01": {
        title: "Version Management (semver + guidance)"
        plan_command: "arbiter version plan: uses surface delta + spec diff to compute required_bump and recommended version"
        enforcement: "fail check if policy violated (e.g., strict library + breaking delta without MAJOR)"
        release_command: "arbiter release --dry-run|--apply: compose CHANGELOG; bump versions via arbiter sync"
        language_support: "for go/bash, suggest tags; never mutate go.mod"
        milestone: "M5"
    }

    // REQ-ECOSYSTEM-01: Ecosystem Hooks
    "REQ-ECOSYSTEM-01": {
        title: "Ecosystem Integration"
        features: [
            "arbiter ide recommend (VS Code extensions + tasks + problem matchers; save-time cue fmt)",
            "arbiter sync: project file updates (pyproject/package/Cargo/Makefile) from spec; idempotent",
            "arbiter integrate: CI with build matrices from Profile; PR → check; main → preview|execute",
            "--output-dir on all generators (docs, spec generate, tests generate, plan)"
        ]
        milestone: "M5"
    }
}

// Milestones
milestones: {
    "M1": {
        title: "Core Foundation"
        description: "Server endpoints and basic CLI commands"
        deliverables: ["REQ-SERVER-01", "REQ-CLI-01"]
        gates: [
            "All server endpoints return valid JSON",
            "No CLI command returns 'not implemented'",
            "NDJSON agent mode works for all commands"
        ]
        acceptance: "Complete workflow demo possible"
    }
    
    "M2": {
        title: "Requirements Pipeline"
        description: "Requirements analysis and spec generation"
        deliverables: ["REQ-PIPELINE-01", "REQ-INTERACTIVE-01"]
        dependencies: ["M1"]
        gates: [
            "TODO.md → requirements.cue works",
            "requirements.cue → assembly.cue works",
            "Generated specs are byte-identical on re-run"
        ]
    }
    
    "M3": {
        title: "Surface Analysis & Watch"
        description: "Language surface extraction and continuous feedback"
        deliverables: ["REQ-SURFACE-01", "REQ-WATCH-01"]
        dependencies: ["M2"]
        gates: [
            "Rust surface extraction produces non-empty results",
            "Watch mode updates within 3 seconds",
            "Breaking changes trigger MAJOR version recommendations"
        ]
    }
    
    "M4": {
        title: "Testing & Traceability"
        description: "Test generation and requirement tracing"
        deliverables: ["REQ-TESTS-01", "REQ-TRACE-01"]
        dependencies: ["M3"]
        gates: [
            "Generated tests are runnable",
            "Contract coverage computable",
            "Full traceability chain works"
        ]
    }
    
    "M5": {
        title: "Ecosystem Integration"
        description: "Version management and toolchain integration"
        deliverables: ["REQ-VERSION-01", "REQ-ECOSYSTEM-01"]
        dependencies: ["M4"]
        gates: [
            "Semver analysis works",
            "IDE integration generates working configs",
            "CI integration works out of the box"
        ]
    }
}

// Acceptance Criteria (Must Pass)
acceptance_suite: {
    "TEST-WORKFLOW": {
        description: "Workflow demo: TODO.md → requirements.cue → assembly.cue → SPECIFICATION.md → M1_IMPLEMENTATION.md → tests → green check on a sample repo"
        type: "integration"
    }
    "TEST-RUST-SURFACE": {
        description: "Rust surface: non-empty extraction; a deliberate breaking change flips required_bump=MAJOR"
        type: "unit"
    }
    "TEST-WATCH": {
        description: "Watch: edit file → validate/surface/gates update in ≤3 s"
        type: "performance"
    }
    "TEST-TESTS": {
        description: "Tests: tests generate produces runnable suites; tests cover computes Contract Coverage"
        type: "integration"
    }
    "TEST-TRACE": {
        description: "Traceability: TRACE.json links REQ→SPEC→TEST→CODE with no dangling IDs"
        type: "integration"
    }
    "TEST-DETERMINISM": {
        description: "Determinism: identical inputs yield byte-identical outputs across two runs"
        type: "consistency"
    }
    "TEST-COMMANDS": {
        description: "No 'not implemented' across commands listed in requirements"
        type: "completeness"
    }
}

// System Architecture
architecture: {
    layers: {
        cli: {
            description: "Command-line interface layer"
            technology: "Node.js/TypeScript with commander.js"
            responsibilities: [
                "Parse command-line arguments",
                "Format output for human/agent consumption",
                "Handle file I/O operations",
                "Communicate with API server"
            ]
        }
        api: {
            description: "Core API server layer"
            technology: "Bun with Elysia framework"
            responsibilities: [
                "Process validation requests",
                "Execute CUE operations in sandbox",
                "Manage surface extraction",
                "Handle profile operations"
            ]
        }
        analysis: {
            description: "Language analysis and surface extraction"
            technology: "Multi-language (Python, TypeScript, Rust tooling)"
            responsibilities: [
                "Extract API surfaces from code",
                "Compute semantic diffs",
                "Generate test scaffolding",
                "Perform static analysis"
            ]
        }
        storage: {
            description: "Configuration and state management"
            technology: "CUE configuration language"
            responsibilities: [
                "Store specifications and profiles",
                "Maintain traceability links",
                "Version management metadata",
                "Contract definitions"
            ]
        }
    }
}

// Quality Gates
contracts: {
    invariants: [
        {
            name: "performance_limits"
            description: "All operations must respect performance constraints"
            rules: [
                "Request payload ≤ 64KB",
                "Response time ≤ 750ms",
                "Rate limit ~1 rps/client"
            ]
        },
        {
            name: "determinism"
            description: "Operations must be deterministic"
            rules: [
                "Same inputs produce identical outputs",
                "Re-runs are no-ops",
                "No side effects in validation"
            ]
        },
        {
            name: "completeness"
            description: "No unimplemented functionality"
            rules: [
                "All documented commands work",
                "Error messages are helpful",
                "Agent mode produces valid NDJSON"
            ]
        }
    ]
}

// Risk Management
risks: [
    {
        id: "RISK-PERFORMANCE"
        description: "Performance constraints may be too restrictive for complex operations"
        probability: "medium"
        impact: "high"
        mitigation: "Implement streaming and batching for large operations"
    },
    {
        id: "RISK-SURFACE-EXTRACTION"
        description: "Language-specific surface extraction may be unreliable"
        probability: "high"
        impact: "medium"
        mitigation: "Implement fallback strategies for each language"
    },
    {
        id: "RISK-DETERMINISM"
        description: "External dependencies may introduce non-determinism"
        probability: "medium"
        impact: "high"
        mitigation: "Sandbox all operations and control dependency versions"
    }
]

// Output Specifications
outputs: {
    always_generate: [
        "plan.json",
        "diff.txt",
        "junit.xml",
        "report.json", 
        "TRACE.json",
        "surface.json"
    ]
    format: {
        apiVersion: "arbiter.dev/v2"
        agent_mode: "NDJSON with small, stable keys"
    }
}

// Don'ts (Anti-patterns to Avoid)
anti_patterns: [
    "Don't exceed caps",
    "Don't bypass sandbox", 
    "Don't write older schemas",
    "Don't emit symlinks",
    "Don't generate non-idempotent edits"
]