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
 * Translate CUE error messages into more user-friendly messages
 */
export function translateCueErrors(
  errorMessage: string,
): Array<{ friendlyMessage: string; category: string }> {
  // Simple translation for common CUE error patterns
  const translations = [
    {
      pattern: /.*undefined field.*/i,
      friendlyMessage: "This field is not defined in the schema",
      category: "schema",
    },
    {
      pattern: /.*conflicting values.*/i,
      friendlyMessage: "Values conflict with schema requirements",
      category: "validation",
    },
    {
      pattern: /.*cannot unify.*/i,
      friendlyMessage: "Cannot combine these values according to the schema",
      category: "type",
    },
    {
      pattern: /.*incomplete value.*/i,
      friendlyMessage: "This value is missing required information",
      category: "validation",
    },
  ];

  for (const translation of translations) {
    if (translation.pattern.test(errorMessage)) {
      return [
        {
          friendlyMessage: translation.friendlyMessage,
          category: translation.category,
        },
      ];
    }
  }

  // If no pattern matches, return the original message
  return [
    {
      friendlyMessage: errorMessage,
      category: "validation",
    },
  ];
}
