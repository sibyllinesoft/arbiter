// Service artifact profile
// Enforces API endpoints, health checks, dependency contracts, and service-level agreements

package profiles

// Service profile definition
ServiceProfile: {
  // API endpoint specifications
  endpoints: [...{
    path: string
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS"
    summary: string
    description?: string
    
    // Request/response schemas
    requestSchema?: string
    responseSchema?: string
    
    // Authentication requirements
    auth?: {
      required: bool
      type?: "bearer" | "basic" | "api-key" | "oauth2"
      scopes?: [...string]
    }
    
    // Rate limiting
    rateLimit?: {
      requests: int
      window: string // "1m", "1h", etc.
      burst?: int
    }
    
    // Response codes and meanings
    responses: [...{
      code: int
      description: string
      schema?: string
    }]
  }]
  
  // Health and monitoring
  healthCheck: {
    path: string
    method?: "GET"
    timeout?: string
    interval?: string
    dependencies?: [...string]
  }
  
  // Service dependencies
  dependencies: [...{
    name: string
    type: "database" | "cache" | "queue" | "external-api" | "filesystem"
    required: bool
    healthCheck?: string
    timeout?: string
  }]
  
  // Service-level agreements
  sla: {
    availability: string // "99.9%"
    latency: {
      p50?: string
      p95?: string  
      p99?: string
    }
    throughput: {
      rps?: int // requests per second
    }
    recovery: {
      rto?: string // recovery time objective
      rpo?: string // recovery point objective
    }
  }
  
  // Resource requirements
  resources: {
    cpu: {
      request?: string
      limit?: string
    }
    memory: {
      request?: string
      limit?: string
    }
    storage?: {
      size?: string
      type?: "persistent" | "ephemeral"
    }
  }
  
  // Configuration management
  configuration: {
    environment: [...{
      name: string
      required: bool
      description?: string
      default?: string
      validation?: string
    }]
    secrets: [...{
      name: string
      description?: string
      required: bool
    }]
    files: [...{
      path: string
      description?: string
      required: bool
    }]
  }
  
  // Deployment configuration
  deployment: {
    strategy: "rolling" | "blue-green" | "canary"
    replicas: {
      min: int
      max: int
      target?: int
    }
    scaling: {
      metric: "cpu" | "memory" | "rps" | "queue-depth"
      threshold: _
    }
  }
  
  // Observability
  observability: {
    metrics: [...{
      name: string
      type: "counter" | "gauge" | "histogram"
      description?: string
    }]
    logs: {
      level: "debug" | "info" | "warn" | "error"
      structured: bool
      format?: "json" | "text"
    }
    tracing: {
      enabled: bool
      sampler?: "always" | "probabilistic" | "rate-limited"
      exporters?: [...string]
    }
  }
}

// Example service configuration for Arbiter API
ArbiterAPI: ServiceProfile & {
  endpoints: [
    {
      path: "/health"
      method: "GET"
      summary: "Health check endpoint"
      description: "Returns service health status and dependency checks"
      responseSchema: "./schemas/health-response.json"
      responses: [
        {code: 200, description: "Service is healthy", schema: "./schemas/health-ok.json"},
        {code: 503, description: "Service is unhealthy", schema: "./schemas/health-error.json"}
      ]
    },
    {
      path: "/api/projects"
      method: "POST"
      summary: "Create new project"
      description: "Create a new Arbiter project with initial configuration"
      requestSchema: "./schemas/create-project-request.json"
      responseSchema: "./schemas/project-response.json"
      auth: {
        required: false // TODO: Add authentication later
        type: "bearer"
      }
      rateLimit: {
        requests: 10
        window: "1m"
        burst: 5
      }
      responses: [
        {code: 201, description: "Project created successfully"},
        {code: 400, description: "Invalid request"},
        {code: 409, description: "Project already exists"},
        {code: 429, description: "Rate limit exceeded"}
      ]
    },
    {
      path: "/api/projects/{projectId}/analyze"
      method: "POST"
      summary: "Analyze CUE content"
      description: "Validate and analyze CUE configuration content"
      requestSchema: "./schemas/analyze-request.json"
      responseSchema: "./schemas/analysis-result.json"
      rateLimit: {
        requests: 60
        window: "1m"
        burst: 10
      }
      responses: [
        {code: 200, description: "Analysis completed"},
        {code: 400, description: "Invalid CUE content"},
        {code: 413, description: "Content too large"},
        {code: 429, description: "Rate limit exceeded"}
      ]
    },
    {
      path: "/ws"
      method: "GET"
      summary: "WebSocket endpoint"
      description: "Real-time collaboration WebSocket connection"
      auth: {
        required: false
        type: "bearer"
      }
      responses: [
        {code: 101, description: "WebSocket connection established"},
        {code: 400, description: "Invalid WebSocket request"},
        {code: 401, description: "Authentication required"}
      ]
    }
  ]
  
  healthCheck: {
    path: "/health"
    method: "GET"
    timeout: "5s"
    interval: "30s"
    dependencies: ["sqlite", "filesystem"]
  }
  
  dependencies: [
    {
      name: "sqlite"
      type: "database"
      required: true
      healthCheck: "SELECT 1"
      timeout: "5s"
    },
    {
      name: "filesystem"
      type: "filesystem"
      required: true
      timeout: "1s"
    }
  ]
  
  sla: {
    availability: "99.5%"
    latency: {
      p50: "50ms"
      p95: "200ms"
      p99: "500ms"
    }
    throughput: {
      rps: 100
    }
    recovery: {
      rto: "5m"
      rpo: "1m"
    }
  }
  
  resources: {
    cpu: {
      request: "100m"
      limit: "500m"
    }
    memory: {
      request: "128Mi"
      limit: "512Mi"
    }
    storage: {
      size: "1Gi"
      type: "persistent"
    }
  }
  
  configuration: {
    environment: [
      {
        name: "PORT"
        required: false
        default: "3001"
        description: "HTTP server port"
        validation: "int && >0 && <65536"
      },
      {
        name: "DB_PATH"
        required: false
        default: "./data/arbiter.db"
        description: "SQLite database file path"
      },
      {
        name: "LOG_LEVEL"
        required: false
        default: "info"
        description: "Logging level"
        validation: "debug|info|warn|error"
      }
    ]
    secrets: [
      {
        name: "JWT_SECRET"
        description: "JSON Web Token signing secret"
        required: false
      }
    ]
    files: [
      {
        path: "./data"
        description: "Database directory"
        required: true
      }
    ]
  }
  
  deployment: {
    strategy: "rolling"
    replicas: {
      min: 1
      max: 5
      target: 2
    }
    scaling: {
      metric: "cpu"
      threshold: 70
    }
  }
  
  observability: {
    metrics: [
      {
        name: "http_requests_total"
        type: "counter"
        description: "Total HTTP requests"
      },
      {
        name: "http_request_duration_seconds"
        type: "histogram"
        description: "HTTP request duration"
      },
      {
        name: "websocket_connections_active"
        type: "gauge"
        description: "Active WebSocket connections"
      },
      {
        name: "cue_analysis_duration_seconds"
        type: "histogram"
        description: "CUE analysis execution time"
      }
    ]
    logs: {
      level: "info"
      structured: true
      format: "json"
    }
    tracing: {
      enabled: true
      sampler: "probabilistic"
      exporters: ["jaeger"]
    }
  }
}