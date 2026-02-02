import { COMMON_PORTS } from "@/io/config/config.js";
import type { AuthSession, CLIConfig, CommandResult } from "@/types.js";
import type { ValidationRequest, ValidationResponse } from "@arbiter/specification";

export type ProjectStructureApiResponse = {
  success: boolean;
  projectStructure?: Record<string, unknown>;
  error?: string;
};

/**
 * Transport-focused HTTP client for Arbiter API.
 * Handles auth, rate limiting, payload limits, and basic discovery.
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
  private readonly MAX_PAYLOAD_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly MIN_REQUEST_INTERVAL = 0; // client-side rate limit disabled
  private readonly MAX_TIMEOUT = 10_000; // 10s ceiling
  private unauthorizedHandler?: () => void;

  constructor(config: CLIConfig) {
    this.baseUrl = config.apiUrl.replace(/\/$/, "");
    this.timeout = Math.min(config.timeout, this.MAX_TIMEOUT);
    this.projectId = config.projectId || "cli-project";
    this.authSession = config.authSession;
    const fetchDebugFlag = process.env.ARBITER_FETCH_DEBUG?.toLowerCase?.() ?? "";
    const debugNamespace = process.env.DEBUG ?? "";
    this.debugFetchLogs =
      config.verbose === true ||
      fetchDebugFlag === "1" ||
      fetchDebugFlag === "true" ||
      /arbiter:fetch/.test(debugNamespace);
  }

  setProjectId(projectId: string): void {
    this.projectId = projectId;
  }

  getProjectId(): string {
    return this.projectId;
  }

  async discoverServer(): Promise<{ success: boolean; url?: string; error?: string }> {
    const hostname = new URL(this.baseUrl).hostname;
    const protocol = new URL(this.baseUrl).protocol;

    for (const port of COMMON_PORTS) {
      const testUrl = `${protocol}//${hostname}:${port}`;
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const response = await fetch(`${testUrl}/health`, { signal: controller.signal });
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

  private getEffectiveBaseUrl(): string {
    return this.discoveredUrl || this.baseUrl;
  }

  private async enforceRateLimit(): Promise<void> {
    if (this.MIN_REQUEST_INTERVAL <= 0) {
      this.lastRequestTime = Date.now();
      return;
    }
    const now = Date.now();
    const delta = now - this.lastRequestTime;
    if (delta < this.MIN_REQUEST_INTERVAL) {
      await new Promise((r) => setTimeout(r, this.MIN_REQUEST_INTERVAL - delta));
    }
    this.lastRequestTime = Date.now();
  }

  validatePayloadSize(payload: string): void {
    const size = new TextEncoder().encode(payload).length;
    if (size > this.MAX_PAYLOAD_SIZE) {
      throw new Error(
        `Payload size ${size} bytes exceeds maximum allowed ${this.MAX_PAYLOAD_SIZE} bytes (5MB)`,
      );
    }
  }

  // Generic JSON helpers
  async get(path: string): Promise<CommandResult<any>> {
    return this.json("GET", path);
  }

  async post(path: string, body?: unknown): Promise<CommandResult<any>> {
    return this.json("POST", path, body);
  }

  async put(path: string, body?: unknown): Promise<CommandResult<any>> {
    return this.json("PUT", path, body);
  }

  async delete(path: string, body?: unknown): Promise<CommandResult<any>> {
    return this.json("DELETE", path, body);
  }

  async request(endpoint: string, init: RequestInit = {}): Promise<Response> {
    await this.enforceRateLimit();
    const response = await this.fetch(endpoint, init);
    if (response.status === 401 && this.unauthorizedHandler) {
      this.unauthorizedHandler();
    }
    return response;
  }

  setUnauthorizedHandler(handler: () => void): void {
    this.unauthorizedHandler = handler;
  }

  async getProject(projectId: string): Promise<CommandResult<any>> {
    return this.get(`/api/projects/${projectId}`);
  }

  async getProjectStatus(projectId: string): Promise<CommandResult<any>> {
    return this.get(`/api/projects/${projectId}/status`);
  }

  async listProjects(): Promise<CommandResult<any[]>> {
    return this.get("/api/projects");
  }

  async createProject(payload: Record<string, unknown>): Promise<CommandResult<any>> {
    return this.post("/api/projects", payload);
  }

  async updateFragment(
    projectId: string,
    remotePath: string,
    content: string,
    options?: { author?: string; message?: string },
  ): Promise<CommandResult<any>> {
    return this.post(`/api/projects/${projectId}/fragments`, {
      path: remotePath,
      content,
      ...options,
    });
  }

  /**
   * Prepare JSON payload from body
   */
  private prepareJsonPayload(body: unknown): string | undefined {
    if (body === undefined) return undefined;
    const payload = JSON.stringify(body);
    this.validatePayloadSize(payload);
    return payload;
  }

  /**
   * Build request headers for JSON request
   */
  private buildJsonHeaders(payload: string | undefined): Record<string, string> {
    return payload ? { "Content-Type": "application/json" } : {};
  }

  /**
   * Handle non-OK HTTP response
   */
  private async handleHttpError(response: Response): Promise<CommandResult<any>> {
    const errorText =
      typeof response.text === "function" ? await response.text().catch(() => "") : "";
    return { success: false, error: `API error: ${response.status} ${errorText}`, exitCode: 1 };
  }

  /**
   * Handle successful HTTP response
   */
  private async handleHttpSuccess(response: Response): Promise<CommandResult<any>> {
    const data = await response.json().catch(() => ({}));
    return { success: true, data, exitCode: 0 };
  }

  /**
   * Handle network errors
   */
  private handleNetworkError(error: unknown): CommandResult<any> {
    return {
      success: false,
      error: `Network error: ${error instanceof Error ? error.message : String(error)}`,
      exitCode: 2,
    };
  }

  private async json(method: string, path: string, body?: unknown): Promise<CommandResult<any>> {
    try {
      await this.enforceRateLimit();
      const payload = this.prepareJsonPayload(body);
      const response = await this.fetch(path, {
        method,
        body: payload,
        headers: this.buildJsonHeaders(payload),
      });

      if (!response.ok) {
        return this.handleHttpError(response);
      }
      return this.handleHttpSuccess(response);
    } catch (error) {
      return this.handleNetworkError(error);
    }
  }

  async validate(
    content: string,
    _options: { schema?: string; strict?: boolean } = {},
  ): Promise<CommandResult<ValidationResponse>> {
    const request: ValidationRequest = { text: content, files: [], projectId: this.projectId };
    return this.post("/api/validate", request) as Promise<CommandResult<ValidationResponse>>;
  }

  /**
   * Attempt to recover from a failed health check via server discovery
   */
  private async tryHealthRecovery(): Promise<CommandResult<Response> | null> {
    console.warn("Health check failed, attempting server discovery...");
    const discovery = await this.discoverServer();
    if (!discovery.success) {
      return { success: false, error: discovery.error, exitCode: 2 };
    }
    const response = await this.fetch("/health");
    return { success: true, data: response, exitCode: 0 };
  }

  /**
   * Parse health response or return error
   */
  private async parseHealthResponse(
    response: Response,
  ): Promise<CommandResult<{ status: string; timestamp: string }>> {
    if (!response.ok) {
      return { success: false, error: `Server unhealthy: ${response.status}`, exitCode: 1 };
    }
    const data = await response.json();
    return { success: true, data, exitCode: 0 };
  }

  /**
   * Handle health check network error with recovery attempt
   */
  private async handleHealthNetworkError(
    error: unknown,
  ): Promise<CommandResult<{ status: string; timestamp: string }>> {
    const discovery = await this.discoverServer();
    if (discovery.success) {
      return this.health();
    }
    return {
      success: false,
      error:
        discovery.error ||
        `Cannot reach server: ${error instanceof Error ? error.message : String(error)}`,
      exitCode: 2,
    };
  }

  async health(): Promise<CommandResult<{ status: string; timestamp: string }>> {
    try {
      await this.enforceRateLimit();
      let response = await this.fetch("/health");

      if (!response.ok || response.status === 404) {
        const recoveryResult = await this.tryHealthRecovery();
        if (!recoveryResult) {
          return { success: false, error: "Health recovery returned null", exitCode: 2 };
        }
        if (!recoveryResult.success) {
          return { success: false, error: recoveryResult.error, exitCode: recoveryResult.exitCode };
        }
        response = recoveryResult.data as Response;
      }

      return this.parseHealthResponse(response);
    } catch (error) {
      return this.handleHealthNetworkError(error);
    }
  }

  async export(
    content: string,
    format: string,
    options: {
      strict?: boolean;
      includeExamples?: boolean;
      outputMode?: "single" | "multiple";
    } = {},
  ): Promise<CommandResult<any>> {
    return this.post("/export", {
      text: content,
      format,
      strict: options.strict ?? false,
      includeExamples: options.includeExamples ?? false,
      outputMode: options.outputMode ?? "single",
    });
  }

  async getSupportedFormats(): Promise<CommandResult<any>> {
    const result = await this.get("/export/formats");
    if (result.success) {
      const data = result.data as any;
      const formats = Array.isArray(data?.formats) ? data.formats : Array.isArray(data) ? data : [];
      return { success: true, data: formats, exitCode: 0 };
    }
    return result;
  }

  async listComponents(type?: string): Promise<CommandResult<any[]>> {
    const url = type ? `/api/components?type=${encodeURIComponent(type)}` : "/api/components";
    return this.get(url);
  }

  async createProjectEntity(
    projectId: string,
    payload: { type: string; values: Record<string, unknown> },
  ): Promise<CommandResult<any>> {
    return this.post(`/api/projects/${projectId}/entities`, payload);
  }

  async updateProjectEntity(
    projectId: string,
    artifactId: string,
    payload: { type: string; values: Record<string, unknown> },
  ): Promise<CommandResult<any>> {
    return this.put(`/api/projects/${projectId}/entities/${artifactId}`, payload);
  }

  async deleteProjectEntity(projectId: string, artifactId: string): Promise<CommandResult<any>> {
    return this.delete(`/api/projects/${projectId}/entities/${artifactId}`);
  }

  // Low-level fetch with auth/timeout/debug
  private async fetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const baseUrl = this.getEffectiveBaseUrl();
    const url = `${baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const headers = new Headers(options.headers as HeadersInit | undefined);
      const authHeader = this.buildAuthorizationHeader();
      if (authHeader) headers.set("Authorization", authHeader);

      const response = await fetch(url, { ...options, headers, signal: controller.signal });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  private buildAuthorizationHeader(): string | null {
    if (!this.authSession?.accessToken) return null;
    if (this.isTokenExpired(this.authSession)) {
      if (!this.warnedAboutExpiredToken) {
        console.warn("OAuth access token appears to be expired. Run `arbiter auth` to refresh.");
        this.warnedAboutExpiredToken = true;
      }
      return null;
    }
    const tokenType = this.authSession.tokenType?.trim() || "Bearer";
    return `${tokenType} ${this.authSession.accessToken}`;
  }

  private isTokenExpired(session: AuthSession): boolean {
    if (!session.expiresAt) return false;
    const expiresAt = Date.parse(session.expiresAt);
    if (Number.isNaN(expiresAt)) return false;
    return expiresAt <= Date.now() + 60_000;
  }
}
