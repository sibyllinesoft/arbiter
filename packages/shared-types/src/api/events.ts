/**
 * Event and WebSocket types for real-time communication
 *
 * These types define the structure for real-time events
 * and WebSocket messages used throughout the application.
 */

// Event types for real-time collaboration
export type EventType =
  | "fragment_created"
  | "fragment_updated"
  | "fragment_deleted"
  | "fragment_revision_created"
  | "validation_started"
  | "validation_completed"
  | "validation_failed"
  | "version_frozen"
  | "webhook_received"
  | "git_push_processed"
  | "git_merge_processed"
  | "user_joined"
  | "user_left"
  | "project_activity"
  | "entity_created"
  | "entity_updated"
  | "entity_deleted"
  | "entity_restored";

// WebSocket message types
export interface WebSocketMessage {
  type: "subscribe" | "unsubscribe" | "ping" | "pong" | "event";
  project_id?: string;
  event_type?: EventType;
  data?: Record<string, unknown>;
  timestamp?: string;
  id?: string;
}

// Broadcast event structure
export interface BroadcastEvent {
  project_id: string;
  event_type: EventType;
  data: Record<string, unknown>;
  timestamp?: string;
}

// Specific event data types
export interface FragmentCreatedEvent {
  fragment_id: string;
  fragment_path: string;
  user_id: string;
  content_length: number;
}

export interface FragmentUpdatedEvent {
  fragment_id: string;
  fragment_path: string;
  user_id: string;
  revision_id: string;
  content_length: number;
}

export interface FragmentDeletedEvent {
  fragment_id: string;
  fragment_path: string;
  user_id: string;
}

export interface FragmentRevisionCreatedEvent {
  fragment_id: string;
  fragment_path: string;
  revision_id: string;
  revision_number: number;
  user_id: string;
  author?: string;
  message?: string;
  content_hash: string;
}

export interface ValidationStartedEvent {
  user_id: string;
  fragment_count: number;
  validation_id?: string;
}

export interface ValidationCompletedEvent {
  user_id: string;
  spec_hash: string;
  error_count: number;
  warning_count: number;
  validation_id?: string;
  duration_ms?: number;
}

export interface ValidationFailedEvent {
  user_id: string;
  spec_hash: string;
  error_count: number;
  warning_count: number;
  validation_id?: string;
  failure_reason?: string;
}

export interface VersionFrozenEvent {
  version_id: string;
  version_name: string;
  spec_hash: string;
  user_id: string;
  description?: string;
}

export interface WebhookReceivedEvent {
  webhook_id: string;
  provider: "github" | "gitlab";
  event_type: string;
  repository?: string;
  sender?: string;
  processed: boolean;
}

export interface GitPushProcessedEvent {
  webhook_id: string;
  repository: string;
  branch: string;
  commits: number;
  files_changed: number;
  validation_triggered: boolean;
}

export interface GitMergeProcessedEvent {
  webhook_id: string;
  repository: string;
  source_branch: string;
  target_branch: string;
  merge_commit: string;
  validation_triggered: boolean;
}

export interface UserJoinedEvent {
  user_id: string;
  user_name?: string;
  connection_id: string;
  timestamp: string;
}

export interface UserLeftEvent {
  user_id: string;
  user_name?: string;
  connection_id: string;
  timestamp: string;
  duration_ms: number;
}

export interface ProjectActivityEvent {
  activity_type: "view" | "edit" | "validate" | "export";
  user_id: string;
  resource_type: "fragment" | "project" | "version";
  resource_id: string;
  metadata?: Record<string, unknown>;
}

// WebSocket connection types
export interface WebSocketConnection {
  id: string;
  user_id: string;
  project_id?: string;
  connected_at: string;
  last_ping?: string;
  subscriptions: string[];
}

// Event subscription types
export interface EventSubscription {
  connection_id: string;
  project_id: string;
  event_types: EventType[];
  created_at: string;
}

// Real-time stats
export interface ConnectionStats {
  totalConnections: number;
  totalProjects: number;
  activeUsers: number;
  eventsSentLastMinute: number;
  averageLatency: number;
}
