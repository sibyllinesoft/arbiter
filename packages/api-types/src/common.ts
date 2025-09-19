/**
 * Common utility types and configurations
 *
 * These types are used across multiple modules and provide
 * shared interfaces for common functionality.
 */

// IR generation types
export type IRKind = "flow" | "fsm" | "view" | "site";

// Authentication context
export interface AuthContext {
  user_id: string;
  scopes: string[];
  client_id?: string;
  token_type?: "bearer" | "basic";
  expires_at?: string;
  authenticated: boolean;
}

// Server configuration (partial - only what's needed by clients)
export interface ServerConfig {
  host: string;
  port: number;
  auth_required: boolean;
  websocket: {
    max_connections: number;
    ping_interval_ms: number;
  };
  oauth?: {
    enabled: boolean;
    mcpBaseUrl: string;
    authServerUrl: string;
    requiredScopes: string[];
  };
  webhooks?: {
    enabled: boolean;
    allowed_repos: string[];
    sync_on_push: boolean;
    validate_on_merge: boolean;
  };
}

// Pagination parameters
export interface PaginationParams {
  limit?: number;
  offset?: number;
  page?: number;
  size?: number;
}

// Pagination response wrapper
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// Sort order
export type SortOrder = "asc" | "desc";

// Generic sort parameters
export interface SortParams {
  sort_by?: string;
  sort_order?: SortOrder;
}

// Filter parameters
export interface FilterParams {
  search?: string;
  filters?: Record<string, unknown>;
  date_from?: string;
  date_to?: string;
}

// Combined query parameters
export interface QueryParams extends PaginationParams, SortParams, FilterParams {
  include?: string[];
  exclude?: string[];
}

// Generic API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
  request_id?: string;
}

// Rate limiting information
export interface RateLimit {
  limit: number;
  remaining: number;
  reset: number;
  window: number;
}

// HTTP method types
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

// Content types
export type ContentType =
  | "application/json"
  | "application/xml"
  | "text/plain"
  | "text/html"
  | "text/csv"
  | "application/octet-stream"
  | "multipart/form-data"
  | "application/x-www-form-urlencoded";

// File upload types
export interface FileUpload {
  filename: string;
  content_type: string;
  size: number;
  data: Buffer | Uint8Array;
}

// Validation result wrapper
export interface ValidationResult<T = unknown> {
  valid: boolean;
  data?: T;
  errors: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
  warnings?: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
}

// Configuration validation
export interface ConfigValidation {
  required: string[];
  optional: string[];
  deprecated: string[];
  invalid: Array<{
    field: string;
    value: unknown;
    reason: string;
  }>;
}

// Feature flags
export interface FeatureFlags {
  oauth_enabled: boolean;
  webhooks_enabled: boolean;
  real_time_collaboration: boolean;
  advanced_validation: boolean;
  export_formats: string[];
  ai_assistance: boolean;
}

// System metrics
export interface SystemMetrics {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_io: {
    bytes_in: number;
    bytes_out: number;
  };
  database: {
    connections: number;
    query_count: number;
    avg_query_time: number;
  };
  cache: {
    hit_ratio: number;
    entries: number;
    memory_usage: number;
  };
}

// Audit log entry
export interface AuditLogEntry {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  timestamp: string;
}

// Generic identifier types
export type UUID = string;
export type Timestamp = string; // ISO 8601 format
export type Hash = string; // SHA-256 hash
export type Email = string;
export type URL = string;

// Environment types
export type Environment = "development" | "staging" | "production" | "test";

// Log levels
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

// Time units
export type TimeUnit = "ms" | "s" | "m" | "h" | "d" | "w" | "M" | "y";

// Duration with unit
export interface Duration {
  value: number;
  unit: TimeUnit;
}
