// Rails & Guarantees v1.0 RC - Formal Development Specification
// Generated: 2025-09-01 - Arbiter Framework Development Specification

import "github.com/arbiter-framework/schemas/artifact"
import "github.com/arbiter-framework/schemas/profiles"

// =============================================================================
// PROJECT METADATA & VERSIONING
// =============================================================================

// Artifact definition - Multi-component system (CLI + Service + UI)
Artifact: artifact.#Artifact & {
  kind: "service" // Primary artifact type, but contains CLI and UI components
  name: "arbiter"
  language: "typescript"
  
  // Version constraints and compatibility
  versions: {
    api_version: "v1.0.0-rc.1"
    schema_version: "v2.0.0" 
    contract_version: "v1.0.0"
    ticket_format: "v1.0.0"
  }
  
  build: {
    tool: "bun"
    targets: ["apps/api", "apps/web", "packages/cli"]
    deterministic: true
    reproducible: true
    matrix: {
      versions: ["latest"]
      os: ["linux", "darwin"]
      arch: ["amd64", "arm64"]
    }
  }
  
  packaging: {
    publish: true
    registry: "npm"
    artifact: "npm"
    provenance: true
    sbom: true
  }
}

// =============================================================================
// RAILS & GUARANTEES v1.0 RC SPECIFICATION
// =============================================================================

Profile: profiles.#service & {
  // Service configuration
  endpoints: [
    {path: "/health", method: "GET", purpose: "Health check"},
    {path: "/api/v1/validate", method: "POST", purpose: "Ticket validation"},
    {path: "/api/v1/surface", method: "GET", purpose: "API surface extraction"},
    {path: "/api/v1/trace", method: "POST", purpose: "Traceability analysis"}
  ]
  healthCheck: "/health"
  
  // =============================================================================
  // SECTION 1: VERSION & COMPATIBILITY REQUIREMENTS
  // =============================================================================
  
  compatibility: {
    enforce_compat_check: true
    fail_on_mismatch: true
    allow_compat_flag: "--allow-compat"
    migration_support: true
    
    versions: {
      api_version: "v1.0.0-rc.1"
      schema_version: "v2.0.0"
      contract_version: "v1.0.0" 
      ticket_format: "v1.0.0"
    }
    
    migration: {
      command: "arbiter migrate --from vX --to vY"
      support_noop: true // v1→v1 no-op migrations
    }
  }

  // =============================================================================
  // SECTION 2: SECURITY & TICKET HARDENING
  // =============================================================================
  
  security: {
    ticket_system: {
      // Cryptographic security model
      signature_algorithm: "HMAC-SHA256"
      canonical_format: "sorted_hunks|LF_newlines|UTF8|no_BOM"
      
      // Ticket structure: HMAC(key, canonical_patch || base_commit || repo_id || nonce || exp)
      ticket_format: {
        hmac: "HMAC(kid:key, base_commit|repo_id|nonce|exp|patch)"
        ttl_enforcement: true
        nonce_uniqueness: true 
        base_commit_binding: true
        
        // Anti-replay protection
        replay_defense: {
          persist_nonces: "(repo_id, nonce)"
          retention_period: "exp + grace_period"
          reject_duplicates: true
        }
      }
      
      // Key management
      key_rotation: {
        accept_multiple_kids: true
        dual_validation_window: true
        rotation_command: "arbiter rotate-keys"
        audit_log: "ticket_id, kid, verifier"
      }
      
      // Validation enforcement
      hooks: {
        pre_commit_local: true
        pre_receive_server: true // MUST validate server-side again
        server_re_verification: true
      }
    }
    
    // Build security
    reproducible_builds: {
      pinned_locks: true
      provenance_generation: true 
      sbom_generation: true
      license_scanning: true
      fail_on_criticals: true
      sast_scanning: true // Semgrep
    }
  }

  // =============================================================================
  // SECTION 3: PERFORMANCE & VALIDATION REQUIREMENTS  
  // =============================================================================
  
  performance: {
    // Global performance budget
    budgets: {
      payload_size_max: "64KB"
      end_to_end_max: "750ms"
      target_latency: "400ms" // aim far lower than budget
      watch_loop_rate: "1rps"
    }
    
    // Performance SLOs
    slos: {
      ticket_verify_p95: "25ms"
      full_validate_p95: "400ms" 
      stream_start_max: "100ms"
      false_negatives: "0" // in golden set
    }
    
    // Incremental validation system
    incremental_validation: {
      cache_compiled_cue: true
      cache_contract_bytecode: true
      cache_key_format: "(file_hash, schema_version)"
      validate_changed_only: true
      
      // Batching and coalescing  
      batch_events: {
        coalesce_window: "100-200ms"
        batch_per_package: true
        batch_per_module: true
      }
      
      // Parallelism and worker management
      worker_pools: {
        per_rule_workers: true
        back_pressure_control: true
        cpu_core_limit: true
        ndjson_streaming: true
        real_time_results: true
      }
      
      // Caching strategy
      hot_caches: {
        lru_ui_profiles: true
        lru_contract_bytecode: true  
        lru_design_tokens: true
        warm_common_rulesets: true
      }
      
      // Fast path optimizations
      fast_paths: {
        content_hash_shortcuts: true
        clean_artifact_cache: "(content_hash) → verdict"
        memory_mapped_reads: true
        avoid_extra_copies: true
        canonicalize_once: true
      }
    }
    
    // Telemetry and monitoring
    telemetry: {
      stage_timers: ["ticket_verify", "schema_check", "contract_run", "budgets", "docs"]
      metrics: ["p50", "p95", "p99"]
      export_format: "metrics.json"
    }
  }

  // =============================================================================
  // SECTION 4: TESTING & QUALITY GATES
  // =============================================================================
  
  testing: {
    // Test coverage requirements
    coverage: {
      minimum_threshold: "85%"
      fail_under_threshold: true
      line_coverage: true
      branch_coverage: true
    }
    
    // Test types and requirements
    test_types: {
      // Golden test corpus for canonicalization
      golden_tests: {
        patch_canonicalization: true
        corpus_location: "tests/golden/"
        reject_non_canonical: true
        auto_fix_mode: true
      }
      
      // Property tests for contracts
      property_tests: {
        pre_post_conditions: true
        metamorphic_invariants: true
        fault_injection: true
        run_in_ci: true
      }
      
      // Fuzz testing
      fuzz_tests: {
        patch_parser: true
        input_validation: true
      }
      
      // Metamorphic testing
      metamorphic_tests: {
        operations: ["rename", "move", "reformat"]
        invariant: "verdicts_unchanged"
        stability_requirement: true
      }
    }
    
    // CI failure conditions
    ci_gates: {
      coverage_below_85: "fail"
      p95_validate_over_400ms: "fail"
      compat_errors: "fail"
      false_negatives_in_gold: "fail"
      critical_cves: "fail"
      license_violations: "fail"
    }
  }

  // =============================================================================
  // SECTION 5: CONTRACTS & VALIDATION RULES
  // =============================================================================
  
  contracts: {
    forbidBreaking: true
    deterministic_outputs: true
    
    invariants: [
      {
        name: "ticket_ttl_enforcement"
        description: "All tickets must respect TTL and expire appropriately"
        rule: "ticket.exp > now() && ticket.exp < (now() + max_ttl)"
      },
      {
        name: "nonce_uniqueness"
        description: "Nonces must be unique per repo within TTL window"
        rule: "unique(repo_id, nonce) within ttl_window"
      },
      {
        name: "canonical_patch_format"
        description: "All patches must be in canonical format before HMAC"
        rule: "patch == canonicalize(patch)"
      },
      {
        name: "performance_budget_adherence"
        description: "All operations must complete within performance budget"
        rule: "operation_time <= budget_time"
      },
      {
        name: "incremental_validation_correctness"
        description: "Incremental validation must produce same results as full validation"
        rule: "incremental_result == full_validation_result"
      }
    ]
    
    // Schema validation
    schema_validation: {
      cue_schema_lock: true
      property_tests: true
      metamorphic_invariants: true
    }
    
    // Canonicalization requirements
    canonicalization: {
      single_canonical_format: true
      sorted_hunks: true
      lf_newlines: true
      utf8_encoding: true
      no_bom: true
      hash_after_canonicalization: true
      golden_test_corpus: true
    }
  }

  // =============================================================================
  // SECTION 6: ARTIFACTS & OUTPUTS
  // =============================================================================
  
  artifacts: {
    required_outputs: [
      "metrics.json",
      "traces.ndjson", 
      "sbom.json",
      "compat_report.json",
      "report.md"
    ]
    
    build_artifacts: {
      container: true
      tarball: true
      provenance: true
      documentation: ["Quickstart", "Integration", "Runbook"]
    }
    
    release_procedure: {
      full_suite_run: true
      artifact_collection: true
      compat_check: "last_two_bundles"
      green_gates_required: ["security", "compat", "sbom", "coverage", "p95_p99"]
      tag_format: "v1.0.0-rc.1"
      monitor_nightly: true
      promotion_criteria: "3_consecutive_green_runs"
    }
  }

  // =============================================================================
  // SECTION 7: ALERTS & MONITORING
  // =============================================================================
  
  monitoring: {
    alerts: [
      {
        condition: "p99 > 2 * p95"
        action: "performance_degradation_alert"
      },
      {
        condition: "false_negatives > 0"
        action: "quality_failure_alert"
      },
      {
        condition: "compat_failures > 0"  
        action: "compatibility_break_alert"
      },
      {
        condition: "replay_attempt_detected"
        action: "security_incident_alert"
      }
    ]
    
    slo_monitoring: {
      response_time_p95: "400ms"
      ticket_verify_p95: "25ms"
      availability: "99.9%"
      error_budget: "0.1%"
    }
  }

  // =============================================================================
  // COMPLETION CRITERIA
  // =============================================================================
  
  acceptance_criteria: {
    all_gates_green: [
      "security_scan_pass",
      "compat_check_pass", 
      "sbom_generation_complete",
      "coverage_above_85_percent",
      "p95_under_400ms",
      "p99_within_slo"
    ]
    docs_published: true
    upgrade_path_verified: true
    
    // Post-GA considerations
    post_ga: {
      native_perf_toggles: "behind_flags"
      broader_language_coverage: "follow_up_sprint"
      deeper_contract_libraries: "follow_up_sprint"
    }
  }
}
