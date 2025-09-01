/**
 * API service for backend communication
 */

import type {
  Project,
  Fragment,
  CreateFragmentRequest,
  CreateFragmentResponse,
  ResolvedSpecResponse,
  ValidationRequest,
  ValidationResponse,
  GapSet,
  IRResponse,
  IRKind,
  FreezeRequest,
  FreezeResponse,
  ProblemDetails
} from '../types/api';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: ProblemDetails
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

class ApiService {
  private baseUrl = 'http://localhost:4000';
  private defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  private buildRequestConfig(endpoint: string, options: RequestInit = {}): { url: string; config: RequestInit } {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        ...this.defaultHeaders,
        ...options.headers,
      },
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

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
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
    return this.request<Project[]>('/api/projects');
  }

  async getProject(projectId: string): Promise<Project> {
    return this.request<Project>(`/api/projects/${projectId}`);
  }

  async createProject(name: string): Promise<Project> {
    return this.request<Project>('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name }),
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

  async updateFragment(
    projectId: string,
    fragmentId: string,
    content: string
  ): Promise<Fragment> {
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
    return this.request<ResolvedSpecResponse>(`/api/resolved?projectId=${projectId}`);
  }

  // Gap analysis endpoints
  async getGaps(projectId: string): Promise<GapSet> {
    return this.request<GapSet>(`/api/gaps?projectId=${projectId}`);
  }

  // IR (Intermediate Representation) endpoints
  async getIR(projectId: string, kind: IRKind): Promise<IRResponse> {
    return this.request<IRResponse>(`/api/ir/${kind}?projectId=${projectId}`);
  }

  async getAllIRs(projectId: string): Promise<Record<IRKind, IRResponse>> {
    const kinds: IRKind[] = ['flow', 'fsm', 'view', 'site'];
    const results = await Promise.all(
      kinds.map(async kind => {
        try {
          const ir = await this.getIR(projectId, kind);
          return [kind, ir] as const;
        } catch (error) {
          console.warn(`Failed to load IR for ${kind}:`, error);
          return null;
        }
      })
    );

    const irs: Record<string, IRResponse> = {};
    for (const result of results) {
      if (result) {
        const [kind, ir] = result;
        irs[kind] = ir;
      }
    }
    
    return irs as Record<IRKind, IRResponse>;
  }

  // Version freezing endpoints
  async freezeVersion(
    projectId: string,
    request: FreezeRequest
  ): Promise<FreezeResponse> {
    return this.request<FreezeResponse>(`/api/freeze`, {
      method: 'POST',
      body: JSON.stringify({ projectId, ...request }),
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request<{ status: string; timestamp: string }>('/health');
  }

  // Set authentication token
  setAuthToken(token: string) {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  // Remove authentication token
  clearAuthToken() {
    delete this.defaultHeaders['Authorization'];
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Export utilities
export { ApiService };