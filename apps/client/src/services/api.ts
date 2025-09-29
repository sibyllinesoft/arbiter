/**
 * API service for backend communication
 */

import type { UIOptionCatalog } from '@arbiter/shared';

import type {
  CreateFragmentRequest,
  CreateFragmentResponse,
  CreateHandlerRequest,
  Event,
  Fragment,
  FreezeRequest,
  FreezeResponse,
  GapSet,
  HandlerExecution,
  HandlerStats,
  IRKind,
  IRResponse,
  ProblemDetails,
  Project,
  ResolvedSpecResponse,
  UpdateHandlerRequest,
  ValidationRequest,
  ValidationResponse,
  WebhookHandler,
} from '../types/api';
import { createLogger } from '../utils/logger';

const log = createLogger('API');

export class ApiError extends Error {
  status: number;
  details?: ProblemDetails | undefined;

  constructor(message: string, status: number, details?: ProblemDetails | undefined) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

export interface EnvironmentInfo {
  runtime: 'cloudflare' | 'node';
  cloudflareTunnelSupported: boolean;
}

export interface ProjectStructureSettings {
  appsDirectory: string;
  packagesDirectory: string;
  servicesDirectory: string;
  testsDirectory: string;
  infraDirectory: string;
  endpointDirectory: string;
}

interface UiOptionsResponse {
  success: boolean;
  options?: UIOptionCatalog;
  diagnostics?: string[];
}

interface ProjectStructureResponse {
  success: boolean;
  projectStructure: ProjectStructureSettings;
}

interface ProjectEventsResponse {
  success: boolean;
  events: Event[];
  head_event: Event | null;
  head_event_id: string | null;
  dangling_event_ids: string[];
}

interface SetEventHeadResponse {
  success: boolean;
  head_event: Event | null;
  head_event_id: string | null;
  reactivated_event_ids: string[];
  deactivated_event_ids: string[];
}

interface RevertEventsResponse {
  success: boolean;
  head_event: Event | null;
  head_event_id: string | null;
  reverted_event_ids: string[];
}

type TunnelSetupResponse = {
  success: boolean;
  tunnel?: {
    tunnelId: string;
    tunnelName: string;
    hostname: string;
    url: string;
    configPath: string;
    status: 'running' | 'stopped';
    hookId?: string;
  };
  logs?: string[];
  error?: string;
};

export class ApiService {
  private baseUrl = import.meta.env.VITE_API_URL || '';
  private defaultHeaders: Record<string, string | undefined> = {
    'Content-Type': 'application/json',
  };

  constructor() {
    // Constructor
  }

  private buildRequestConfig(
    endpoint: string,
    options: RequestInit = {}
  ): { url: string; config: RequestInit } {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        ...Object.fromEntries(
          Object.entries({ ...this.defaultHeaders, ...options.headers }).filter(
            ([, v]) => v !== undefined
          )
        ),
      } as HeadersInit,
    };
    return { url, config };
  }

  private async parseErrorDetails(response: Response): Promise<ProblemDetails | undefined> {
    try {
      return await response.json();
    } catch {
      // Ignore JSON parsing errors for error details
      return undefined;
    }
  }

  private createApiError(response: Response, errorDetails?: ProblemDetails): ApiError {
    return new ApiError(
      errorDetails?.detail || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorDetails
    );
  }

  private shouldReturnEmptyResponse(response: Response): boolean {
    return response.status === 204 || response.headers.get('content-length') === '0';
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const errorDetails = await this.parseErrorDetails(response);
    throw this.createApiError(response, errorDetails);
  }

  private async parseResponseData<T>(response: Response): Promise<T> {
    if (this.shouldReturnEmptyResponse(response)) {
      return {} as T;
    }
    return await response.json();
  }

  private handleNetworkError(error: unknown): never {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      0
    );
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const { url, config } = this.buildRequestConfig(endpoint, options);

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        return await this.handleErrorResponse(response);
      }

      return await this.parseResponseData<T>(response);
    } catch (error) {
      return this.handleNetworkError(error);
    }
  }

  // Project endpoints
  async getProjects(): Promise<Project[]> {
    const response = await this.request<{ projects: Project[] }>('/api/projects');
    return response.projects;
  }

  async getProject(projectId: string): Promise<Project> {
    return this.request<Project>(`/api/projects/${projectId}`);
  }

  async getProjectEvents(
    projectId: string,
    options: { limit?: number; includeDangling?: boolean; since?: string } = {}
  ): Promise<ProjectEventsResponse> {
    const params = new URLSearchParams();

    if (options.limit) {
      params.set('limit', String(options.limit));
    }

    if (options.since) {
      params.set('since', options.since);
    }

    if (options.includeDangling === false) {
      params.set('includeDangling', 'false');
    }

    const queryString = params.toString() ? `?${params.toString()}` : '';

    return this.request<ProjectEventsResponse>(`/api/projects/${projectId}/events${queryString}`);
  }

  async setProjectEventHead(
    projectId: string,
    headEventId: string | null
  ): Promise<SetEventHeadResponse> {
    return this.request<SetEventHeadResponse>(`/api/projects/${projectId}/events/head`, {
      method: 'POST',
      body: JSON.stringify({ head_event_id: headEventId }),
    });
  }

  async revertProjectEvents(projectId: string, eventIds: string[]): Promise<RevertEventsResponse> {
    return this.request<RevertEventsResponse>(`/api/projects/${projectId}/events/revert`, {
      method: 'POST',
      body: JSON.stringify({ event_ids: eventIds }),
    });
  }

  async getEnvironmentInfo(): Promise<EnvironmentInfo> {
    return this.request<EnvironmentInfo>('/api/environment');
  }

  async getProjectStructureSettings(): Promise<ProjectStructureResponse> {
    return this.request<ProjectStructureResponse>('/api/config/project-structure');
  }

  async getUiOptionCatalog(): Promise<UIOptionCatalog> {
    const response = await this.request<UiOptionsResponse>('/api/config/ui-options');
    return (response.options ?? {}) as UIOptionCatalog;
  }

  async createProjectEntity(
    projectId: string,
    payload: { type: string; values: Record<string, string> }
  ) {
    return this.request(`/api/projects/${projectId}/entities`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateProjectStructureSettings(
    settings: Partial<ProjectStructureSettings>
  ): Promise<ProjectStructureResponse> {
    return this.request<ProjectStructureResponse>('/api/config/project-structure', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async createProject(name: string, path?: string, presetId?: string): Promise<Project> {
    return this.request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(
        Object.fromEntries(
          Object.entries({ name, path, presetId }).filter(([, value]) => value !== undefined)
        )
      ),
    });
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.request<void>(`/api/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  // Fragment endpoints
  async getFragments(projectId: string): Promise<Fragment[]> {
    return this.request<Fragment[]>(`/api/fragments?projectId=${projectId}`);
  }

  async getFragment(projectId: string, fragmentId: string): Promise<Fragment> {
    return this.request<Fragment>(`/api/fragments/${fragmentId}?projectId=${projectId}`);
  }

  async createFragment(
    projectId: string,
    request: CreateFragmentRequest
  ): Promise<CreateFragmentResponse> {
    return this.request<CreateFragmentResponse>(`/api/fragments?projectId=${projectId}`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async updateFragment(projectId: string, fragmentId: string, content: string): Promise<Fragment> {
    return this.request<Fragment>(`/api/fragments/${fragmentId}?projectId=${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  }

  async deleteFragment(projectId: string, fragmentId: string): Promise<void> {
    await this.request<void>(`/api/fragments/${fragmentId}?projectId=${projectId}`, {
      method: 'DELETE',
    });
  }

  // Validation endpoints
  async validateProject(
    projectId: string,
    request: ValidationRequest = {}
  ): Promise<ValidationResponse> {
    return this.request<ValidationResponse>('/api/validate', {
      method: 'POST',
      body: JSON.stringify({ projectId, ...request }),
    });
  }

  // Resolved spec endpoints
  async getResolvedSpec(projectId: string): Promise<ResolvedSpecResponse> {
    const response = await this.request<{
      success: boolean;
      projectId: string;
      resolved: Record<string, unknown>;
    }>(`/api/resolved?projectId=${projectId}`);

    // Transform response to match expected interface
    return {
      spec_hash: 'generated', // The API doesn't return this field
      resolved: response.resolved,
      last_updated: new Date().toISOString(),
    };
  }

  // Gap analysis endpoints
  async getGaps(projectId: string): Promise<GapSet> {
    return this.request<GapSet>(`/api/gaps?projectId=${projectId}`);
  }

  // IR (Intermediate Representation) endpoints
  async getIR(projectId: string, kind: IRKind): Promise<IRResponse> {
    if (!kind) {
      throw new Error('IRKind is required');
    }
    return this.request<IRResponse>(`/api/ir/${kind}?projectId=${projectId}`);
  }

  async getAllIRs(projectId: string): Promise<Record<IRKind, IRResponse>> {
    const kinds: IRKind[] = ['flow', 'fsm', 'view', 'site'];
    const irs: Record<IRKind, IRResponse> = {} as Record<IRKind, IRResponse>;

    // Sequential requests with small delays to avoid rate limiting
    for (const kind of kinds) {
      try {
        const ir = await this.getIR(projectId, kind);
        irs[kind] = ir;
      } catch (error) {
        log.warn(`Failed to load IR for ${kind}:`, error);
      }

      // Add small delay between requests to avoid overwhelming rate limiter
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    return irs;
  }

  // Version freezing endpoints
  async freezeVersion(projectId: string, request: FreezeRequest): Promise<FreezeResponse> {
    return this.request<FreezeResponse>('/api/freeze', {
      method: 'POST',
      body: JSON.stringify({ projectId, ...request }),
    });
  }

  // Webhook Handler endpoints
  async getHandlers(): Promise<WebhookHandler[]> {
    const response = await this.request<{
      success: boolean;
      handlers: WebhookHandler[];
      total: number;
    }>('/api/handlers');
    if (!response.success || !Array.isArray(response.handlers)) {
      return [];
    }
    return response.handlers;
  }

  async getHandler(handlerId: string): Promise<WebhookHandler> {
    return this.request<WebhookHandler>(`/api/handlers/${handlerId}`);
  }

  async createHandler(request: CreateHandlerRequest): Promise<WebhookHandler> {
    return this.request<WebhookHandler>('/api/handlers', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async updateHandler(handlerId: string, request: UpdateHandlerRequest): Promise<WebhookHandler> {
    return this.request<WebhookHandler>(`/api/handlers/${handlerId}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  }

  async deleteHandler(handlerId: string): Promise<void> {
    await this.request<void>(`/api/handlers/${handlerId}`, {
      method: 'DELETE',
    });
  }

  async toggleHandler(handlerId: string, enabled: boolean): Promise<WebhookHandler> {
    return this.request<WebhookHandler>(`/api/handlers/${handlerId}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  }

  async getHandlerStats(handlerId: string): Promise<HandlerStats> {
    return this.request<HandlerStats>(`/api/handlers/${handlerId}/stats`);
  }

  async getHandlerExecutions(handlerId: string, limit?: number): Promise<HandlerExecution[]> {
    const params = limit ? `?limit=${limit}` : '';
    return this.request<HandlerExecution[]>(`/api/handlers/${handlerId}/executions${params}`);
  }

  async testHandler(
    handlerId: string,
    payload: Record<string, unknown>
  ): Promise<{
    status: 'success' | 'error';
    result?: Record<string, unknown>;
    error?: string;
    duration_ms: number;
  }> {
    return this.request(`/api/handlers/${handlerId}/test`, {
      method: 'POST',
      body: JSON.stringify({ payload }),
    });
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
    return this.request('/api/webhooks/github/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  }

  async listGitHubWebhooks(
    owner: string,
    repo: string
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
    return this.request(`/api/webhooks/github/list/${owner}/${repo}`);
  }

  async deleteGitHubWebhook(
    owner: string,
    repo: string,
    hookId: number
  ): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    return this.request(`/api/webhooks/github/${owner}/${repo}/${hookId}`, {
      method: 'DELETE',
    });
  }

  // Cloudflare tunnel management methods (v2 API)
  async getTunnelStatus(): Promise<{
    success: boolean;
    tunnel?: {
      tunnelId: string;
      tunnelName: string;
      hostname: string;
      url: string;
      configPath: string;
      status: 'running' | 'stopped';
      hookId?: string;
    } | null;
    error?: string;
  }> {
    return this.request('/api/tunnel/status');
  }

  async setupTunnel(config: {
    zone: string;
    subdomain?: string;
    localPort?: number;
    githubToken?: string;
    repository?: string;
    webhookSecret?: string;
  }): Promise<TunnelSetupResponse> {
    return this.request('/api/tunnel/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  }

  // Legacy startTunnel for backwards compatibility
  async startTunnel(): Promise<TunnelSetupResponse> {
    return this.setupTunnel({
      zone: 'sibylline.dev',
      localPort: 5050,
    });
  }

  async stopTunnel(): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    return this.request('/api/tunnel/stop', {
      method: 'POST',
    });
  }

  async teardownTunnel(): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    return this.request('/api/tunnel/teardown', {
      method: 'POST',
    });
  }

  async getTunnelPreflight(): Promise<{
    success: boolean;
    zones?: string[];
    error?: string;
  }> {
    return this.request('/api/tunnel/preflight');
  }

  async getTunnelLogs(): Promise<{
    success: boolean;
    logs?: string;
    error?: string;
  }> {
    return this.request('/api/tunnel/logs');
  }

  // Import scanning methods
  async scanGitUrl(gitUrl: string): Promise<{
    success: boolean;
    tempPath?: string;
    files?: string[];
    projectStructure?: {
      hasPackageJson: boolean;
      hasCargoToml: boolean;
      hasDockerfile: boolean;
      hasCueFiles: boolean;
      hasYamlFiles: boolean;
      hasJsonFiles: boolean;
      importableFiles: string[];
    };
    gitUrl?: string;
    projectName?: string;
    error?: string;
  }> {
    return this.request('/api/import/scan-git', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gitUrl }),
    });
  }

  async scanLocalPath(directoryPath: string): Promise<{
    success: boolean;
    path?: string;
    files?: string[];
    projectStructure?: {
      hasPackageJson: boolean;
      hasCargoToml: boolean;
      hasDockerfile: boolean;
      hasCueFiles: boolean;
      hasYamlFiles: boolean;
      hasJsonFiles: boolean;
      importableFiles: string[];
    };
    error?: string;
  }> {
    return this.request('/api/import/scan-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directoryPath }),
    });
  }

  async cleanupImport(tempId: string): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> {
    return this.request(`/api/import/cleanup/${tempId}`, {
      method: 'DELETE',
    });
  }

  // GitHub API methods
  async getGitHubUserRepos(): Promise<{
    success: boolean;
    repositories?: Array<{
      id: number;
      name: string;
      full_name: string;
      description: string | null;
      private: boolean;
      clone_url: string;
      ssh_url: string;
      html_url: string;
      language: string | null;
      stargazers_count: number;
      forks_count: number;
      updated_at: string;
      owner: {
        login: string;
        type: 'User' | 'Organization';
        avatar_url: string;
      };
    }>;
    error?: string;
  }> {
    return this.request('/api/github/user/repos');
  }

  async getGitHubUserOrgs(): Promise<{
    success: boolean;
    organizations?: Array<{
      login: string;
      id: number;
      description: string | null;
      avatar_url: string;
      public_repos: number;
    }>;
    error?: string;
  }> {
    return this.request('/api/github/user/orgs');
  }

  async getGitHubOrgRepos(org: string): Promise<{
    success: boolean;
    repositories?: Array<{
      id: number;
      name: string;
      full_name: string;
      description: string | null;
      private: boolean;
      clone_url: string;
      ssh_url: string;
      html_url: string;
      language: string | null;
      stargazers_count: number;
      forks_count: number;
      updated_at: string;
      owner: {
        login: string;
        type: 'User' | 'Organization';
        avatar_url: string;
      };
    }>;
    error?: string;
  }> {
    return this.request(`/api/github/orgs/${org}/repos`);
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/health');
  }

  // Set authentication token
  setAuthToken(token: string) {
    this.defaultHeaders.Authorization = `Bearer ${token}`;
  }

  // Remove authentication token
  clearAuthToken() {
    delete this.defaultHeaders.Authorization;
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Export utilities
