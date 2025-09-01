// Resource limits and constraints for Arbiter system
package limits

// Content size limits
#MaxTextSize: 64 * 1024 // 64KB
#MaxProjectNameLength: 100
#MaxUserNameLength: 50

// Performance limits
#AnalysisTimeoutMs: 750
#MaxConcurrency: 4
#MaxMemoryMB: 128

// Rate limiting
#RateLimitPerSecond: 1
#BurstLimit: 3

// WebSocket limits
#MaxConnections: 1000
#MaxMessageSize: 64 * 1024
#HeartbeatIntervalMs: 30000
#ConnectionTimeoutMs: 60000

// Database limits
#MaxProjectsPerUser: 1000
#MaxRevisionsPerProject: 10000
#MaxYUpdatesPerProject: 100000

// Validation constraints
#ProjectIdPattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
#UserIdPattern: "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
#ColorPattern: "^#[0-9a-fA-F]{6}$"

// Protocol versions
#ProtocolVersion: "1.0"
#MinSupportedVersion: "1.0"
#MaxSupportedVersion: "1.0"

// File system limits (for analysis)
#TempDirPrefix: "arbiter-analysis-"
#MaxTempFiles: 1000
#TempFileTimeoutMs: 5000

// Security constraints
#AllowedOrigins: ["http://localhost:3000", "https://localhost:3000"]
#CSRFTokenLength: 32
#SessionTimeoutMs: 24 * 60 * 60 * 1000 // 24 hours

// Error codes
#ErrorCodes: {
  INVALID_MESSAGE: "INVALID_MESSAGE"
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND" 
  RATE_LIMITED: "RATE_LIMITED"
  ANALYSIS_TIMEOUT: "ANALYSIS_TIMEOUT"
  CONTENT_TOO_LARGE: "CONTENT_TOO_LARGE"
  INTERNAL_ERROR: "INTERNAL_ERROR"
  UNAUTHORIZED: "UNAUTHORIZED"
  FORBIDDEN: "FORBIDDEN"
  CONFLICT: "CONFLICT"
}

// Runtime configuration schema
#Config: {
  server: {
    port: int & >=1024 & <=65535 | *3001
    host: string | *"localhost"
  }
  
  limits: {
    maxTextSize: int & >0 | *#MaxTextSize
    maxConcurrency: int & >0 | *#MaxConcurrency
    timeoutMs: int & >0 | *#AnalysisTimeoutMs
    rateLimit: number & >0 | *#RateLimitPerSecond
  }
  
  database: {
    path: string | *"./data/arbiter.db"
    maxConnections: int & >0 | *10
  }
  
  websocket: {
    maxConnections: int & >0 | *#MaxConnections
    heartbeatMs: int & >0 | *#HeartbeatIntervalMs
    timeoutMs: int & >0 | *#ConnectionTimeoutMs
  }
}