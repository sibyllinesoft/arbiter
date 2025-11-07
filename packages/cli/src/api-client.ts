import type { IRResponse, ValidationRequest, ValidationResponse } from "@arbiter/shared";
import { COMMON_PORTS } from "./config.js";
import type { AuthSession, CLIConfig, CommandResult } from "./types.js";

/**
 * @packageDocumentation
 * Provides a thin, rate-limited HTTP client used by the Arbiter CLI to
 * communicate with the Spec Workbench API.
 */
/**
 * Rate-limited HTTP client for the Arbiter API that enforces the specification
 * constraints around payload size, request cadence, and request timeout.
 *
 * @public
 */
export class ApiClient {
  private baseUrl: string;
  private timeout: number;
  private projectId: string;
  private lastRequestTime = 0;
  private discoveredUrl: string | null = null;
  private authSession?: AuthSession;
  private warnedAboutExpiredToken = false;
  private readonly debugFetchLogs: boolean;
  private readonly MAX_PAYLOAD_SIZE = 64 * 1024; // 64KB
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second (1 RPS)
  private readonly MAX_TIMEOUT = 750; // 750ms per spec

  constructor(config: CLIConfig) {
    this.baseUrl = config.apiUrl.replace(/\/$/, ""); // Remove trailing slash
    // Ensure timeout compliance with spec (≤750ms)
    this.timeout = Math.min(config.timeout, this.MAX_TIMEOUT);
    this.projectId = config.projectId || "cli-project"; // Use configured project ID or fallback
    this.authSession = config.authSession;
    const fetchDebugFlag = process.env.ARBITER_FETCH_DEBUG?.toLowerCase?.() ?? "";
    const debugNamespace = process.env.DEBUG ?? "";
    this.debugFetchLogs =
      fetchDebugFlag === "1" || fetchDebugFlag === "true" || /arbiter:fetch/.test(debugNamespace);
  }

  /**
   * Updates the project identifier that subsequent requests should target.
   *
   * @param projectId - Identifier of the project whose specifications will be accessed.
   */
  setProjectId(projectId: string): void {
    this.projectId = projectId;
  }

  /**
   * Returns the identifier the client currently uses when addressing the API.
   *
   * @returns The active project identifier.
   */
  getProjectId(): string {
    return this.projectId;
  }

  /**
   * Attempts to discover a running Arbiter server by probing the known development ports.
   *
   * @returns Result describing whether a server was found and the discovered URL if applicable.
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
          method: "GET",
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
      error: `No Arbiter server found on common ports [${COMMON_PORTS.join(", ")}]. Please ensure the server is running.`,
    };
  }

  /**
   * Resolves the URL that should be used for the next request.
   *
   * @returns The discovered base URL if available, otherwise the configured base URL.
   */
  private getEffectiveBaseUrl(): string {
    return this.discoveredUrl || this.baseUrl;
  }

  /**
   * Ensures the client respects the one-request-per-second service constraint.
   *
   * @remarks
   * The implementation waits until the minimum interval between requests has elapsed before resolving.
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Validates that a JSON payload does not exceed the service's size limits.
   *
   * @param payload - Serialized payload that will be transmitted to the API.
   * @throws Error if the payload exceeds the 64KB cap mandated by the service.
   */
  private validatePayloadSize(payload: string): void {
    const size = new TextEncoder().encode(payload).length;
    if (size > this.MAX_PAYLOAD_SIZE) {
      throw new Error(
        `Payload size ${size} bytes exceeds maximum allowed ${this.MAX_PAYLOAD_SIZE} bytes (64KB)`,
      );
    }
  }

  /**
   * Validates CUE content against the Arbiter service schemas using the `/api/validate` endpoint.
   *
   * @param content - Raw CUE content to validate.
   * @param _options - Reserved for future options such as alternative schemas.
   * @returns A command result describing the validation outcome.
   */
  async validate(
    content: string,
    _options: {
      schema?: string;
      strict?: boolean;
    } = {},
  ): Promise<CommandResult<ValidationResponse>> {
    try {
      await this.enforceRateLimit();
      this.validatePayloadSize(content);

      const request: ValidationRequest = {
        text: content,
        files: [], // Empty files array for text-based validation
        projectId: this.projectId, // Use configured project ID
      };

      const requestPayload = JSON.stringify(request);
      this.validatePayloadSize(requestPayload);

      const response = await this.fetch("/api/validate", {
        method: "POST",
        body: requestPayload,
        headers: {
          "Content-Type": "application/json",
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
   * Requests a normalized intermediate representation from the `/api/ir` endpoint.
   *
   * @param content - Specification content from which to derive the IR.
   * @returns A command result containing the generated intermediate representation.
   */
  async getIR(content: string): Promise<CommandResult<IRResponse>> {
    try {
      await this.enforceRateLimit();
      this.validatePayloadSize(content);

      const requestPayload = JSON.stringify({ text: content });
      this.validatePayloadSize(requestPayload);

      const response = await this.fetch("/api/ir", {
        method: "POST",
        body: requestPayload,
        headers: {
          "Content-Type": "application/json",
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
   * Performs an arbitrary request while still enforcing the client's rate limit.
   *
   * @param path - Relative API path to call.
   * @param init - Additional fetch options.
   * @returns The raw `Response` object returned by `fetch`.
   */
  async request(path: string, init: RequestInit = {}): Promise<Response> {
    await this.enforceRateLimit();
    return this.fetch(path, init);
  }

  /**
   * Retrieves the list of specification fragments available for a project.
   *
   * @param projectId - Identifier of the project that owns the fragments.
   * @returns Command result containing the fragment metadata array.
   */
  async listFragments(projectId = "default"): Promise<CommandResult<any[]>> {
    try {
      await this.enforceRateLimit();

      const response = await this.fetch(
        `/api/fragments?projectId=${encodeURIComponent(projectId)}`,
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
   * Creates or updates a fragment in the Arbiter backend.
   *
   * @param projectId - Identifier of the project that owns the fragment.
   * @param path - Logical path that the fragment should be stored under.
   * @param content - Fragment content to persist.
   * @param options - Optional authoring metadata to persist with the fragment.
   * @returns Command result containing the stored fragment payload.
   */
  async updateFragment(
    projectId: string,
    path: string,
    content: string,
    options?: { author?: string; message?: string },
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

      const response = await this.fetch("/api/fragments", {
        method: "POST",
        body: requestPayload,
        headers: {
          "Content-Type": "application/json",
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
   * Persists a high-level specification in the backend, allowing the service to shard storage as needed.
   *
   * @param spec - Specification payload to store.
   * @returns Result describing whether the operation succeeded and identifying the shard when relevant.
   */
  async storeSpecification(spec: {
    content: string;
    type: string;
    path: string;
    shard?: string;
  }): Promise<CommandResult<{ success: boolean; id: string; shard?: string }>> {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substr(2, 9);

    this.logDebug(
      `[CLI-STORE] ${requestId} - Starting storeSpecification at ${new Date().toISOString()}`,
    );
    this.logDebug(`[CLI-STORE] ${requestId} - Spec details:`, {
      type: spec.type,
      path: spec.path,
      contentLength: spec.content?.length || 0,
    });

    await this.enforceRateLimit();

    try {
      this.logDebug(`[CLI-STORE] ${requestId} - Making POST request to /api/specifications`);

      const response = await this.fetch("/api/specifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...spec,
          sharded: true, // Indicate this should use sharded storage
        }),
      });

      const duration = Date.now() - startTime;
      this.logDebug(
        `[CLI-STORE] ${requestId} - Response received after ${duration}ms, status: ${response.status}`,
      );

      if (!response.ok) {
        const error = await response.text();
        this.logDebugError(
          `[CLI-STORE] ${requestId} - Failed with status ${response.status}, error: ${error}`,
        );
        return {
          success: false,
          data: null,
          error: `Failed to store specification: ${error}`,
          exitCode: 1,
        };
      }

      const data = await response.json();
      this.logDebug(`[CLI-STORE] ${requestId} - Success after ${duration}ms`);
      return { success: true, data, error: null, exitCode: 0 };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logDebugError(`[CLI-STORE] ${requestId} - Network error after ${duration}ms:`, error);

      return {
        success: false,
        data: null,
        error: `Network error storing specification: ${error}`,
        exitCode: 2,
      };
    }
  }

  /**
   * Fetches a stored specification from the backend.
   *
   * @param type - Specification type used during storage.
   * @param path - Logical path where the specification resides.
   * @returns Stored specification content if available.
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
            error: "Specification not found",
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
   * Checks the `/health` endpoint and, if necessary, attempts service discovery before retrying.
   *
   * @returns Command result describing the server health and timestamp.
   */
  async health(): Promise<CommandResult<{ status: string; timestamp: string }>> {
    try {
      await this.enforceRateLimit();

      // First try the configured URL
      let response = await this.fetch("/health");

      // If it fails, try auto-discovery
      if (!response.ok || response.status === 404) {
        console.warn(
          `Initial connection to ${this.baseUrl} failed. Attempting server discovery...`,
        );
        const discovery = await this.discoverServer();

        if (discovery.success && discovery.url) {
          console.log(`✓ Found server at ${discovery.url}`);
          // Retry with discovered URL
          response = await this.fetch("/health");
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
   * Invokes the `/export` endpoint so callers can materialize CUE content in auxiliary formats.
   *
   * @param content - Raw CUE content to export.
   * @param format - Output format identifier requested from the API.
   * @param options - Optional flags that fine-tune the export behaviour.
   * @returns Result containing the exported artifact metadata.
   */
  async export(
    content: string,
    format: string,
    options: {
      strict?: boolean;
      includeExamples?: boolean;
      outputMode?: "single" | "multiple";
    } = {},
  ): Promise<CommandResult<any>> {
    try {
      const response = await this.fetch("/export", {
        method: "POST",
        body: JSON.stringify({
          text: content,
          format,
          strict: options.strict || false,
          includeExamples: options.includeExamples || false,
          outputMode: options.outputMode || "single",
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
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
          error: data.error || "Export failed",
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
   * Retrieves the list of export formats supported by the server.
   *
   * @returns Command result containing the supported format descriptors.
   */
  async getSupportedFormats(): Promise<CommandResult<any>> {
    try {
      const response = await this.fetch("/export/formats");

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
   * Retrieves detected components from the backend, optionally filtered by type.
   *
   * @param type - Optional component classification to filter the results by.
   * @returns Command result containing zero or more component descriptions.
   */
  async listComponents(type?: string): Promise<CommandResult<any[]>> {
    try {
      await this.enforceRateLimit();

      const url = type ? `/api/components?type=${encodeURIComponent(type)}` : "/api/components";
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

  async listProjects(): Promise<CommandResult<any[]>> {
    try {
      await this.enforceRateLimit();
      const response = await this.fetch("/api/projects");

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to list projects: ${response.status} ${errorText}`,
          exitCode: 1,
        };
      }

      const data = await response.json();
      const projects = Array.isArray(data?.projects) ? data.projects : [];

      return {
        success: true,
        data: projects,
        exitCode: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: `Network error listing projects: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 2,
      };
    }
  }

  async createProject(payload: {
    id?: string;
    name: string;
    path?: string;
    presetId?: string;
  }): Promise<CommandResult<{ id: string; exists?: boolean }>> {
    try {
      await this.enforceRateLimit();
      const body = JSON.stringify(
        Object.fromEntries(
          Object.entries({
            id: payload.id,
            name: payload.name,
            path: payload.path,
            presetId: payload.presetId,
          }).filter(([, value]) => value !== undefined && value !== ""),
        ),
      );

      const response = await this.fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      if (response.status === 409) {
        const data = await response.json().catch(() => ({}));
        return {
          success: true,
          data: {
            id: (data?.projectId as string | undefined) || payload.id || "",
            exists: true,
          },
          exitCode: 0,
        };
      }

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to create project: ${response.status} ${errorText}`,
          exitCode: 1,
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: { id: data?.id ?? payload.id ?? "" },
        exitCode: 0,
      };
    } catch (error) {
      return {
        success: false,
        error: `Network error creating project: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 2,
      };
    }
  }

  async getProject(projectId: string): Promise<CommandResult<any>> {
    try {
      await this.enforceRateLimit();
      const response = await this.fetch(`/api/projects/${projectId}`);

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to fetch project: ${response.status} ${errorText}`,
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
        error: `Network error fetching project: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 2,
      };
    }
  }

  async createProjectEntity(
    projectId: string,
    payload: { type: string; values: Record<string, unknown> },
  ): Promise<CommandResult<any>> {
    try {
      await this.enforceRateLimit();
      const response = await this.fetch(`/api/projects/${projectId}/entities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to create project entity: ${response.status} ${errorText}`,
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
        error: `Network error creating project entity: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 2,
      };
    }
  }

  async updateProjectEntity(
    projectId: string,
    artifactId: string,
    payload: { type: string; values: Record<string, unknown> },
  ): Promise<CommandResult<any>> {
    try {
      await this.enforceRateLimit();
      const response = await this.fetch(`/api/projects/${projectId}/entities/${artifactId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `Failed to update project entity: ${response.status} ${errorText}`,
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
        error: `Network error updating project entity: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 2,
      };
    }
  }

  /**
   * Fetches aggregate project status details from the API.
   *
   * @returns Command result describing the overall project status.
   */
  async getProjectStatus(projectId?: string): Promise<CommandResult<any>> {
    try {
      await this.enforceRateLimit();

      const targetProject = projectId || this.projectId || "cli-project";
      let response = await this.fetch(`/api/projects/${encodeURIComponent(targetProject)}`);

      if (response.status === 404) {
        response = await this.fetch("/api/projects");
      }

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `API error: ${response.status} ${errorText}`,
          exitCode: 1,
        };
      }

      const data = await response.json();

      if (data && typeof data === "object" && "success" in data && data.success === false) {
        return {
          success: false,
          error:
            typeof data.message === "string"
              ? data.message
              : "Remote status endpoint returned an error",
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
        error: `Network error: ${error instanceof Error ? error.message : String(error)}`,
        exitCode: 2,
      };
    }
  }

  /**
   * Validates a specification against the platform's best-practice rules, when supported by the server.
   *
   * @param content - Specification content to validate.
   * @returns Command result containing the validation outcome.
   */
  async validateBestPractices?(content: string): Promise<CommandResult<any>> {
    try {
      await this.enforceRateLimit();
      this.validatePayloadSize(content);

      const requestPayload = JSON.stringify({ content });
      this.validatePayloadSize(requestPayload);

      const response = await this.fetch("/api/validate/best-practices", {
        method: "POST",
        body: requestPayload,
        headers: {
          "Content-Type": "application/json",
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
   * Validates a specification against custom rule sets.
   *
   * @param content - Specification content to validate.
   * @param rules - One or more rule identifiers provided to the backend.
   * @returns Command result that includes rule validation feedback.
   */
  async validateCustomRules?(content: string, rules: string[]): Promise<CommandResult<any>> {
    try {
      await this.enforceRateLimit();
      this.validatePayloadSize(content);

      const requestPayload = JSON.stringify({ content, rules });
      this.validatePayloadSize(requestPayload);

      const response = await this.fetch("/api/validate/custom-rules", {
        method: "POST",
        body: requestPayload,
        headers: {
          "Content-Type": "application/json",
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

      const response = await this.fetch("/api/validate/consistency", {
        method: "POST",
        body: requestPayload,
        headers: {
          "Content-Type": "application/json",
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

  private isTokenExpired(session: AuthSession): boolean {
    if (!session.expiresAt) {
      return false;
    }

    const expiresAt = Date.parse(session.expiresAt);
    if (Number.isNaN(expiresAt)) {
      return false;
    }

    // Add a small buffer to avoid using tokens that are about to expire
    return expiresAt <= Date.now() + 60_000;
  }

  private buildAuthorizationHeader(): string | null {
    if (!this.authSession || !this.authSession.accessToken) {
      return null;
    }

    if (this.isTokenExpired(this.authSession)) {
      if (!this.warnedAboutExpiredToken) {
        console.warn(
          "OAuth access token appears to be expired. Run `arbiter auth` to refresh credentials.",
        );
        this.warnedAboutExpiredToken = true;
      }
      return null;
    }

    const tokenTypeRaw = this.authSession.tokenType?.trim();
    const tokenType = tokenTypeRaw && tokenTypeRaw.length > 0 ? tokenTypeRaw : "Bearer";

    return `${tokenType} ${this.authSession.accessToken}`;
  }

  /**
   * Internal fetch wrapper with timeout and error handling
   */
  private async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const baseUrl = this.getEffectiveBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    const fetchStartTime = Date.now();
    const fetchId = Math.random().toString(36).substr(2, 9);

    this.logDebug(
      `[CLI-FETCH] ${fetchId} - Starting request to ${url} at ${new Date().toISOString()}`,
    );
    this.logDebug(`[CLI-FETCH] ${fetchId} - Timeout configured: ${this.timeout}ms`);
    this.logDebug(`[CLI-FETCH] ${fetchId} - Method: ${options.method || "GET"}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      this.logDebug(`[CLI-FETCH] ${fetchId} - TIMEOUT! Aborting after ${this.timeout}ms`);
      controller.abort();
    }, this.timeout);

    try {
      this.logDebug(`[CLI-FETCH] ${fetchId} - Calling fetch() now...`);

      const headers = new Headers(options.headers as HeadersInit | undefined);
      const authHeader = this.buildAuthorizationHeader();
      if (authHeader) {
        headers.set("Authorization", authHeader);
      }

      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      const duration = Date.now() - fetchStartTime;
      clearTimeout(timeoutId);

      this.logDebug(`[CLI-FETCH] ${fetchId} - Response received after ${duration}ms`);
      this.logDebug(`[CLI-FETCH] ${fetchId} - Status: ${response.status} ${response.statusText}`);

      return response;
    } catch (error) {
      const duration = Date.now() - fetchStartTime;
      clearTimeout(timeoutId);

      this.logDebugError(`[CLI-FETCH] ${fetchId} - Error after ${duration}ms:`, error);

      if (error instanceof Error && error.name === "AbortError") {
        const errorMsg = `Request timeout after ${this.timeout}ms connecting to ${baseUrl}`;
        this.logDebugError(`[CLI-FETCH] ${fetchId} - TIMEOUT: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      // Enhance error message with connection details
      if (
        error instanceof Error &&
        (error.message.includes("ECONNREFUSED") || error.message.includes("fetch failed"))
      ) {
        const errorMsg = `Connection failed to ${baseUrl}. Is the Arbiter server running?`;
        this.logDebugError(`[CLI-FETCH] ${fetchId} - CONNECTION FAILED: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      this.logDebugError(`[CLI-FETCH] ${fetchId} - OTHER ERROR:`, error);
      throw error;
    }
  }

  private logDebug(...entries: unknown[]): void {
    if (this.debugFetchLogs) {
      console.log(...entries);
    }
  }

  private logDebugError(message: string, error?: unknown): void {
    if (!this.debugFetchLogs) {
      return;
    }
    if (error === undefined) {
      console.error(message);
    } else {
      console.error(message, error);
    }
  }

  // Webhook automation methods
  async setupGitHubWebhook(params: {
    repoOwner: string;
    repoName: string;
    events?: string[];
    tunnelUrl?: string;
  }): Promise<{
    success: boolean;
    webhook?: {
      id: number;
      url: string;
      events: string[];
      active: boolean;
      created_at: string;
      updated_at: string;
    };
    message?: string;
    error?: string;
  }> {
    await this.enforceRateLimit();
    const response = await this.fetch("/api/webhooks/github/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    return await response.json();
  }

  async listGitHubWebhooks(
    owner: string,
    repo: string,
  ): Promise<{
    success: boolean;
    webhooks?: Array<{
      id: number;
      name: string;
      url: string;
      events: string[];
      active: boolean;
      created_at: string;
      updated_at: string;
    }>;
    error?: string;
  }> {
    await this.enforceRateLimit();
    const safeOwner = encodeURIComponent(owner.trim());
    const safeRepo = encodeURIComponent(repo.trim());
    const response = await this.fetch(`/api/webhooks/github/list/${safeOwner}/${safeRepo}`);
    return await response.json();
  }

  async deleteGitHubWebhook(
    owner: string,
    repo: string,
    hookId: number,
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    await this.enforceRateLimit();
    const safeOwner = encodeURIComponent(owner.trim());
    const safeRepo = encodeURIComponent(repo.trim());
    const response = await this.fetch(`/api/webhooks/github/${safeOwner}/${safeRepo}/${hookId}`, {
      method: "DELETE",
    });
    return await response.json();
  }
}
