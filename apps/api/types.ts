/**
 * Core domain types for Spec Workbench backend
 */

// Database entity types
export interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Fragment {
  id: string;
  project_id: string;
  path: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Version {
  id: string;
  project_id: string;
  spec_hash: string;
  resolved_json: string;
  created_at: string;
}

export interface Event {
  id: string;
  project_id: string;
  event_type: EventType;
  data: Record<string, unknown>;
  created_at: string;
}

// Event types for real-time collaboration
export type EventType = 
  | 'fragment_created'
  | 'fragment_updated' 
  | 'fragment_deleted'
  | 'validation_started'
  | 'validation_completed'
  | 'validation_failed'
  | 'version_frozen';

// API request/response types
export interface CreateFragmentRequest {
  path: string;
  content: string;
}

export interface CreateFragmentResponse {
  id: string;
  path: string;
  created_at: string;
}

export interface ResolvedSpecResponse {
  spec_hash: string;
  resolved: Record<string, unknown>;
  last_updated: string;
}

export interface ValidationRequest {
  force?: boolean;
}

export interface ValidationResponse {
  success: boolean;
  spec_hash: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: 'schema' | 'assertion' | 'custom';
  message: string;
  location?: string;
  details?: Record<string, unknown>;
  // Enhanced error translation fields
  friendlyMessage?: string;
  explanation?: string;
  suggestions?: string[];
  category?: 'validation' | 'types' | 'structure' | 'references' | 'syntax';
  severity?: 'error' | 'warning' | 'info';
}

export interface ValidationWarning {
  type: 'orphan_token' | 'coverage' | 'duplicate';
  message: string;
  location?: string;
}

// Gap analysis types
export interface GapSet {
  missing_capabilities: string[];
  orphaned_tokens: TokenReference[];
  coverage_gaps: CoverageGap[];
  duplicates: Duplicate[];
}

export interface TokenReference {
  token: string;
  defined_in: string[];
  referenced_in: string[];
}

export interface CoverageGap {
  capability: string;
  expected_coverage: number;
  actual_coverage: number;
  missing_scenarios: string[];
}

export interface Duplicate {
  type: 'capability' | 'requirement' | 'test_case';
  name: string;
  locations: string[];
}

// IR (Intermediate Representation) types for diagrams
export type IRKind = 'flow' | 'fsm' | 'view' | 'site';

export interface IRResponse {
  kind: IRKind;
  data: Record<string, unknown>;
  generated_at: string;
}

// Version freezing
export interface FreezeRequest {
  version_name: string;
  description?: string;
}

export interface FreezeResponse {
  version_id: string;
  spec_hash: string;
  frozen_at: string;
}

// Authentication
export interface AuthContext {
  token: string;
  user_id?: string;
  project_access: string[];
}

// External tool execution results
export interface ExternalToolResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
}

// Rate limiting
export interface RateLimitBucket {
  tokens: number;
  last_refill: number;
  max_tokens: number;
  refill_rate: number;
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'event' | 'error' | 'ping' | 'pong';
  project_id?: string;
  data: Record<string, unknown>;
}

// NATS integration types
export interface NatsSpecEvent {
  topic: string;
  projectId: string;
  event: Omit<Event, 'id' | 'created_at'>;
  metadata: {
    timestamp: string;
    specHash?: string;
    sequence: number;
  };
}

export interface NatsConfig {
  url?: string;
  enabled: boolean;
  reconnectTimeWait: number;
  maxReconnectAttempts: number;
  topicPrefix: string;
}

// Error response structure (RFC 7807 Problem Details)
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

// Configuration
export interface ServerConfig {
  port: number;
  host: string;
  database_path: string;
  spec_workdir: string;
  cue_binary_path: string;
  jq_binary_path: string;
  auth_required: boolean;
  rate_limit: {
    max_tokens: number;
    refill_rate: number; // tokens per second
    window_ms: number;
  };
  external_tool_timeout_ms: number;
  websocket: {
    max_connections: number;
    ping_interval_ms: number;
  };
  nats?: NatsConfig;
}