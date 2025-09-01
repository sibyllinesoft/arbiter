// Ticket System Profile - Hard Rails Implementation
// Based on TODO.md Section 1: Hard Rails: Mutation Tickets + Stamps

package profiles

import "crypto/hmac"
import "crypto/sha256"  
import "encoding/base64"
import "time"

// Ticket System Architecture Profile
#TicketSystemProfile: {
  kind: "service"
  name: "ticket-system"
  description: "Mutation ticket and stamp management service"
  
  // Server endpoints for ticket operations
  endpoints: {
    "/v1/ticket": {
      method: "POST"
      summary: "Request mutation ticket"
      
      request: {
        scope: string & =~"^[a-f0-9]{64}$"  // Plan hash
        expires?: string & =~"^[0-9]+[smh]$" // Duration
      }
      
      response: {
        ticketId: string & =~"^tkn_[a-zA-Z0-9]{16}$"
        expiresAt: time.Time
        planHash: string & =~"^[a-f0-9]{64}$"
      }
      
      errors: [
        {code: 400, message: "Invalid plan hash format"},
        {code: 401, message: "Unauthorized - missing authentication"},
        {code: 503, message: "Server unavailable"}
      ]
    }
    
    "/v1/verify": {
      method: "POST" 
      summary: "Verify stamp HMAC"
      
      request: {
        stamp: string      // Base64 encoded HMAC
        repoSHA: string & =~"^[a-f0-9]{40}$"
        planHash: string & =~"^[a-f0-9]{64}$"
        ticketId: string & =~"^tkn_[a-zA-Z0-9]{16}$"
      }
      
      response: {
        valid: bool
        message: string
      }
    }
    
    "/execute/epic": {
      method: "POST"
      summary: "Execute epic with ticket validation"
      
      request: {
        epicId: string
        ticketId: string & =~"^tkn_[a-zA-Z0-9]{16}$"
        mutations: [...{
          file: string
          operation: "create" | "update" | "delete"
          content?: string
        }]
      }
      
      response: {
        stamp: string      // HMAC signature
        mutations: [...{
          file: string
          stampId: string
          success: bool
        }]
      }
    }
    
    "/spec/apply": {
      method: "POST"
      summary: "Apply spec changes with ticket"
      
      request: {
        ticketId: string & =~"^tkn_[a-zA-Z0-9]{16}$"
        changes: [...{
          file: string
          diff: string
        }]
      }
      
      response: {
        applied: bool
        stamps: [...{
          file: string
          stamp: string
        }]
      }
    }
  }
  
  // Stamp format specification  
  stampFormat: {
    pattern: """
      // ARBITER:BEGIN <id> stamp=<base64>
      // ... edited content ...
      // ARBITER:END <id>
      """
    
    validation: {
      id: string & =~"^[a-zA-Z0-9]{8}$"
      stamp: string & =~"^[A-Za-z0-9+/=]+$"  // Base64
      content: string  // Arbitrary edited content
    }
    
    hmacInputs: [
      "repoSHA",    // Current git commit hash
      "planHash",   // Scoped plan identifier  
      "ticketId",   // Issued ticket ID
      "fileContent" // The actual content being stamped
    ]
  }
  
  // Git integration hooks
  gitIntegration: {
    preCommitHook: {
      name: "arbiter-verify"
      script: """
        #!/bin/bash
        set -euo pipefail
        
        echo "🔍 Verifying Arbiter stamps..."
        
        # Run arbiter verify on staged files
        if ! arbiter verify --strict; then
          echo "❌ Arbiter verification failed"
          echo "All CUE/spec edits must be stamped with valid tickets"
          exit 1
        fi
        
        # Check for direct CUE edits without stamps
        cue_files=$(git diff --cached --name-only | grep '\\.cue$' || true)
        if [[ -n "$cue_files" ]]; then
          for file in $cue_files; do
            if ! grep -q "ARBITER:BEGIN" "$file"; then
              echo "❌ Direct CUE edit detected: $file"
              echo "Use 'arbiter ticket' and proper mutation endpoints"
              exit 1
            fi
          done
        fi
        
        echo "✅ All stamps verified"
        """
    }
    
    preReceiveHook: {
      name: "arbiter-verify-server"
      optional: true
      script: """
        #!/bin/bash
        # Server-side verification (optional but recommended)
        
        while read oldrev newrev refname; do
          if [[ "$refname" == "refs/heads/main" || "$refname" == "refs/heads/master" ]]; then
            echo "🔍 Server-side Arbiter verification..."
            
            if ! arbiter verify --strict --commit "$newrev"; then
              echo "❌ Push rejected: Invalid or missing Arbiter stamps"
              exit 1
            fi
          fi
        done
        """
    }
    
    commitTrailerRequirement: {
      pattern: "Arbiter-Ticket: <ticketId>"
      validation: "^Arbiter-Ticket: tkn_[a-zA-Z0-9]{16}$"
      enforcement: "mandatory"
    }
  }
  
  // Storage and persistence
  storage: {
    tickets: {
      table: "active_tickets"
      schema: {
        id: "string PRIMARY KEY"
        planHash: "string NOT NULL"
        expiresAt: "timestamp NOT NULL"
        createdAt: "timestamp DEFAULT NOW()"
        used: "boolean DEFAULT false"
      }
      indexes: [
        "CREATE INDEX idx_tickets_plan_hash ON active_tickets(planHash)",
        "CREATE INDEX idx_tickets_expires ON active_tickets(expiresAt)"
      ]
      cleanup: "DELETE FROM active_tickets WHERE expiresAt < NOW() - INTERVAL '1 hour'"
    }
    
    stamps: {
      table: "stamp_history"
      schema: {
        id: "string PRIMARY KEY"
        ticketId: "string NOT NULL"
        repoSHA: "string NOT NULL"
        planHash: "string NOT NULL"  
        filePath: "string NOT NULL"
        stamp: "string NOT NULL"
        createdAt: "timestamp DEFAULT NOW()"
      }
      indexes: [
        "CREATE INDEX idx_stamps_ticket ON stamp_history(ticketId)",
        "CREATE INDEX idx_stamps_repo_sha ON stamp_history(repoSHA)"
      ]
    }
  }
  
  // Security configuration
  security: {
    hmacKey: {
      source: "environment"
      variable: "ARBITER_HMAC_KEY"  
      length: 64  // 512 bits
      rotation: "monthly"
    }
    
    ticketExpiration: {
      default: "1h"
      maximum: "24h"
      minimum: "5m"
    }
    
    rateLimiting: {
      ticketRequests: "10/minute/ip"
      verifyRequests: "100/minute/ip"
      executeRequests: "5/minute/ip"
    }
    
    authentication: {
      required: true
      methods: ["api-key", "jwt"]
      scopes: ["ticket:create", "mutation:execute", "verification:read"]
    }
  }
  
  // Performance constraints (from TODO.md Section 0)
  constraints: {
    ticketIssue: {
      cpu_ms: 50       // Very fast ticket generation
      mem_mb: 4        // Minimal memory
      wall_ms: 200     // Including network
      payload_kb: 1    // Small request/response
    }
    
    stampVerification: {
      cpu_ms: 100      // HMAC computation
      mem_mb: 8        // Crypto operations
      wall_ms: 300     // Including DB lookup
      payload_kb: 16   // Stamp + metadata
    }
    
    mutationExecution: {
      cpu_ms: 750      // Max per TODO.md
      mem_mb: 64       // Max per TODO.md  
      wall_ms: 750     // Max per TODO.md
      payload_kb: 64   // Max per TODO.md
    }
    
    batchOperations: {
      rps: 1           // ~1 rps as specified
      backoff: "exponential"
      maxRetries: 3
    }
  }
  
  // Monitoring and observability
  monitoring: {
    metrics: [
      "ticket_requests_total",
      "ticket_requests_duration_seconds", 
      "stamp_verifications_total",
      "stamp_verification_failures_total",
      "mutation_executions_total",
      "mutation_execution_duration_seconds",
      "git_hook_executions_total",
      "git_hook_failures_total"
    ]
    
    alerts: [
      {
        name: "high_verification_failure_rate"
        condition: "stamp_verification_failures_total / stamp_verifications_total > 0.1"
        severity: "warning"
      },
      {
        name: "ticket_service_unavailable"
        condition: "up == 0"
        severity: "critical"
      },
      {
        name: "performance_budget_exceeded"
        condition: "mutation_execution_duration_seconds > 0.75"
        severity: "warning"
      }
    ]
    
    dashboards: [
      "ticket-system-overview",
      "stamp-verification-health", 
      "mutation-performance",
      "git-integration-status"
    ]
  }
  
  // Testing requirements
  testing: {
    unitTests: {
      coverage: 95
      requirements: [
        "HMAC generation and verification",
        "Ticket expiration handling", 
        "Stamp format parsing",
        "Error handling and edge cases"
      ]
    }
    
    integrationTests: {
      scenarios: [
        "full_mutation_workflow",
        "expired_ticket_rejection",
        "invalid_stamp_detection",
        "git_hook_integration",
        "concurrent_ticket_usage"
      ]
    }
    
    e2eTests: {
      workflows: [
        "developer_makes_stamped_change",
        "ci_verifies_stamps_on_push",
        "invalid_direct_edit_rejected",
        "ticket_expiration_cleanup"
      ]
    }
    
    performanceTests: {
      load: "100 concurrent ticket requests"
      latency: "p95 < 200ms for ticket operations"
      throughput: "1000 verifications/second"
      endurance: "24 hour continuous operation"
    }
  }
}

// Export the profile
TicketSystemProfile: #TicketSystemProfile