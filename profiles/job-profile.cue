// Job artifact profile
// Enforces deterministic batch runs, file I/O contracts, and resource caps

package profiles

// Job profile definition 
JobProfile: {
  // Resource constraints
  resources: {
    cpu: string // "100m", "1", "2000m"
    memory: string // "128Mi", "1Gi", "2Gi"
    wallTime: string // "30s", "5m", "1h"
    disk?: string // "1Gi", "10Gi"
  }
  
  // I/O contracts and file access patterns
  ioContracts: {
    // Files/directories the job is allowed to read
    reads: [...string] // glob patterns
    
    // Files/directories the job is allowed to write  
    writes: [...string] // glob patterns
    
    // Network access permitted
    network: bool
    
    // Database access
    database?: {
      allowed: bool
      readonly?: bool
      connections?: int
    }
    
    // Temporary storage
    temp: {
      size?: string
      cleanup: bool
    }
  }
  
  // Execution properties
  execution: {
    // Job must be idempotent (safe to run multiple times)
    idempotent: bool
    
    // Job can run concurrently with other instances
    concurrent: bool
    
    // Retry configuration
    retries: {
      maxAttempts: int
      backoff: "linear" | "exponential" | "fixed"
      delay: string
    }
    
    // Timeout configuration
    timeout: {
      execution: string
      shutdown: string // graceful shutdown timeout
    }
  }
  
  // Input/output specification
  interface: {
    // Command line arguments schema
    args?: [...{
      name: string
      type: "str" | "int" | "bool" | "file" | "enum"
      required: bool
      description?: string
      validation?: string
    }]
    
    // Environment variables
    environment?: [...{
      name: string
      type: "str" | "int" | "bool"
      required: bool
      description?: string
      sensitive?: bool // secret/password
    }]
    
    // Input files/stdin
    input?: {
      type: "none" | "stdin" | "files" | "json" | "csv"
      schema?: string
      validation?: string
    }
    
    // Output files/stdout  
    output?: {
      type: "stdout" | "files" | "json" | "csv"
      schema?: string
      path?: string
    }
    
    // Exit codes and meanings
    exitCodes: [...{
      code: int
      meaning: string
      description?: string
      retryable?: bool
    }]
  }
  
  // Monitoring and observability
  monitoring: {
    // Health check command
    healthCheck?: string
    
    // Progress reporting
    progress?: {
      enabled: bool
      interval?: string
      metrics?: [...string]
    }
    
    // Logging configuration
    logging: {
      level: "debug" | "info" | "warn" | "error"
      format: "text" | "json"
      destination: "stdout" | "file" | "syslog"
    }
  }
  
  // Testing configuration
  tests: {
    // Unit tests for job logic
    unit?: [...{
      name: string
      description?: string
      command: string
      expectedExit: int
    }]
    
    // Integration tests with actual I/O
    integration?: [...{
      name: string
      description?: string
      setup?: string
      command: string
      expectedFiles?: [...string]
      expectedOutput?: string
      cleanup?: string
    }]
    
    // Property-based tests
    property?: [...{
      name: string
      description?: string
      property: string // CUE constraint
    }]
  }
  
  // Scheduling configuration (for recurring jobs)
  scheduling?: {
    type: "cron" | "interval" | "manual"
    schedule?: string // cron expression or interval
    timezone?: string
    overlap?: "allow" | "forbid" | "queue"
  }
}

// Example job configuration for CUE analysis worker
CUEAnalysisJob: JobProfile & {
  resources: {
    cpu: "200m"
    memory: "256Mi" 
    wallTime: "30s"
    disk: "100Mi"
  }
  
  ioContracts: {
    reads: [
      "./input/*.cue",
      "./schemas/*.json",
      "./temp/analysis-*"
    ]
    writes: [
      "./output/*.json",
      "./logs/analysis-*.log",
      "./temp/work-*"
    ]
    network: false
    database: {
      allowed: true
      readonly: false
      connections: 1
    }
    temp: {
      size: "50Mi"
      cleanup: true
    }
  }
  
  execution: {
    idempotent: true
    concurrent: false
    retries: {
      maxAttempts: 3
      backoff: "exponential"
      delay: "1s"
    }
    timeout: {
      execution: "30s"
      shutdown: "5s"
    }
  }
  
  interface: {
    args: [
      {
        name: "input-file"
        type: "file"
        required: true
        description: "CUE file to analyze"
        validation: "*.cue && exists"
      },
      {
        name: "output-format"
        type: "enum"
        required: false
        description: "Output format"
        validation: "json|yaml|text"
      },
      {
        name: "timeout"
        type: "int"
        required: false
        description: "Analysis timeout in seconds"
        validation: ">0 && <=60"
      }
    ]
    
    environment: [
      {
        name: "LOG_LEVEL"
        type: "str"
        required: false
        description: "Logging verbosity"
      },
      {
        name: "CUE_CACHE_DIR"
        type: "str" 
        required: false
        description: "CUE module cache directory"
      }
    ]
    
    input: {
      type: "files"
      schema: "./schemas/cue-input.json"
      validation: "valid_cue_syntax"
    }
    
    output: {
      type: "json"
      schema: "./schemas/analysis-result.json"
      path: "./output/analysis-{timestamp}.json"
    }
    
    exitCodes: [
      {code: 0, meaning: "success", description: "Analysis completed successfully", retryable: false},
      {code: 1, meaning: "analysis_failed", description: "CUE validation failed", retryable: false},
      {code: 2, meaning: "invalid_input", description: "Invalid input file or arguments", retryable: false},
      {code: 3, meaning: "timeout", description: "Analysis timed out", retryable: true},
      {code: 4, meaning: "resource_exhausted", description: "Insufficient resources", retryable: true},
      {code: 5, meaning: "system_error", description: "System or I/O error", retryable: true}
    ]
  }
  
  monitoring: {
    healthCheck: "./bin/health-check"
    progress: {
      enabled: true
      interval: "5s"
      metrics: ["files_processed", "errors_found", "memory_usage"]
    }
    logging: {
      level: "info"
      format: "json"
      destination: "stdout"
    }
  }
  
  tests: {
    unit: [
      {
        name: "valid_cue_parsing"
        description: "Should parse valid CUE files without errors"
        command: "./bin/analyze-job ./test/fixtures/valid.cue"
        expectedExit: 0
      },
      {
        name: "invalid_cue_handling"
        description: "Should handle invalid CUE gracefully"
        command: "./bin/analyze-job ./test/fixtures/invalid.cue"
        expectedExit: 1
      }
    ]
    
    integration: [
      {
        name: "end_to_end_analysis"
        description: "Complete analysis workflow with real files"
        setup: "mkdir -p ./test/temp && cp ./test/fixtures/*.cue ./test/temp/"
        command: "./bin/analyze-job ./test/temp/project.cue --output-format json"
        expectedFiles: ["./output/analysis-*.json"]
        expectedOutput: "*analysis completed*"
        cleanup: "rm -rf ./test/temp"
      }
    ]
    
    property: [
      {
        name: "idempotency"
        description: "Running the same job twice produces identical results"
        property: "output_a == output_b where output_a := run(input) && output_b := run(input)"
      },
      {
        name: "resource_bounds"
        description: "Job never exceeds specified resource limits"
        property: "memory_usage <= resources.memory && cpu_usage <= resources.cpu"
      }
    ]
  }
  
  scheduling: {
    type: "manual"
  }
}