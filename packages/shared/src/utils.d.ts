/**
 * Shared utilities for Arbiter CLI and API
 */
/**
 * Format validation errors into a human-readable string
 */
export declare function formatValidationErrors(errors: Array<{
    message: string;
    line?: number;
    column?: number;
    path?: string;
}>): string;
/**
 * Check if a path is relative
 */
export declare function isRelativePath(path: string): boolean;
/**
 * Normalize path separators to forward slashes
 */
export declare function normalizePath(path: string): string;
/**
 * Simple debounce utility
 */
export declare function debounce<T extends (...args: unknown[]) => void>(func: T, wait: number): (...args: Parameters<T>) => void;
/**
 * Translate CUE error messages into more user-friendly messages
 */
export declare function translateCueErrors(errorMessage: string): Array<{
    friendlyMessage: string;
    category: string;
}>;
//# sourceMappingURL=utils.d.ts.map