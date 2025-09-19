/**
 * Shared API types for Arbiter applications
 *
 * This package contains all the TypeScript interfaces and types that are shared
 * between the API server and any frontend applications.
 */

// Re-export database types from Drizzle schema
export type {
  Project,
  NewProject,
  Fragment,
  NewFragment,
  FragmentRevision,
  NewFragmentRevision,
  Version,
  NewVersion,
  Event,
  NewEvent,
  AuthToken,
  NewAuthToken,
  OAuthClient,
  NewOAuthClient,
  OAuthAuthCode,
  NewOAuthAuthCode,
  User,
  NewUser,
  ProjectMember,
  NewProjectMember,
} from "./database.ts";

// Re-export API request/response types
export type {
  // Fragment API
  CreateFragmentRequest,
  CreateFragmentResponse,
  UpdateFragmentRequest,
  UpdateFragmentResponse,
  FragmentListResponse,
  FragmentRevisionsResponse,
  // Project API
  ProjectListResponse,
  ProjectCreateRequest,
  ProjectCreateResponse,
  // Validation API
  ValidationRequest,
  ValidationResponse,
  ValidationError,
  ValidationWarning,
  // Resolved spec API
  ResolvedSpecResponse,
  // Gap analysis API
  GapAnalysisResponse,
  // IR generation API
  IRGenerationRequest,
  IRGenerationResponse,
  // Freeze API
  FreezeRequest,
  FreezeResponse,
  // Webhook API
  WebhookConfigRequest,
  WebhookConfigResponse,
  WebhookListResponse,
  // Authentication API
  AuthRequest,
  AuthResponse,
  TokenRequest,
  TokenResponse,
  UserInfoResponse,
  // Error handling
  ProblemDetails,
  ApiError,
} from "./api.ts";

// Re-export event types for real-time communication
export type { EventType, WebSocketMessage, BroadcastEvent } from "./events.ts";

// Re-export utility types
export type {
  IRKind,
  AuthContext,
  ServerConfig,
  PaginationParams,
  SortOrder,
  FilterParams,
} from "./common.ts";
