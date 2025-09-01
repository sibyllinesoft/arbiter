// Validation gates and enforcement contracts
// Implements the enforcement algorithms from TODO.md

package contracts

// API surface diff validation for libraries
APIValidation: {
  // Surface extraction configuration per language
  extractors: {
    typescript: {
      tool: "api-extractor"
      command: "api-extractor run --local"
      output: "./dist/api-surface.json"
      types: ["function", "class", "interface", "type", "enum", "namespace"]
    }
    go: {
      tool: "go-doc"
      command: "go doc -all ./..."
      output: "./api-surface.json"
      types: ["func", "type", "const", "var"]
    }
    rust: {
      tool: "cargo-doc"
      command: "cargo doc --no-deps"
      output: "./target/doc/api-surface.json"
      types: ["fn", "struct", "enum", "trait", "mod"]
    }
  }
  
  // Breaking change detection rules
  breakingChanges: {
    // Function/method signature changes
    signatures: {
      removedFunction: "breaking"
      changedParameters: "breaking"  
      changedReturnType: "breaking"
      removedParameter: "breaking"
      addedRequiredParameter: "breaking"
    }
    
    // Type definition changes
    types: {
      removedType: "breaking"
      changedFields: "breaking"
      removedField: "breaking"
      changedFieldType: "breaking"
      addedRequiredField: "breaking"
    }
    
    // Interface/trait changes
    interfaces: {
      removedMethod: "breaking"
      addedRequiredMethod: "breaking"
      changedMethodSignature: "breaking"
    }
  }
  
  // Version bump requirements
  versionRules: {
    breaking: "major"
    additive: "minor"
    bugfix: "patch"
    internal: "patch"
  }
  
  // Validation gate implementation
  gate: {
    // Required: Δ = surface_new - surface_old
    surfaceDiff: {
      command: "diff-api-surface ${SURFACE_OLD} ${SURFACE_NEW}"
      output: "./analysis/surface-diff.json"
    }
    
    // Gate logic: (requested_version_bump >= required_bump(Δ))
    validate: """
      let diff = surfaceDiff.changes
      let required_bump = determineRequiredBump(diff)
      let requested_bump = epic.version_bump
      
      pass: requested_bump >= required_bump && invariants_all_true
      message: "Version bump \(requested_bump) insufficient for changes requiring \(required_bump)"
      """
  }
}

// CLI contract test enforcement  
CLIValidation: {
  // Command table compilation
  commandTable: {
    // Extract from Profile.cli.commands
    generator: "compile-command-table"
    output: "./analysis/command-table.json"
    includes: ["args", "flags", "exits", "io"]
  }
  
  // Golden test runner
  goldenTests: {
    runner: "cli-test-runner"
    sandbox: true
    timeout: "30s"
    
    // Test execution per command
    execution: {
      setup: "mkdir -p ./test/temp && cd ./test/temp"
      command: "${CMD}"
      assertions: [
        "exit_code == expected.wantCode",
        "stdout matches expected.wantOut || expected.wantRE",
        "stderr matches expected.wantErr || ''"
      ]
      cleanup: "cd .. && rm -rf ./test/temp"
    }
  }
  
  // Auto-generated help tests
  helpTests: {
    generator: "generate-help-tests"
    
    // Generate --help golden test for each command
    template: {
      cmd: "${COMMAND} --help"
      wantCode: 0
      wantOut: "*${COMMAND_SUMMARY}*"
    }
  }
  
  // Property-based CLI tests
  propertyTests: {
    runner: "property-test-runner"
    
    // Universal CLI properties
    properties: [
      {
        name: "help_consistency"
        rule: "all commands with --help exit 0"
        test: "for cmd in commands: assert run(cmd + ' --help').exit_code == 0"
      },
      {
        name: "version_consistency" 
        rule: "--version shows consistent format"
        test: "version_output matches /^\\d+\\.\\d+\\.\\d+/"
      },
      {
        name: "error_codes"
        rule: "error exits use non-zero codes"
        test: "all error_conditions: exit_code != 0"
      }
    ]
  }
}

// Job execution validation
JobValidation: {
  // Resource enforcement
  resourceLimits: {
    enforcer: "cgroup-limiter"
    
    limits: {
      cpu: "from Profile.job.resources.cpu"
      memory: "from Profile.job.resources.mem"
      wallTime: "from Profile.job.resources.wall"
    }
    
    // Enforcement action
    onViolation: "terminate"
    
    // Monitoring
    monitoring: {
      interval: "1s"
      metrics: ["cpu_usage", "memory_usage", "runtime"]
    }
  }
  
  // I/O contract enforcement
  ioContracts: {
    enforcer: "file-access-monitor"
    
    // Validate file access patterns
    validation: {
      reads: "actual_reads ⊆ allowed_reads"
      writes: "actual_writes ⊆ allowed_writes" 
      network: "network_calls == 0 if !allowed"
    }
    
    // Sandbox implementation
    sandbox: {
      tool: "firejail"
      config: {
        filesystem: "readonly except allowed_writes"
        network: "none if !allowed"
        devices: "minimal"
      }
    }
  }
  
  // Determinism validation
  determinism: {
    // Test: same input → same output
    test: {
      runs: 3
      command: "${JOB_COMMAND}"
      assertion: "all_outputs_identical"
    }
    
    // Idempotency check
    idempotency: {
      runs: 2
      command: "${JOB_COMMAND}"
      assertion: "second_run_no_changes"
    }
  }
}

// Service contract validation
ServiceValidation: {
  // Health check validation
  healthChecks: {
    endpoint: "from Profile.service.healthCheck"
    timeout: "5s"
    interval: "30s"
    
    validation: {
      response_code: "200"
      response_time: "< 1s"
      content_type: "application/json"
    }
    
    // Dependency health validation
    dependencies: {
      check: "all dependencies report healthy"
      timeout: "per dependency timeout"
    }
  }
  
  // API contract validation
  apiContracts: {
    // Schema validation
    schemas: {
      requests: "validate against requestSchema"
      responses: "validate against responseSchema"
      errors: "validate against error schema"
    }
    
    // Endpoint testing
    endpoints: {
      runner: "api-test-runner"
      
      tests: [
        {
          name: "happy_path"
          method: "${ENDPOINT.method}"
          path: "${ENDPOINT.path}"
          expected: "${ENDPOINT.responses[0].code}"
        },
        {
          name: "invalid_input"
          method: "${ENDPOINT.method}"
          path: "${ENDPOINT.path}"
          body: "invalid_data"
          expected: "400"
        }
      ]
    }
  }
  
  // Performance SLA validation
  slaValidation: {
    // Load testing
    loadTest: {
      tool: "k6"
      script: "load-test.js"
      duration: "1m"
      virtual_users: 10
    }
    
    // SLA assertions
    assertions: [
      {
        metric: "http_req_duration"
        threshold: "p(95) < ${SLA.latency.p95}"
      },
      {
        metric: "http_req_failed"
        threshold: "rate < ${1 - SLA.availability}"
      }
    ]
  }
}

// Universal validation gates
UniversalGates: {
  // All artifacts must pass these gates
  required: [
    {
      name: "security_scan"
      tool: "semgrep"
      config: "./security-rules.yml"
      threshold: "no critical or high severity issues"
    },
    {
      name: "dependency_audit"
      tool: "audit-tool"
      threshold: "no known vulnerabilities in production dependencies"
    },
    {
      name: "license_compliance"
      tool: "license-checker"
      allowed: ["MIT", "Apache-2.0", "BSD-3-Clause", "ISC"]
    },
    {
      name: "code_quality"
      tool: "quality-checker"
      metrics: {
        complexity: "< 10 per function"
        duplication: "< 5%"
        coverage: "> 80%"
      }
    }
  ]
  
  // Profile-specific gates are added based on artifact kind
  profileGates: {
    library: ["APIValidation"]
    cli: ["CLIValidation"]  
    service: ["ServiceValidation"]
    job: ["JobValidation"]
  }
  
  // Gate execution order
  execution: {
    // Universal gates run first
    phase1: "UniversalGates.required"
    
    // Profile-specific gates run second
    phase2: "profileGates[artifact.kind]"
    
    // Integration gates run last
    phase3: ["integration_tests", "end_to_end_tests"]
  }
}