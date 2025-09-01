import type { 
  ValidationRequest, 
  ValidationResponse, 
  IRResponse 
} from '@arbiter/shared';
import type { CLIConfig, CommandResult } from './types.js';

/**
 * Rate-limited HTTP API client for Arbiter server
 * Implements rate limiting (≤1 RPS), payload size limits (≤64KB), and timeout compliance (≤750ms)
 * according to the Arbiter specification
 */
export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private lastRequestTime: number = 0;
  private readonly MAX_PAYLOAD_SIZE = 64 * 1024; // 64KB
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second (1 RPS)
  private readonly MAX_TIMEOUT = 750; // 750ms per spec

  constructor(config: CLIConfig) {
    this.baseUrl = config.apiUrl.replace(/\/$/, ''); // Remove trailing slash
    // Ensure timeout compliance with spec (≤750ms)
    this.timeout = Math.min(config.timeout, this.MAX_TIMEOUT);
  }

  /**
   * Enforce rate limiting (≤1 RPS) with exponential backoff
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Validate payload size (≤64KB)
   */
  private validatePayloadSize(payload: string): void {
    const size = new TextEncoder().encode(payload).length;
    if (size > this.MAX_PAYLOAD_SIZE) {
      throw new Error(`Payload size ${size} bytes exceeds maximum allowed ${this.MAX_PAYLOAD_SIZE} bytes (64KB)`);
    }
  }

  /**
   * Validate CUE content using the /api/validate endpoint
   */
  async validate(content: string, options: {
    schema?: string;
    strict?: boolean;
  } = {}): Promise<CommandResult<ValidationResponse>> {
    try {
      await this.enforceRateLimit();
      this.validatePayloadSize(content);

      const request: ValidationRequest = {
        text: content,
        projectId: 'cli-project', // Use a default project ID for CLI
      };

      const requestPayload = JSON.stringify(request);
      this.validatePayloadSize(requestPayload);

      const response = await this.fetch('/api/validate', {
        method: 'POST',
        body: requestPayload,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API error: ${response.status} ${errorText}`,
          exitCode: 1,
        };
      }

      const data: ValidationResponse = await response.json();
      
      return {
        success: data.success,
        data,
        exitCode: data.success ? 0 : 1,
      };
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 2,
      };
    }
  }

  /**
   * Get intermediate representation using the /api/ir endpoint
   */
  async getIR(content: string): Promise<CommandResult<IRResponse>> {
    try {
      await this.enforceRateLimit();
      this.validatePayloadSize(content);

      const requestPayload = JSON.stringify({ text: content });
      this.validatePayloadSize(requestPayload);

      const response = await this.fetch('/api/ir', {
        method: 'POST',
        body: requestPayload,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API error: ${response.status} ${errorText}`,
          exitCode: 1,
        };
      }

      const data: IRResponse = await response.json();
      
      return {
        success: true,
        data,
        exitCode: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 2,
      };
    }
  }

  /**
   * Check server health using the /health endpoint
   */
  async health(): Promise<CommandResult<{ status: string; timestamp: string }>> {
    try {
      await this.enforceRateLimit();
      const response = await this.fetch('/health');

      if (!response.ok) {
        return {
          success: false,
          error: `Server unhealthy: ${response.status}`,
          exitCode: 1,
        };
      }

      const data = await response.json();
      
      return {
        success: true,
        data,
        exitCode: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: `Cannot reach server: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 2,
      };
    }
  }

  /**
   * Export CUE content to various formats using the dedicated /export endpoint
   */
  async export(content: string, format: string, options: {
    strict?: boolean;
    includeExamples?: boolean;
    outputMode?: 'single' | 'multiple';
  } = {}): Promise<CommandResult<any>> {
    try {
      const response = await this.fetch('/export', {
        method: 'POST',
        body: JSON.stringify({
          text: content,
          format,
          strict: options.strict || false,
          includeExamples: options.includeExamples || false,
          outputMode: options.outputMode || 'single'
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        return {
          success: false,
          error: errorData.error || `Export failed: ${response.status}`,
          exitCode: 1,
        };
      }

      const data = await response.json();
      
      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Export failed',
          exitCode: 1,
        };
      }

      return {
        success: true,
        data,
        exitCode: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: `Export error: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 2,
      };
    }
  }

  /**
   * Get supported export formats from the API
   */
  async getSupportedFormats(): Promise<CommandResult<any>> {
    try {
      const response = await this.fetch('/export/formats');

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to get formats: ${response.status}`,
          exitCode: 1,
        };
      }

      const data = await response.json();
      
      return {
        success: data.success,
        data: data.formats,
        exitCode: data.success ? 0 : 1,
      };
    } catch (error) {
      return {
        success: false,
        error: `Network error: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 2,
      };
    }
  }

  /**
   * Internal fetch wrapper with timeout and error handling
   */
  private async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      
      throw error;
    }
  }

}