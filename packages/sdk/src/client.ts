import type { 
  AnalysisResult, 
  CueError, 
  AnalyzeRequest
} from '@arbiter/shared';
import { 
  analyzeRequestSchema,
  analysisResultSchema 
} from '@arbiter/shared';
import { z } from 'zod';
import { 
  NetworkError, 
  ValidationError, 
  TimeoutError, 
  CompatibilityError,
  RateLimitError 
} from './errors.js';
import { ExponentialBackoff, RetryConfig } from './retry.js';
import type {
  ClientOptions,
  ValidateArchitectureOptions,
  ValidationResult,
  ExplainResult,
  ExportResult,
  ExportOptions,
  CompatibilityInfo,
  WebSocketOptions,
  EventHandlers,
} from './types.js';

/**
 * Protocol version supported by this SDK
 */
export const PROTOCOL_VERSION = '1.0';

/**
 * SDK version
 */
export const SDK_VERSION = '0.1.0';

/**
 * Main Arbiter client for architecture validation
 */
export class ArbiterClient {
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly clientId: string;
  private readonly apiKey?: string;
  private readonly debug: boolean;
  private readonly backoff: ExponentialBackoff;

  private wsConnection?: WebSocket;
  private eventHandlers: EventHandlers = {};

  constructor(options: ClientOptions = {}) {
    this.baseUrl = options.baseUrl?.replace(/\/$/, '') || 'http://localhost:3000';
    this.timeout = options.timeout || 30000;
    this.clientId = options.clientId || `sdk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    this.apiKey = options.apiKey;
    this.debug = options.debug || false;
    
    const retryConfig = new RetryConfig(options.retry);
    this.backoff = new ExponentialBackoff(retryConfig);
  }

  /**
   * Validate architecture configuration against schema
   */
  async validateArchitecture(
    options: ValidateArchitectureOptions
  ): Promise<ValidationResult> {
    const requestId = options.requestId || this.generateRequestId();
    
    // Combine schema and config for analysis
    const combinedText = `${options.schema}\n\n${options.config}`;
    
    const request: AnalyzeRequest = {
      text: combinedText,
      requestId,
    };

    this.log('Validating architecture', { requestId, textLength: combinedText.length });

    const analysisResult = await this.backoff.execute(
      () => this.makeRequest('/analyze', {
        method: 'POST',
        body: JSON.stringify(request),
        headers: this.getHeaders(),
      }),
      `validateArchitecture(${requestId})`
    );

    // Parse and validate response
    const parsedResult = analysisResultSchema.parse(analysisResult);
    
    // Transform to ValidationResult
    const violations = this.categorizeViolations(parsedResult.errors);
    
    return {
      requestId: parsedResult.requestId,
      valid: parsedResult.errors.length === 0,
      errors: parsedResult.errors,
      value: parsedResult.value,
      graph: parsedResult.graph,
      violations,
    };
  }

  /**
   * Explain validation errors in human-friendly terms
   */
  async explain(errors: CueError[]): Promise<ExplainResult[]> {
    this.log('Explaining errors', { errorCount: errors.length });

    const results: ExplainResult[] = [];
    
    for (const error of errors) {
      // Use error translator from shared package for enhanced explanations
      const explanation = await this.translateError(error);
      
      results.push({
        error,
        explanation: explanation.friendlyMessage || error.message,
        suggestions: explanation.suggestions || [],
        category: explanation.category || 'unknown',
        documentation: explanation.documentation,
        examples: explanation.examples,
      });
    }

    return results;
  }

  /**
   * Export validated architecture to various formats
   */
  async export(
    text: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    this.log('Exporting architecture', { format: options.format, textLength: text.length });

    const request = {
      text,
      format: options.format,
      strict: options.strict || false,
      includeExamples: options.includeExamples || false,
      outputMode: options.outputMode || 'single',
      ...options.config,
    };

    const result = await this.backoff.execute(
      () => this.makeRequest('/export', {
        method: 'POST',
        body: JSON.stringify(request),
        headers: this.getHeaders(),
      }),
      `export(${options.format})`
    );

    return {
      success: result.success || false,
      format: options.format,
      output: result.output || result.data || '',
      metadata: {
        generatedAt: new Date().toISOString(),
        version: SDK_VERSION,
        sourceHash: this.hashText(text),
      },
      warnings: result.warnings,
    };
  }

  /**
   * Check compatibility with server
   */
  async checkCompatibility(): Promise<CompatibilityInfo> {
    this.log('Checking server compatibility');

    try {
      const health = await this.backoff.execute(
        () => this.makeRequest('/health', {
          method: 'GET',
          headers: this.getHeaders(),
        }),
        'checkCompatibility'
      );

      const serverVersion = health.version || 'unknown';
      const protocolVersion = health.protocolVersion || '1.0';
      
      const compatible = this.isVersionCompatible(protocolVersion);
      
      return {
        sdkVersion: SDK_VERSION,
        serverVersion,
        protocolVersion,
        compatible,
        messages: compatible ? [] : [`Protocol version ${protocolVersion} is not compatible with SDK version ${SDK_VERSION}`],
        features: {
          validation: true,
          export: true,
          websocket: true,
          realtime: health.features?.realtime || false,
        },
      };
    } catch (error) {
      throw new CompatibilityError(
        'Failed to check server compatibility',
        SDK_VERSION,
        'unknown'
      );
    }
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  async connectWebSocket(
    options: WebSocketOptions = {},
    handlers: EventHandlers = {}
  ): Promise<void> {
    if (this.wsConnection?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    this.eventHandlers = { ...handlers };
    
    const wsUrl = options.wsUrl || this.baseUrl.replace(/^http/, 'ws');
    
    this.log('Connecting to WebSocket', { wsUrl });

    return new Promise((resolve, reject) => {
      try {
        this.wsConnection = new WebSocket(wsUrl);
        
        this.wsConnection.onopen = () => {
          this.log('WebSocket connected');
          this.eventHandlers.onConnectionChange?.(true);
          resolve();
        };

        this.wsConnection.onmessage = (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
          } catch (error) {
            this.log('Failed to parse WebSocket message', error);
          }
        };

        this.wsConnection.onclose = () => {
          this.log('WebSocket disconnected');
          this.eventHandlers.onConnectionChange?.(false);
          
          // Auto-reconnect if enabled
          if (options.reconnect?.enabled) {
            this.handleReconnect(options, handlers);
          }
        };

        this.wsConnection.onerror = (error: Event) => {
          this.log('WebSocket error', error);
          this.eventHandlers.onError?.(new NetworkError('WebSocket connection error'));
          reject(new NetworkError('Failed to connect to WebSocket'));
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnectWebSocket(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = undefined;
    }
  }

  /**
   * Get list of supported export formats
   */
  async getSupportedFormats(): Promise<Array<{ format: string; description: string }>> {
    this.log('Getting supported export formats');

    const result = await this.backoff.execute(
      () => this.makeRequest('/export/formats', {
        method: 'GET',
        headers: this.getHeaders(),
      }),
      'getSupportedFormats'
    );

    return result.formats || [];
  }

  // Private helper methods

  private async makeRequest(endpoint: string, options: RequestInit): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new RateLimitError(
            'Rate limit exceeded',
            retryAfter ? parseInt(retryAfter) * 1000 : undefined
          );
        }
        
        const errorBody = await response.text();
        throw new NetworkError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorBody
        );
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new TimeoutError(`Request timed out after ${this.timeout}ms`, this.timeout);
      }
      
      throw error;
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'x-client-id': this.clientId,
      'x-sdk-version': SDK_VERSION,
      'x-protocol-version': PROTOCOL_VERSION,
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  private categorizeViolations(errors: CueError[]): { errors: number; warnings: number; info: number } {
    const violations = { errors: 0, warnings: 0, info: 0 };
    
    for (const error of errors) {
      switch (error.severity) {
        case 'error':
          violations.errors++;
          break;
        case 'warning':
          violations.warnings++;
          break;
        case 'info':
          violations.info++;
          break;
        default:
          violations.errors++; // Default to error
      }
    }

    return violations;
  }

  private async translateError(error: CueError): Promise<{
    friendlyMessage?: string;
    suggestions?: string[];
    category?: string;
    documentation?: string[];
    examples?: Array<{ before: string; after: string; description: string }>;
  }> {
    // Basic error translation - in a full implementation, this would use
    // the error translator from the shared package
    return {
      friendlyMessage: error.friendlyMessage || error.message,
      suggestions: [],
      category: 'validation',
      documentation: [],
      examples: [],
    };
  }

  private generateRequestId(): string {
    return `req-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private hashText(text: string): string {
    // Simple hash for source identification
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  private isVersionCompatible(serverProtocolVersion: string): boolean {
    // Simple version compatibility check
    const [serverMajor] = serverProtocolVersion.split('.').map(Number);
    const [clientMajor] = PROTOCOL_VERSION.split('.').map(Number);
    
    return serverMajor === clientMajor;
  }

  private handleWebSocketMessage(data: any): void {
    switch (data.type) {
      case 'analysis_result':
        if (this.eventHandlers.onValidationResult) {
          const result: ValidationResult = {
            requestId: data.requestId,
            valid: data.errors.length === 0,
            errors: data.errors,
            value: data.value,
            graph: data.graph,
            violations: this.categorizeViolations(data.errors),
          };
          this.eventHandlers.onValidationResult(result);
        }
        break;
      
      default:
        if (this.eventHandlers.onUpdate) {
          this.eventHandlers.onUpdate(data);
        }
    }
  }

  private async handleReconnect(
    options: WebSocketOptions,
    handlers: EventHandlers
  ): Promise<void> {
    if (!options.reconnect?.enabled) return;

    const maxAttempts = options.reconnect.maxAttempts || 5;
    const delay = options.reconnect.delay || 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
        await this.connectWebSocket(options, handlers);
        this.log(`WebSocket reconnected after ${attempt} attempts`);
        return;
      } catch (error) {
        this.log(`WebSocket reconnection attempt ${attempt} failed:`, error);
        
        if (attempt === maxAttempts) {
          this.eventHandlers.onError?.(
            new NetworkError(`Failed to reconnect after ${maxAttempts} attempts`)
          );
        }
      }
    }
  }

  private log(message: string, data?: any): void {
    if (this.debug) {
      console.log(`[Arbiter SDK] ${message}`, data || '');
    }
  }
}