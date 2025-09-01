import type { AnalysisResult, CueError, GraphNode } from '@arbiter/shared';

/**
 * Configuration options for the Arbiter client
 */
export interface ClientOptions {
  /** Base URL for the Arbiter server (default: http://localhost:3000) */
  baseUrl?: string;
  /** API key for authentication (if required) */
  apiKey?: string;
  /** Custom client identifier for rate limiting */
  clientId?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Retry configuration */
  retry?: RetryOptions;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay between retries in milliseconds (default: 1000) */
  baseDelay?: number;
  /** Maximum delay between retries in milliseconds (default: 10000) */
  maxDelay?: number;
  /** Exponential backoff multiplier (default: 2) */
  backoffFactor?: number;
  /** Jitter factor for randomizing delays (default: 0.1) */
  jitter?: number;
}

/**
 * Options for validateArchitecture method
 */
export interface ValidateArchitectureOptions {
  /** CUE schema definition */
  schema: string;
  /** Configuration to validate against schema */
  config: string;
  /** Request ID for tracking (optional, auto-generated if not provided) */
  requestId?: string;
  /** Enable strict validation mode */
  strict?: boolean;
}

/**
 * Result of architecture validation
 */
export interface ValidationResult {
  /** Request ID for tracking */
  requestId: string;
  /** Validation success status */
  valid: boolean;
  /** List of errors and violations */
  errors: CueError[];
  /** Evaluated configuration value if valid */
  value?: unknown;
  /** Graph representation of the architecture */
  graph?: GraphNode[];
  /** Violation summary */
  violations: {
    errors: number;
    warnings: number;
    info: number;
  };
}

/**
 * Result of error explanation
 */
export interface ExplainResult {
  /** Original error */
  error: CueError;
  /** Human-friendly explanation */
  explanation: string;
  /** Suggested fixes */
  suggestions: string[];
  /** Error category */
  category: string;
  /** Related documentation links */
  documentation?: string[];
  /** Example fixes */
  examples?: {
    before: string;
    after: string;
    description: string;
  }[];
}

/**
 * Options for export functionality
 */
export interface ExportOptions {
  /** Export format */
  format: 'openapi' | 'typescript' | 'kubernetes' | 'terraform' | 'json-schema';
  /** Enable strict mode for export */
  strict?: boolean;
  /** Include examples in export */
  includeExamples?: boolean;
  /** Output mode for multiple schemas */
  outputMode?: 'single' | 'multiple';
  /** Custom export configuration */
  config?: Record<string, unknown>;
}

/**
 * Result of export operation
 */
export interface ExportResult {
  /** Export success status */
  success: boolean;
  /** Export format used */
  format: string;
  /** Generated output */
  output: string | Record<string, string>;
  /** Export metadata */
  metadata: {
    generatedAt: string;
    version: string;
    sourceHash?: string;
  };
  /** Warnings during export */
  warnings?: string[];
}

/**
 * Server compatibility information
 */
export interface CompatibilityInfo {
  /** SDK version */
  sdkVersion: string;
  /** Server version */
  serverVersion: string;
  /** Protocol version */
  protocolVersion: string;
  /** Compatibility status */
  compatible: boolean;
  /** Compatibility warnings or errors */
  messages?: string[];
  /** Supported features */
  features: {
    validation: boolean;
    export: boolean;
    websocket: boolean;
    realtime: boolean;
  };
}

/**
 * WebSocket connection options
 */
export interface WebSocketOptions {
  /** Enable WebSocket for real-time updates */
  enabled?: boolean;
  /** WebSocket URL override */
  wsUrl?: string;
  /** Reconnection options */
  reconnect?: {
    enabled: boolean;
    maxAttempts: number;
    delay: number;
  };
}

/**
 * Event handlers for WebSocket connection
 */
export interface EventHandlers {
  /** Called when validation result is received */
  onValidationResult?: (result: ValidationResult) => void;
  /** Called when connection status changes */
  onConnectionChange?: (connected: boolean) => void;
  /** Called on WebSocket errors */
  onError?: (error: Error) => void;
  /** Called on real-time updates */
  onUpdate?: (update: unknown) => void;
}