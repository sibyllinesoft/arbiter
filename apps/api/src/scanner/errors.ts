/**
 * Application error types for structured error handling.
 * Provides HTTP status codes and optional details for API responses.
 */

/**
 * Application-level error with HTTP status code.
 * Used for returning structured error responses from API endpoints.
 */
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}
