/**
 * Frontend types matching backend API contracts
 * Synchronized with backend/src/types.ts
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

// Specialized IR types for different diagrams
export interface FlowIR {
  nodes: FlowNode[];
  edges: FlowEdge[];
  clusters?: FlowCluster[];
}

export interface FlowNode {
  id: string;
  label: string;
  type: 'start' | 'end' | 'process' | 'decision' | 'data';
  metadata?: Record<string, unknown>;
}

export interface FlowEdge {
  from: string;
  to: string;
  label?: string;
  type?: 'normal' | 'conditional' | 'error';
}

export interface FlowCluster {
  id: string;
  label: string;
  nodes: string[];
}

export interface SiteIR {
  routes: SiteRoute[];
  dependencies: SiteDependency[];
}

export interface SiteRoute {
  id: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: string;
  dependencies: string[];
}

export interface SiteDependency {
  from: string;
  to: string;
  type: 'data' | 'service' | 'auth';
}

export interface FsmIR {
  states: FsmState[];
  transitions: FsmTransition[];
  initial: string;
  final: string[];
}

export interface FsmState {
  id: string;
  label: string;
  type: 'normal' | 'initial' | 'final' | 'compound';
  metadata?: Record<string, unknown>;
}

export interface FsmTransition {
  from: string;
  to: string;
  event: string;
  guard?: string;
  action?: string;
}

export interface ViewIR {
  tokens: ViewToken[];
  connections: ViewConnection[];
  layout: ViewLayout;
}

export interface ViewToken {
  id: string;
  label: string;
  type: 'capability' | 'requirement' | 'test' | 'data';
  position: { x: number; y: number };
  metadata?: Record<string, unknown>;
}

export interface ViewConnection {
  from: string;
  to: string;
  type: 'implements' | 'tests' | 'depends_on' | 'provides';
}

export interface ViewLayout {
  width: number;
  height: number;
  padding: number;
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

// WebSocket message types
export interface WebSocketMessage {
  type: 'event' | 'error' | 'ping' | 'pong';
  project_id?: string;
  data: Record<string, unknown>;
}

// WebSocket events for real-time collaboration
export interface WsEvent {
  type: 'fragment_updated' | 'resolved_updated' | 'gaps_updated' | 'ir_updated';
  project_id: string;
  data: WsEventData;
  timestamp: string;
  user?: string;
}

export type WsEventData =
  | WsFragmentUpdatedData
  | WsResolvedUpdatedData
  | WsGapsUpdatedData
  | WsIrUpdatedData;

export interface WsFragmentUpdatedData {
  fragment: Fragment;
  operation: 'created' | 'updated' | 'deleted';
}

export interface WsResolvedUpdatedData {
  spec_hash: string;
  resolved: Record<string, unknown>;
}

export interface WsGapsUpdatedData {
  gaps: GapSet;
  spec_hash: string;
}

export interface WsIrUpdatedData {
  kind: IRKind;
  data: Record<string, unknown>;
  spec_hash: string;
}

// Webhook Handler types
export interface WebhookHandler {
  id: string;
  name: string;
  provider: WebhookProvider;
  event_type: string;
  enabled: boolean;
  code: string;
  created_at: string;
  updated_at: string;
  last_execution?: string;
  execution_count: number;
  success_count: number;
  error_count: number;
}

export type WebhookProvider = 'github' | 'gitlab' | 'bitbucket' | 'slack' | 'discord' | 'custom';

export interface CreateHandlerRequest {
  name: string;
  provider: WebhookProvider;
  event_type: string;
  code: string;
  enabled?: boolean;
}

export interface UpdateHandlerRequest {
  name?: string;
  provider?: WebhookProvider;
  event_type?: string;
  code?: string;
  enabled?: boolean;
}

export interface HandlerExecution {
  id: string;
  handler_id: string;
  status: 'success' | 'error' | 'timeout';
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error_message?: string;
  error_stack?: string;
}

export interface HandlerStats {
  handler_id: string;
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  avg_duration_ms: number;
  last_execution?: string;
  recent_executions: HandlerExecution[];
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
