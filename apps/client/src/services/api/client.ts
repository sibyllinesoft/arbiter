/**
 * Core API client for backend communication.
 * Provides a typed HTTP client with authentication, error handling, and retry logic.
 */
import type { ProblemDetails } from "@/types/api";

/** Configuration options for the API service */
export interface ApiServiceOptions {
  /** Base URL for API requests (defaults to VITE_API_URL env var) */
  baseUrl?: string;
}

/** Handler function called when unauthorized (401/403) responses occur */
export type UnauthorizedHandler = () => Promise<void> | void;

/**
 * Custom error class for API errors.
 * Includes HTTP status code and optional RFC 7807 problem details.
 */
export class ApiError extends Error {
  /** HTTP status code of the error response */
  status: number;
  /** Optional problem details from the API response */
  details?: ProblemDetails | undefined;

  /**
   * Create a new API error.
   * @param message - Error message
   * @param status - HTTP status code
   * @param details - Optional problem details from response
   */
  constructor(message: string, status: number, details?: ProblemDetails | undefined) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

/**
 * HTTP client for making API requests.
 * Handles authentication, error responses, and request configuration.
 */
export class ApiClient {
  /** Base URL for all API requests */
  private baseUrl: string;
  /** Default headers included with every request */
  private defaultHeaders: Record<string, string | undefined> = {
    "Content-Type": "application/json",
  };
  /** Optional handler called on 401/403 responses */
  private unauthorizedHandler?: UnauthorizedHandler;

  /**
   * Create a new API client.
   * @param options - Configuration options
   */
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

  /**
   * Get the configured base URL.
   * @returns The base URL for API requests
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Set a handler to be called on unauthorized responses.
   * @param handler - Function to call on 401/403 responses
   */
  setUnauthorizedHandler(handler: UnauthorizedHandler) {
    this.unauthorizedHandler = handler;
  }

  /**
   * Set the authentication token for requests.
   * @param token - Bearer token to include in Authorization header
   */
  setAuthToken(token: string) {
    this.defaultHeaders.Authorization = `Bearer ${token}`;
  }

  /** Clear the authentication token from requests */
  clearAuthToken() {
    delete this.defaultHeaders.Authorization;
  }

  /**
   * Make an HTTP request to the API.
   * @param endpoint - API endpoint path
   * @param options - Fetch request options
   * @returns Parsed response data
   * @throws ApiError on HTTP errors or network failures
   */
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

  /**
   * Build the full URL and config for a request.
   * @param endpoint - API endpoint path
   * @param options - Request options
   * @returns Full URL and merged configuration
   */
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

  /**
   * Check if a response should be treated as empty.
   * @param response - HTTP response
   * @returns True if response has no content
   */
  private shouldReturnEmptyResponse(response: Response): boolean {
    return response.status === 204 || response.headers.get("content-length") === "0";
  }

  /**
   * Parse the response body as JSON.
   * @param response - HTTP response
   * @returns Parsed response data
   */
  private async parseResponseData<T>(response: Response): Promise<T> {
    if (this.shouldReturnEmptyResponse(response)) {
      return {} as T;
    }
    return (await response.json()) as T;
  }

  /**
   * Handle an error response by throwing an ApiError.
   * @param response - HTTP error response
   * @throws ApiError with status and details
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    const errorDetails = await this.parseErrorDetails(response);
    throw this.createApiError(response, errorDetails);
  }

  /**
   * Parse error details from a response body.
   * @param response - HTTP response
   * @returns Problem details or undefined if parsing fails
   */
  private async parseErrorDetails(response: Response): Promise<ProblemDetails | undefined> {
    try {
      return (await response.json()) as ProblemDetails;
    } catch {
      return undefined;
    }
  }

  /**
   * Create an ApiError from a response.
   * @param response - HTTP response
   * @param errorDetails - Optional parsed problem details
   * @returns ApiError instance
   */
  private createApiError(response: Response, errorDetails?: ProblemDetails): ApiError {
    return new ApiError(
      errorDetails?.detail || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      errorDetails,
    );
  }

  /**
   * Handle a network error by throwing an ApiError.
   * @param error - Original error
   * @throws ApiError with status 0 for network errors
   */
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
