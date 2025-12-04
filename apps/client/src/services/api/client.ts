import type { ProblemDetails } from "@/types/api";

export interface ApiServiceOptions {
  baseUrl?: string;
}

export type UnauthorizedHandler = () => Promise<void> | void;

export class ApiError extends Error {
  status: number;
  details?: ProblemDetails | undefined;

  constructor(message: string, status: number, details?: ProblemDetails | undefined) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string | undefined> = {
    "Content-Type": "application/json",
  };
  private unauthorizedHandler?: UnauthorizedHandler;

  constructor(options: ApiServiceOptions = {}) {
    const envBaseUrl =
      typeof import.meta !== "undefined" &&
      import.meta.env &&
      typeof import.meta.env.VITE_API_URL === "string" &&
      import.meta.env.VITE_API_URL.length > 0
        ? import.meta.env.VITE_API_URL
        : "";

    this.baseUrl = options.baseUrl ?? envBaseUrl;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setUnauthorizedHandler(handler: UnauthorizedHandler) {
    this.unauthorizedHandler = handler;
  }

  setAuthToken(token: string) {
    this.defaultHeaders.Authorization = `Bearer ${token}`;
  }

  clearAuthToken() {
    delete this.defaultHeaders.Authorization;
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const { url, config } = this.buildRequestConfig(endpoint, options);

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        if ((response.status === 401 || response.status === 403) && this.unauthorizedHandler) {
          await this.unauthorizedHandler();
        }
        return await this.handleErrorResponse(response);
      }

      return await this.parseResponseData<T>(response);
    } catch (error) {
      return this.handleNetworkError(error);
    }
  }

  private buildRequestConfig(
    endpoint: string,
    options: RequestInit = {},
  ): { url: string; config: RequestInit } {
    const url = `${this.baseUrl}${endpoint}`;
    const config: RequestInit = {
      ...options,
      headers: {
        ...Object.fromEntries(
          Object.entries({ ...this.defaultHeaders, ...options.headers }).filter(
            ([, v]) => v !== undefined,
          ),
        ),
      } as HeadersInit,
    };
    return { url, config };
  }

  private shouldReturnEmptyResponse(response: Response): boolean {
    return response.status === 204 || response.headers.get("content-length") === "0";
  }

  private async parseResponseData<T>(response: Response): Promise<T> {
    if (this.shouldReturnEmptyResponse(response)) {
      return {} as T;
    }
    return (await response.json()) as T;
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const errorDetails = await this.parseErrorDetails(response);
    throw this.createApiError(response, errorDetails);
  }

  private async parseErrorDetails(response: Response): Promise<ProblemDetails | undefined> {
    try {
      return (await response.json()) as ProblemDetails;
    } catch {
      return undefined;
    }
  }

  private createApiError(response: Response, errorDetails?: ProblemDetails): ApiError {
    return new ApiError(
      errorDetails?.detail || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorDetails,
    );
  }

  private handleNetworkError(error: unknown): never {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      `Network error: ${error instanceof Error ? error.message : "Unknown error"}`,
      0,
    );
  }
}
