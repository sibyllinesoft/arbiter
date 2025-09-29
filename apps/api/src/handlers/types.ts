/**
 * Custom webhook handler types and interfaces
 */

import type { SpecWorkbenchDB } from '../db.ts';
import type { EventService } from '../events.ts';
import type { WebhookPayload, WebhookRequest } from '../types.ts';

// Handler execution context
export interface HandlerContext {
  projectId: string;
  provider: 'github' | 'gitlab';
  event: string;
  config: HandlerConfig;
  logger: Logger;
  services: HandlerServices;
  metadata: HandlerMetadata;
}

// Handler configuration
export interface HandlerConfig {
  enabled: boolean;
  timeout: number; // milliseconds
  retries: number;
  environment: Record<string, string>;
  secrets: Record<string, string>; // Encrypted secrets
}

// Available services for handlers
export interface HandlerServices {
  events: EventService;
  db: SpecWorkbenchDB;
  http: HttpClient;
  notifications: NotificationService;
  git: GitService;
}

// Handler metadata
export interface HandlerMetadata {
  handlerPath: string;
  version: string;
  executionId: string;
  timestamp: string;
}

// Handler result
export interface HandlerResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  actions?: string[];
  errors?: HandlerError[];
  duration?: number;
}

// Handler error
export interface HandlerError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

// Enhanced webhook payload with parsed data
export interface EnhancedWebhookPayload extends WebhookPayload {
  parsed: {
    eventType: string;
    action?: string;
    author: {
      name: string;
      email?: string;
      username?: string;
    };
    repository: {
      name: string;
      fullName: string;
      owner: string;
      url: string;
      defaultBranch: string;
      isPrivate: boolean;
    };
    commits?: Array<{
      sha: string;
      message: string;
      author: string;
      url: string;
      timestamp: string;
      added: string[];
      modified: string[];
      removed: string[];
    }>;
    pullRequest?: {
      id: number;
      title: string;
      body: string;
      state: string;
      baseBranch: string;
      headBranch: string;
      url: string;
      merged: boolean;
      mergeable: boolean;
    };
    issue?: {
      id: number;
      title: string;
      body: string;
      state: string;
      labels: string[];
      assignees: string[];
      url: string;
    };
  };
}

// Handler function signature
export type WebhookHandler = (
  payload: EnhancedWebhookPayload,
  context: HandlerContext
) => Promise<HandlerResult>;

// Handler module interface
export interface HandlerModule {
  handler: WebhookHandler;
  config?: Partial<HandlerConfig>;
  metadata?: {
    name: string;
    description: string;
    version: string;
    author?: string;
    supportedEvents: string[];
    requiredPermissions: string[];
  };
}

// Logger interface for handlers
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

// HTTP client interface
export interface HttpClient {
  get(url: string, options?: RequestOptions): Promise<HttpResponse>;
  post(url: string, data?: unknown, options?: RequestOptions): Promise<HttpResponse>;
  put(url: string, data?: unknown, options?: RequestOptions): Promise<HttpResponse>;
  delete(url: string, options?: RequestOptions): Promise<HttpResponse>;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  data: unknown;
  headers: Record<string, string>;
}

// Notification service interface
export interface NotificationService {
  sendSlack(webhook: string, message: SlackMessage): Promise<void>;
  sendWebhook(url: string, payload: unknown): Promise<void>;
}

export interface SlackMessage {
  text?: string;
  blocks?: unknown[];
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

// Git service interface
export interface GitService {
  cloneRepository(url: string, path: string): Promise<void>;
  getCommitDiff(sha: string): Promise<FileDiff[]>;
  getFileContent(path: string, ref?: string): Promise<string>;
  createBranch(name: string, from?: string): Promise<void>;
  createPullRequest(title: string, body: string, base: string, head: string): Promise<unknown>;
}

export interface FileDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  patch?: string;
}

// Handler registry types
export interface RegisteredHandler {
  id: string;
  provider: 'github' | 'gitlab';
  event: string;
  handlerPath: string;
  enabled: boolean;
  config: HandlerConfig;
  lastExecuted?: string;
  executionCount: number;
  errorCount: number;
  metadata: HandlerModule['metadata'];
}

export interface HandlerCreationOptions {
  provider: 'github' | 'gitlab';
  event: string;
  code: string;
  config?: Partial<HandlerConfig>;
  metadata?: {
    name: string;
    description: string;
    version?: string;
    author?: string;
  };
}

export interface HandlerExecution {
  id: string;
  handlerId: string;
  projectId: string;
  provider: 'github' | 'gitlab';
  event: string;
  payload: EnhancedWebhookPayload;
  result: HandlerResult;
  startedAt: string;
  completedAt: string;
  duration: number;
}

// Configuration for handler discovery
export interface HandlerDiscoveryConfig {
  handlersDirectory: string;
  enableAutoReload: boolean;
  maxConcurrentExecutions: number;
  defaultTimeout: number;
  defaultRetries: number;
  sandboxEnabled: boolean;
  allowedModules: string[];
  enableMetrics: boolean;
}

export { WebhookPayload, WebhookRequest } from '../types';
