/**
 * API request and response types for Arbiter Spec Workbench
 *
 * These types define the contracts for all HTTP API endpoints
 * and ensure type safety between frontend and backend communication.
 */

// Fragment API types
export interface CreateFragmentRequest {
  path: string;
  content: string;
  projectId?: string; // For backward compatibility
  project_id?: string; // For backward compatibility
  filename?: string;
  author?: string;
  message?: string;
  replace?: boolean;
}

export interface CreateFragmentResponse {
  fragmentId: string;
  specHash: string;
  warnings: string[];
  ran: {
    vet: boolean;
    export: boolean;
  };
}

export interface UpdateFragmentRequest {
  content: string;
  author?: string;
  message?: string;
}

export interface UpdateFragmentResponse {
  fragmentId: string;
  specHash: string;
  warnings: string[];
  ran: {
    vet: boolean;
    export: boolean;
  };
}

export interface FragmentListResponse {
  id: string;
  path: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface FragmentRevisionsResponse {
  fragmentId: string;
  path: string;
  revisions: Array<{
    id: string;
    revision_number: number;
    content_hash: string;
    author?: string;
    message?: string;
    created_at: string;
  }>;
}

// Project API types
export interface ProjectListResponse {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreateRequest {
  id: string;
  name: string;
}

export interface ProjectCreateResponse {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// Validation API types
export interface ValidationRequest {
  projectId?: string;
  project_id?: string; // For backward compatibility
  force?: boolean;
}

export interface ValidationResponse {
  success: boolean;
  spec_hash: string;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  type: "schema" | "assertion" | "custom";
  message: string;
  location?: string;
  details?: Record<string, unknown>;
}

export interface ValidationWarning {
  type: "schema" | "assertion" | "custom" | "deprecation";
  message: string;
  location?: string;
  details?: Record<string, unknown>;
}

// Resolved specification API types
export interface ResolvedSpecResponse {
  projectId: string;
  specHash: string;
  updatedAt: string;
  json: Record<string, unknown>;
}

// IR generation API types
export interface IRGenerationRequest {
  projectId?: string;
  project_id?: string; // For backward compatibility
  kind: "flow" | "fsm" | "view" | "site";
}

export interface IRGenerationResponse {
  kind: string;
  data: Record<string, unknown>;
  metadata: {
    generated_at: string;
    spec_hash: string;
    version: string;
  };
}

// Freeze API types
export interface FreezeRequest {
  projectId?: string;
  project_id?: string; // For backward compatibility
  tag?: string;
  version_name?: string; // For backward compatibility
  description?: string;
}

export interface FreezeResponse {
  versionId: string;
  tag: string;
  specHash: string;
  manifest: {
    files: string[];
  };
}

// Webhook API types
export interface WebhookConfigRequest {
  project_id: string;
  enabled: boolean;
  events: string[];
  url?: string;
  secret?: string;
}

export interface WebhookConfigResponse {
  id: string;
  project_id: string;
  enabled: boolean;
  events: string[];
  url?: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookListResponse {
  enabled: boolean;
  providers: string[];
  endpoints: Record<string, string>;
  configuration?: Record<string, unknown>;
}

// Authentication API types
export interface AuthRequest {
  email?: string;
  username?: string;
  password?: string;
  provider?: string;
  token?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  user: {
    id: string;
    email?: string;
    name?: string;
    avatar_url?: string;
  };
}

export interface TokenRequest {
  grant_type: "authorization_code" | "refresh_token" | "client_credentials";
  code?: string;
  refresh_token?: string;
  client_id: string;
  client_secret?: string;
  redirect_uri?: string;
  code_verifier?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

export interface UserInfoResponse {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
  email_verified?: boolean;
}

// Error handling types
export interface ProblemDetails {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

export interface ApiError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

// Health check types
export interface HealthResponse {
  status: "healthy" | "unhealthy" | "degraded";
  timestamp: string;
  database: boolean;
  connections: number;
  projects: number;
}

export interface StatusResponse {
  service: string;
  version: string;
  status: "running" | "degraded" | "error";
  timestamp: string;
  uptime: number;
  daemon: {
    healthy: boolean;
    database_connected: boolean;
    websocket_connections: number;
    active_projects: number;
  };
  system: {
    memory_usage: Record<string, number>;
    node_version: string;
    platform: string;
    arch: string;
  };
  endpoints: Record<string, string>;
}
