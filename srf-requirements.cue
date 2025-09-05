// Generated requirements from SRF analysis
// Timestamp: 2025-09-04T04:53:30.526Z
// API Version: arbiter.dev/v2
// SRF Version: 1.1
// Primary Language: s

package requirements

apiVersion: "arbiter.dev/v2"
kind: "Requirements"
metadata: {
    name: ""Foundation Complete""
    generated: "2025-09-04T04:53:30.526Z"
    source: "srf-analysis"
    srf_version: "1.1"
    primary_language: "s"
}

// SRF Technical Specifications
technical_specs: {
    languages: ["s"]
    primary_language: "s"
}

requirements: {
    "GROUP-srf-v1-1-structured-requirements-format": {
        title: "SRF v1.1 - Structured Requirements Format"
        description: ""
        requirements: {
        }
    }
    "GROUP-problem-statement": {
        title: "Problem Statement"
        description: ""
        requirements: {
        }
    }
    "GROUP-success-criteria": {
        title: "Success Criteria"
        description: ""
        requirements: {
            "REQ-deliver-10-cli-tools-01": {
                title: "Deliver 10 CLI tools with measurable SLOs and shared contracts"
                description: "Deliver 10 CLI tools with measurable SLOs and shared contracts"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-achieve-95-patch-suc-02": {
                title: "Achieve >95% patch success rate with verification"
                description: "Achieve >95% patch success rate with verification"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-maintain-120ms-p95-l-03": {
                title: "Maintain <120ms p95 latency for search operations"
                description: "Maintain <120ms p95 latency for search operations"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-enable-agent-workflo-04": {
                title: "Enable agent workflows: retrieve → build context → safe patch → analyze impact → verify"
                description: "Enable agent workflows: retrieve → build context → safe patch → analyze impact → verify"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-constraints-and-assumptions": {
        title: "Constraints and Assumptions"
        description: ""
        requirements: {
            "REQ-all-tools-built-in-r-05": {
                title: "All tools built in Rust for performance and safety"
                description: "All tools built in Rust for performance and safety"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-lens-spi-remains-the-06": {
                title: "Lens SPI remains the single source of truth for indexing"
                description: "Lens SPI remains the single source of truth for indexing"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-deterministic-output-07": {
                title: "Deterministic output required for agent reproducibility"
                description: "Deterministic output required for agent reproducibility"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-memory-and-cpu-budge-08": {
                title: "Memory and CPU budgets strictly enforced"
                description: "Memory and CPU budgets strictly enforced"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-requirements-categories": {
        title: "Requirements Categories"
        description: ""
        requirements: {
        }
    }
    "GROUP-functional-requirements": {
        title: "Functional Requirements"
        description: ""
        requirements: {
            "REQ-id-fr-001-09": {
                title: "id: \"FR-001\""
                description: "id: \"FR-001\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-any-tool-when--10": {
                title: "\"Given any tool, when executed, then output is valid JSONL with deterministic key order\""
                description: "\"Given any tool, when executed, then output is valid JSONL with deterministic key order\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-any-tool-error-11": {
                title: "\"Given any tool error, when exit codes are checked, then codes {0,2,3,4} are mapped consistently\""
                description: "\"Given any tool error, when exit codes are checked, then codes {0,2,3,4} are mapped consistently\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-a-ref-when-res-12": {
                title: "\"Given a ref, when resolved via /spi/resolve, then same slice is returned for same source_hash\""
                description: "\"Given a ref, when resolved via /spi/resolve, then same slice is returned for same source_hash\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-id-fr-002-13": {
                title: "id: \"FR-002\""
                description: "id: \"FR-002\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-k-50-query-whe-14": {
                title: "\"Given k<=50 query, when search executed, then p95 local latency < 120ms\""
                description: "\"Given k<=50 query, when search executed, then p95 local latency < 120ms\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-identical-quer-15": {
                title: "\"Given identical query, when run multiple times, then deterministic ordering including tie-breakers\""
                description: "\"Given identical query, when run multiple times, then deterministic ordering including tie-breakers\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-baseline-corpu-16": {
                title: "\"Given baseline corpus, when compared to rg+ctags, then Recall@10 ≥ baseline\""
                description: "\"Given baseline corpus, when compared to rg+ctags, then Recall@10 ≥ baseline\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-id-fr-003-17": {
                title: "id: \"FR-003\""
                description: "id: \"FR-003\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-set-of-refs-wh-18": {
                title: "\"Given set of refs, when packed, then no duplicate lines across refs in pack\""
                description: "\"Given set of refs, when packed, then no duplicate lines across refs in pack\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-context-tokens-19": {
                title: "\"Given context_tokens limit, when pack built, then pack size ≤ context_tokens\""
                description: "\"Given context_tokens limit, when pack built, then pack size ≤ context_tokens\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-matched-hits-w-20": {
                title: "\"Given matched hits, when context built, then includes symbol definitions\""
                description: "\"Given matched hits, when context built, then includes symbol definitions\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-id-fr-004-21": {
                title: "id: \"FR-004\""
                description: "id: \"FR-004\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-drifted-corpus-22": {
                title: "\"Given drifted corpus, when patches applied, then >=95% success rate\""
                description: "\"Given drifted corpus, when patches applied, then >=95% success rate\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-patch-when-re--23": {
                title: "\"Given patch, when re-applied, then results in no-op (idempotence)\""
                description: "\"Given patch, when re-applied, then results in no-op (idempotence)\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-verify-flag-wh-24": {
                title: "\"Given --verify flag, when patch applied, then verification gate passes or exit=4\""
                description: "\"Given --verify flag, when patch applied, then verification gate passes or exit=4\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-id-fr-005-25": {
                title: "id: \"FR-005\""
                description: "id: \"FR-005\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-gold-set-of-ch-26": {
                title: "\"Given gold set of changes, when impact analyzed, then Top-10 includes >80% of true impacts\""
                description: "\"Given gold set of changes, when impact analyzed, then Top-10 includes >80% of true impacts\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-impact-results-27": {
                title: "\"Given impact results, when reviewed, then outputs include reasons with xref evidence\""
                description: "\"Given impact results, when reviewed, then outputs include reasons with xref evidence\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-id-fr-006-28": {
                title: "id: \"FR-006\""
                description: "id: \"FR-006\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-medium-repos-w-29": {
                title: "\"Given medium repos, when graph queries executed, then answers return in <300ms\""
                description: "\"Given medium repos, when graph queries executed, then answers return in <300ms\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-dot-output-whe-30": {
                title: "\"Given DOT output, when validated with dot(1), then output validates successfully\""
                description: "\"Given DOT output, when validated with dot(1), then output validates successfully\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-id-fr-007-31": {
                title: "id: \"FR-007\""
                description: "id: \"FR-007\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-corpus-with-mo-32": {
                title: "\"Given corpus with moves/renames, when diff analyzed, then detection F1 ≥ 0"
                description: "\"Given corpus with moves/renames, when diff analyzed, then detection F1 ≥ 0.9\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-whitespace-onl-33": {
                title: "\"Given whitespace-only changes, when diff processed, then changes are suppressed\""
                description: "\"Given whitespace-only changes, when diff processed, then changes are suppressed\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-id-fr-008-34": {
                title: "id: \"FR-008\""
                description: "id: \"FR-008\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-symbol-rename--35": {
                title: "\"Given symbol rename, when refactored, then all references updated across repo\""
                description: "\"Given symbol rename, when refactored, then all references updated across repo\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-verify-flag-wh-36": {
                title: "\"Given --verify flag, when refactoring applied, then build/test pass\""
                description: "\"Given --verify flag, when refactoring applied, then build/test pass\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-id-fr-009-37": {
                title: "id: \"FR-009\""
                description: "id: \"FR-009\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-symbol-when-do-38": {
                title: "\"Given symbol, when docs assembled, then returns stitched note ≤ N tokens\""
                description: "\"Given symbol, when docs assembled, then returns stitched note ≤ N tokens\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-examples-neede-39": {
                title: "\"Given examples needed, when docs generated, then includes ≥2 cited refs for examples\""
                description: "\"Given examples needed, when docs generated, then includes ≥2 cited refs for examples\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-id-fr-010-40": {
                title: "id: \"FR-010\""
                description: "id: \"FR-010\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-strict-mode-wh-41": {
                title: "\"Given --strict mode, when answers provided, then two agreeing spans required\""
                description: "\"Given --strict mode, when answers provided, then two agreeing spans required\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-evaluation-set-42": {
                title: "\"Given evaluation set, when precision measured, then zero hallucinations (precision ≥ 0"
                description: "\"Given evaluation set, when precision measured, then zero hallucinations (precision ≥ 0.99)\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-id-fr-011-43": {
                title: "id: \"FR-011\""
                description: "id: \"FR-011\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-degraded-healt-44": {
                title: "\"Given degraded /health endpoint, when writes attempted, then writes are blocked\""
                description: "\"Given degraded /health endpoint, when writes attempted, then writes are blocked\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-given-budget-ms-limi-45": {
                title: "\"Given budget_ms limit, when exceeded, then returns timed_out:true\""
                description: "\"Given budget_ms limit, when exceeded, then returns timed_out:true\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-non-functional-requirements": {
        title: "Non-Functional Requirements"
        description: ""
        requirements: {
        }
    }
    "GROUP-architecture-design": {
        title: "Architecture & Design"
        description: ""
        requirements: {
            "REQ-name-lens-cli-sdk-46": {
                title: "name: \"lens-cli-sdk\""
                description: "name: \"lens-cli-sdk\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-name-sripgrep-47": {
                title: "name: \"sripgrep\""
                description: "name: \"sripgrep\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-name-scontext-48": {
                title: "name: \"scontext\""
                description: "name: \"scontext\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-name-spatch-49": {
                title: "name: \"spatch\""
                description: "name: \"spatch\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-name-simpact-50": {
                title: "name: \"simpact\""
                description: "name: \"simpact\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-name-sgraph-51": {
                title: "name: \"sgraph\""
                description: "name: \"sgraph\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-name-sdiffx-52": {
                title: "name: \"sdiffx\""
                description: "name: \"sdiffx\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-name-srefactor-53": {
                title: "name: \"srefactor\""
                description: "name: \"srefactor\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-name-sdoc-54": {
                title: "name: \"sdoc\""
                description: "name: \"sdoc\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-name-sqa-55": {
                title: "name: \"sqa\""
                description: "name: \"sqa\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-name-shealth-56": {
                title: "name: \"shealth\""
                description: "name: \"shealth\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-name-lens-spi-57": {
                title: "name: \"Lens SPI\""
                description: "name: \"Lens SPI\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-api-specifications": {
        title: "API Specifications"
        description: ""
        requirements: {
            "REQ-path-search-58": {
                title: "path: \"/search\""
                description: "path: \"/search\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-path-context-59": {
                title: "path: \"/context\""
                description: "path: \"/context\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-path-resolve-60": {
                title: "path: \"/resolve\""
                description: "path: \"/resolve\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-path-xref-61": {
                title: "path: \"/xref\""
                description: "path: \"/xref\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-name-searchreq-62": {
                title: "name: \"SearchReq\""
                description: "name: \"SearchReq\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-name-searchresp-63": {
                title: "name: \"SearchResp\""
                description: "name: \"SearchResp\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-quality-assurance": {
        title: "Quality Assurance"
        description: ""
        requirements: {
        }
    }
    "GROUP-operations-deployment": {
        title: "Operations & Deployment"
        description: ""
        requirements: {
            "REQ-name-command-duratio-64": {
                title: "name: \"command_duration_seconds\""
                description: "name: \"command_duration_seconds\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-name-memory-usage-by-65": {
                title: "name: \"memory_usage_bytes\""
                description: "name: \"memory_usage_bytes\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-name-api-requests-to-66": {
                title: "name: \"api_requests_total\""
                description: "name: \"api_requests_total\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-risk-assessment": {
        title: "Risk Assessment"
        description: ""
        requirements: {
            "REQ-id-risk-001-67": {
                title: "id: \"RISK-001\""
                description: "id: \"RISK-001\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-id-risk-002-68": {
                title: "id: \"RISK-002\""
                description: "id: \"RISK-002\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-id-risk-003-69": {
                title: "id: \"RISK-003\""
                description: "id: \"RISK-003\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-validation-criteria": {
        title: "Validation Criteria"
        description: ""
        requirements: {
            "REQ-scenario-fast-search-70": {
                title: "scenario: \"Fast search under budget\""
                description: "scenario: \"Fast search under budget\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-scenario-token-bound-71": {
                title: "scenario: \"Token-bounded context pack\""
                description: "scenario: \"Token-bounded context pack\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-scenario-safe-patch--72": {
                title: "scenario: \"Safe patch with verification\""
                description: "scenario: \"Safe patch with verification\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-metric-search-latenc-73": {
                title: "metric: \"search_latency_p95\""
                description: "metric: \"search_latency_p95\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-metric-patch-success-74": {
                title: "metric: \"patch_success_rate\""
                description: "metric: \"patch_success_rate\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-metric-memory-usage--75": {
                title: "metric: \"memory_usage_peak\""
                description: "metric: \"memory_usage_peak\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-gate-test-coverage-76": {
                title: "gate: \"Test Coverage\""
                description: "gate: \"Test Coverage\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-gate-performance-slo-77": {
                title: "gate: \"Performance SLO\""
                description: "gate: \"Performance SLO\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-gate-documentation-c-78": {
                title: "gate: \"Documentation Completeness\""
                description: "gate: \"Documentation Completeness\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-appendices": {
        title: "Appendices"
        description: ""
        requirements: {
        }
    }
    "GROUP-glossary": {
        title: "Glossary"
        description: ""
        requirements: {
            "REQ-ref-stable-uri-to-a--79": {
                title: "**ref**: Stable URI to a code slice: `lens://{repo_sha}/{path}@{source_hash}#B{start}:{end}|AST:{path}`"
                description: "**ref**: Stable URI to a code slice: `lens://{repo_sha}/{path}@{source_hash}#B{start}:{end}|AST:{path}`"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-budget-cpu-wall-toke-80": {
                title: "**budget**: CPU/wall/token caps for a call"
                description: "**budget**: CPU/wall/token caps for a call"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-pack-token-bounded-d-81": {
                title: "**pack**: Token-bounded, deduped context bundle"
                description: "**pack**: Token-bounded, deduped context bundle"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-invariants-post-cond-82": {
                title: "**invariants**: Post-conditions required after an edit"
                description: "**invariants**: Post-conditions required after an edit"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-references": {
        title: "References"
        description: ""
        requirements: {
            "REQ-srf-h-v1-1-md-specif-83": {
                title: "SRF-H v1"
                description: "SRF-H v1.1.md specification"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-lens-spi-documentati-84": {
                title: "Lens SPI documentation"
                description: "Lens SPI documentation"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-agent-tool-integrati-85": {
                title: "Agent tool integration plans"
                description: "Agent tool integration plans"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-tree-sitter-grammar--86": {
                title: "Tree-sitter grammar specifications"
                description: "Tree-sitter grammar specifications"
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
    "GROUP-change-log": {
        title: "Change Log"
        description: ""
        requirements: {
            "REQ-version-1-1-0-87": {
                title: "version: \"1"
                description: "version: \"1.1.0\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
            "REQ-version-1-1-1-88": {
                title: "version: \"1"
                description: "version: \"1.1.1\""
                milestone: "M1"
                deliverable: false
                gate: false
                risk: false
                acceptance: [
                ]
            }
        }
    }
}

// Summary statistics
stats: {
    total_groups: 17
    total_requirements: 88
    by_milestone: {
        M1: 88
        M2: 0
        M3: 0
        M4: 0
        M5: 0
    }
    srf_detected: false
    languages_detected: 1
    artifacts_specified: 0
}
