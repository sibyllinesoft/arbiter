/**
 * Shared utilities for Arbiter CLI and API
 */

/**
 * Format validation errors into a human-readable string
 */
export function formatValidationErrors(
  errors: Array<{
    message: string;
    line?: number;
    column?: number;
    path?: string;
  }>,
): string {
  return errors
    .map((error) => {
      let formatted = error.message;
      if (error.path) {
        formatted = `${error.path}: ${formatted}`;
      }
      if (error.line !== undefined) {
        formatted = `${formatted} (line ${error.line}${error.column ? `, column ${error.column}` : ""})`;
      }
      return formatted;
    })
    .join("\n");
}

/**
 * Check if a path is relative
 */
export function isRelativePath(path: string): boolean {
  return !path.startsWith("/") && !path.match(/^[a-zA-Z]:\\/);
}

/**
 * Normalize path separators to forward slashes
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

/**
 * Simple debounce utility
 */
export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * Placeholder for CUE error translation
 */
export function translateCueErrors(errors: any[]): any[] {
  return errors; // Simple pass-through for now
}
