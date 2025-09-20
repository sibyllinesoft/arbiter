import type { IRResponse, ValidationRequest, ValidationResponse } from '@arbiter/shared';
import { COMMON_PORTS } from './config.js';
import type { CLIConfig, CommandResult } from './types.js';

/**
 * Rate-limited HTTP API client for Arbiter server
 * Implements rate limiting (≤1 RPS), payload size limits (≤64KB), and timeout compliance (≤750ms)
 * according to the Arbiter specification
 */
export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private lastRequestTime = 0;
  private discoveredUrl: string | null = null;
  private readonly MAX_PAYLOAD_SIZE = 64 * 1024; // 64KB
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second (1 RPS)
  private readonly MAX_TIMEOUT = 750; // 750ms per spec

  constructor(config: CLIConfig) {
    this.baseUrl = config.apiUrl.replace(/\/$/, ''); // Remove trailing slash
    // Ensure timeout compliance with spec (≤750ms)
    this.timeout = Math.min(config.timeout, this.MAX_TIMEOUT);
  }

  /**
   * Auto-discover server by trying common ports
   */
  async discoverServer(): Promise<{ success: boolean; url?: string; error?: string }> {
    const hostname = new URL(this.baseUrl).hostname;
    const protocol = new URL(this.baseUrl).protocol;

    for (const port of COMMON_PORTS) {
      const testUrl = `${protocol}//${hostname}:${port}`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000); // Quick discovery timeout

        const response = await fetch(`${testUrl}/health`, {
          signal: controller.signal,
          method: 'GET',
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          this.discoveredUrl = testUrl;
          return { success: true, url: testUrl };
        }
      } catch {}
    }

    return {
      success: false,
      error: `No Arbiter server found on common ports [${COMMON_PORTS.join(', ')}]. Please ensure the server is running.`,
    };
  }

  /**
   * Get the effective base URL (discovered or configured)
   */
  private getEffectiveBaseUrl(): string {
    return this.discoveredUrl || this.baseUrl;
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
      throw new Error(
        `Payload size ${size} bytes exceeds maximum allowed ${this.MAX_PAYLOAD_SIZE} bytes (64KB)`
      );
    }
  }

  /**
   * Validate CUE content using the /api/validate endpoint
   */
  async validate(
    content: string,
    _options: {
      schema?: string;
      strict?: boolean;
    } = {}
  ): Promise<CommandResult<ValidationResponse>> {
    try {
      await this.enforceRateLimit();
      this.validatePayloadSize(content);

      const request: ValidationRequest = {
        text: content,
        files: [], // Empty files array for text-based validation
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
   * Lightweight helper for ad-hoc API requests
   */
  async request(path: string, init: RequestInit = {}): Promise<Response> {
    await this.enforceRateLimit();
    return this.fetch(path, init);
  }

  /**
   * List fragments for a project
   */
  async listFragments(projectId = 'default'): Promise<CommandResult<any[]>> {
    try {
      await this.enforceRateLimit();

      const response = await this.fetch(
        `/api/fragments?projectId=${encodeURIComponent(projectId)}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API error: ${response.status} ${errorText}`,
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
        error: `Network error: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 2,
      };
    }
  }

  /**
   * Update or create a fragment
   */
  async updateFragment(
    projectId: string,
    path: string,
    content: string,
    options?: { author?: string; message?: string }
  ): Promise<CommandResult<any>> {
    try {
      await this.enforceRateLimit();
      this.validatePayloadSize(content);

      const requestPayload = JSON.stringify({
        projectId,
        path,
        content,
        author: options?.author,
        message: options?.message,
      });
      this.validatePayloadSize(requestPayload);

      const response = await this.fetch('/api/fragments', {
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

      const data = await response.json();

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
   * Store CUE specification in service database with sharding support
   */
  async storeSpecification(spec: {
    content: string;
    type: string;
    path: string;
    shard?: string;
  }): Promise<CommandResult<{ success: boolean; id: string; shard?: string }>> {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substr(2, 9);

    console.log(
      `[CLI-STORE] ${requestId} - Starting storeSpecification at ${new Date().toISOString()}`
    );
    console.log(`[CLI-STORE] ${requestId} - Spec details:`, {
      type: spec.type,
      path: spec.path,
      contentLength: spec.content?.length || 0,
    });

    await this.enforceRateLimit();

    try {
      console.log(`[CLI-STORE] ${requestId} - Making POST request to /api/specifications`);

      const response = await this.fetch('/api/specifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...spec,
          sharded: true, // Indicate this should use sharded storage
        }),
      });

      const duration = Date.now() - startTime;
      console.log(
        `[CLI-STORE] ${requestId} - Response received after ${duration}ms, status: ${response.status}`
      );

      if (!response.ok) {
        const error = await response.text();
        console.error(
          `[CLI-STORE] ${requestId} - Failed with status ${response.status}, error: ${error}`
        );
        return {
          success: false,
          data: null,
          error: `Failed to store specification: ${error}`,
          exitCode: 1,
        };
      }

      const data = await response.json();
      console.log(`[CLI-STORE] ${requestId} - Success after ${duration}ms`);
      return { success: true, data, error: null, exitCode: 0 };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[CLI-STORE] ${requestId} - Network error after ${duration}ms:`, error);

      return {
        success: false,
        data: null,
        error: `Network error storing specification: ${error}`,
        exitCode: 2,
      };
    }
  }

  /**
   * Get CUE specification from service database
   */
  async getSpecification(type: string, path: string): Promise<CommandResult<{ content: string }>> {
    await this.enforceRateLimit();

    try {
      const params = new URLSearchParams({ type, path });
      const response = await this.fetch(`/api/specifications?${params}`);

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            data: null,
            error: 'Specification not found',
            exitCode: 1,
          };
        }
        const error = await response.text();
        return {
          success: false,
          data: null,
          error: `Failed to get specification: ${error}`,
          exitCode: 1,
        };
      }

      const data = await response.json();
      return { success: true, data, error: null, exitCode: 0 };
    } catch (error) {
      return {
        success: false,
        data: null,
        error: `Network error getting specification: ${error}`,
        exitCode: 2,
      };
    }
  }

  /**
   * Check server health using the /health endpoint
   * Automatically attempts discovery if initial connection fails
   */
  async health(): Promise<CommandResult<{ status: string; timestamp: string }>> {
    try {
      await this.enforceRateLimit();

      // First try the configured URL
      let response = await this.fetch('/health');

      // If it fails, try auto-discovery
      if (!response.ok || response.status === 404) {
        console.warn(
          `Initial connection to ${this.baseUrl} failed. Attempting server discovery...`
        );
        const discovery = await this.discoverServer();

        if (discovery.success && discovery.url) {
          console.log(`✓ Found server at ${discovery.url}`);
          // Retry with discovered URL
          response = await this.fetch('/health');
        } else {
          return {
            success: false,
            error: discovery.error || `Cannot reach server at ${this.baseUrl}`,
            exitCode: 2,
          };
        }
      }

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
      // Try auto-discovery on any connection error
      const discovery = await this.discoverServer();

      if (discovery.success) {
        return this.health(); // Retry after discovery
      }

      return {
        success: false,
        error:
          discovery.error ||
          `Cannot reach server: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 2,
      };
    }
  }

  /**
   * Export CUE content to various formats using the dedicated /export endpoint
   */
  async export(
    content: string,
    format: string,
    options: {
      strict?: boolean;
      includeExamples?: boolean;
      outputMode?: 'single' | 'multiple';
    } = {}
  ): Promise<CommandResult<any>> {
    try {
      const response = await this.fetch('/export', {
        method: 'POST',
        body: JSON.stringify({
          text: content,
          format,
          strict: options.strict || false,
          includeExamples: options.includeExamples || false,
          outputMode: options.outputMode || 'single',
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
   * List components by type
   */
  async listComponents(type?: string): Promise<CommandResult<any[]>> {
    try {
      await this.enforceRateLimit();

      const url = type ? `/api/components?type=${encodeURIComponent(type)}` : '/api/components';
      const response = await this.fetch(url);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API error: ${response.status} ${errorText}`,
          exitCode: 1,
        };
      }

      const data = await response.json();

      return {
        success: true,
        data: data.components || [],
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
   * Get project status
   */
  async getProjectStatus(): Promise<CommandResult<any>> {
    try {
      await this.enforceRateLimit();

      const response = await this.fetch('/api/status');

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API error: ${response.status} ${errorText}`,
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
        error: `Network error: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 2,
      };
    }
  }

  /**
   * Validate best practices (if API supports it)
   */
  async validateBestPractices?(content: string): Promise<CommandResult<any>> {
    try {
      await this.enforceRateLimit();
      this.validatePayloadSize(content);

      const requestPayload = JSON.stringify({ content });
      this.validatePayloadSize(requestPayload);

      const response = await this.fetch('/api/validate/best-practices', {
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

      const data = await response.json();

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
   * Validate custom rules (if API supports it)
   */
  async validateCustomRules?(content: string, rules: string[]): Promise<CommandResult<any>> {
    try {
      await this.enforceRateLimit();
      this.validatePayloadSize(content);

      const requestPayload = JSON.stringify({ content, rules });
      this.validatePayloadSize(requestPayload);

      const response = await this.fetch('/api/validate/custom-rules', {
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

      const data = await response.json();

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
   * Validate project consistency (if API supports it)
   */
  async validateProjectConsistency?(content: string): Promise<CommandResult<any>> {
    try {
      await this.enforceRateLimit();
      this.validatePayloadSize(content);

      const requestPayload = JSON.stringify({ content });
      this.validatePayloadSize(requestPayload);

      const response = await this.fetch('/api/validate/consistency', {
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

      const data = await response.json();

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
   * Internal fetch wrapper with timeout and error handling
   */
  private async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const baseUrl = this.getEffectiveBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    const fetchStartTime = Date.now();
    const fetchId = Math.random().toString(36).substr(2, 9);

    console.log(
      `[CLI-FETCH] ${fetchId} - Starting request to ${url} at ${new Date().toISOString()}`
    );
    console.log(`[CLI-FETCH] ${fetchId} - Timeout configured: ${this.timeout}ms`);
    console.log(`[CLI-FETCH] ${fetchId} - Method: ${options.method || 'GET'}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`[CLI-FETCH] ${fetchId} - TIMEOUT! Aborting after ${this.timeout}ms`);
      controller.abort();
    }, this.timeout);

    try {
      console.log(`[CLI-FETCH] ${fetchId} - Calling fetch() now...`);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      const duration = Date.now() - fetchStartTime;
      clearTimeout(timeoutId);

      console.log(`[CLI-FETCH] ${fetchId} - Response received after ${duration}ms`);
      console.log(`[CLI-FETCH] ${fetchId} - Status: ${response.status} ${response.statusText}`);

      return response;
    } catch (error) {
      const duration = Date.now() - fetchStartTime;
      clearTimeout(timeoutId);

      console.error(`[CLI-FETCH] ${fetchId} - Error after ${duration}ms:`, error);

      if (error instanceof Error && error.name === 'AbortError') {
        const errorMsg = `Request timeout after ${this.timeout}ms connecting to ${baseUrl}`;
        console.error(`[CLI-FETCH] ${fetchId} - TIMEOUT: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Enhance error message with connection details
      if (
        error instanceof Error &&
        (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed'))
      ) {
        const errorMsg = `Connection failed to ${baseUrl}. Is the Arbiter server running?`;
        console.error(`[CLI-FETCH] ${fetchId} - CONNECTION FAILED: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      console.error(`[CLI-FETCH] ${fetchId} - OTHER ERROR:`, error);
      throw error;
    }
  }
}
